from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.scheduling import Schedule, ScheduleStatus, ScheduleEntry
from app.models.users import User
from app.schemas.scheduling import ScheduleCreate, ScheduleResponse, SolverRequest

router = APIRouter(prefix="/api/schedules", tags=["scheduling"])


# ── Builder helper ────────────────────────────────────────────────────────────

def _greedy_build(db: Session, schedule_id: int, assignments: list) -> list[str]:
    """Greedy time-slot assignment for manual schedule builder."""
    from app.models.academic import TimeSlot, ClassSection

    slots = db.query(TimeSlot).order_by(TimeSlot.day_of_week, TimeSlot.period_number).all()
    teacher_busy: dict[int, set] = {}
    room_busy:    dict[int, set] = {}
    section_busy: dict[int, set] = {}
    group_busy:   dict[str, set] = {}   # section_name → no two subjects same slot
    warnings: list[str] = []

    for a in assignments:
        section  = db.get(ClassSection, a.get("class_section_id"))
        teacher_id = a.get("teacher_id")
        room_id    = a.get("room_id")
        if not section or not teacher_id or not room_id:
            continue

        needed = section.subject.required_weekly_periods
        t_busy = teacher_busy.setdefault(teacher_id, set())
        r_busy = room_busy.setdefault(room_id, set())
        s_busy = section_busy.setdefault(section.id, set())
        g_busy = group_busy.setdefault(section.section_name, set())

        assigned = 0
        for slot in slots:
            if assigned >= needed:
                break
            if slot.id in t_busy or slot.id in r_busy or slot.id in s_busy or slot.id in g_busy:
                continue
            db.add(ScheduleEntry(
                schedule_id=schedule_id,
                time_slot_id=slot.id,
                teacher_id=teacher_id,
                room_id=room_id,
                class_section_id=section.id,
            ))
            t_busy.add(slot.id); r_busy.add(slot.id)
            s_busy.add(slot.id); g_busy.add(slot.id)
            assigned += 1

        if assigned < needed:
            warnings.append(
                f"{section.section_name} – {section.subject.name}: {assigned}/{needed} periods placed"
            )

    db.flush()
    return warnings


# ── Builder data endpoints (must be before /{schedule_id} routes) ─────────────

@router.get("/palette-data")
def get_palette_data(db: Session = Depends(get_db), _=Depends(get_current_user)):
    """All subjects, rooms, teachers and terms — no term_id required. Used by the drag-and-drop builder."""
    from app.models.academic import Subject, AcademicTerm
    from app.models.users import Teacher
    from app.models.rooms import Room

    subjects = db.query(Subject).order_by(Subject.name).all()
    rooms    = db.query(Room).filter(Room.is_active == True).join(Room.room_type).order_by(Room.building, Room.code).all()
    teachers = db.query(Teacher).join(Teacher.user).order_by(User.last_name).all()
    terms    = db.query(AcademicTerm).order_by(AcademicTerm.start_date.desc()).all()

    return {
        "subjects": [
            {
                "id": s.id,
                "name": s.name,
                "code": s.code,
                "grade_level_min": s.grade_level_min,
                "grade_level_max": s.grade_level_max,
                "required_weekly_periods": s.required_weekly_periods,
            }
            for s in subjects
        ],
        "rooms": [
            {
                "id": r.id,
                "name": r.name,
                "code": r.code,
                "capacity": r.capacity,
                "room_type": r.room_type.name,
                "building": r.building,
                "floor": r.floor,
            }
            for r in rooms
        ],
        "teachers": [
            {
                "id": t.id,
                "name": t.user.full_name,
                "employee_code": t.employee_code,
                "subject_ids": [ts.subject_id for ts in t.subject_qualifications],
                "max_weekly_hours": t.max_weekly_hours,
            }
            for t in teachers
        ],
        "terms": [
            {"id": t.id, "name": t.name, "school_year": t.school_year, "is_active": t.is_active}
            for t in terms
        ],
    }


# ── Pydantic models for drag-and-drop builder ─────────────────────────────────

class BuilderItem(BaseModel):
    subject_id: int
    teacher_id: int
    room_id: int
    grade_level: Optional[int] = None   # None / 0 = open / cross-grade
    section_name: str                   # e.g. "7A", "SPORTS-ALL"
    periods_per_week: int
    max_students: int = 30


class BuilderScheduleCreate(BaseModel):
    term_id: int
    items: List[BuilderItem]


@router.post("/from-builder")
def create_from_builder(
    payload: BuilderScheduleCreate,
    current_user: User = Depends(require_roles("schedule_admin", "headmaster")),
    db: Session = Depends(get_db),
):
    """Drag-and-drop builder: dynamically creates class sections, then greedy-assigns time slots."""
    from app.models.academic import AcademicTerm, ClassSection, TimeSlot

    term = db.get(AcademicTerm, payload.term_id)
    if not term:
        raise HTTPException(404, "Term not found")
    if not payload.items:
        raise HTTPException(400, "At least one class assignment is required")

    schedule = Schedule(
        academic_term_id=payload.term_id,
        status=ScheduleStatus.draft,
        created_by=current_user.id,
    )
    db.add(schedule)
    db.flush()

    slots = db.query(TimeSlot).order_by(TimeSlot.day_of_week, TimeSlot.period_number).all()

    teacher_busy: dict[int, set] = {}
    room_busy:    dict[int, set] = {}
    section_busy: dict[str, set] = {}  # keyed by section_name
    warnings: list[str] = []

    for item in payload.items:
        # Create the class section
        section = ClassSection(
            subject_id=item.subject_id,
            academic_term_id=payload.term_id,
            section_name=item.section_name,
            grade_level=item.grade_level if item.grade_level else 0,
            max_students=item.max_students,
        )
        db.add(section)
        db.flush()

        # Greedy assign time slots
        needed    = item.periods_per_week
        t_busy    = teacher_busy.setdefault(item.teacher_id, set())
        r_busy    = room_busy.setdefault(item.room_id, set())
        s_busy    = section_busy.setdefault(item.section_name, set())
        assigned  = 0

        import random as _rnd
        shuffled = slots[:]
        _rnd.shuffle(shuffled)

        for slot in shuffled:
            if assigned >= needed:
                break
            if slot.id in t_busy or slot.id in r_busy or slot.id in s_busy:
                continue
            db.add(ScheduleEntry(
                schedule_id=schedule.id,
                time_slot_id=slot.id,
                teacher_id=item.teacher_id,
                room_id=item.room_id,
                class_section_id=section.id,
            ))
            t_busy.add(slot.id); r_busy.add(slot.id); s_busy.add(slot.id)
            assigned += 1

        if assigned < needed:
            warnings.append(f"{item.section_name}: only {assigned}/{needed} periods placed")

    db.commit()
    db.refresh(schedule)

    return {
        "id": schedule.id,
        "status": schedule.status.value,
        "term_id": schedule.academic_term_id,
        "entry_count": len(schedule.entries),
        "warnings": warnings,
    }


@router.get("/terms")
def list_terms(db: Session = Depends(get_db), _=Depends(get_current_user)):
    from app.models.academic import AcademicTerm
    return [
        {"id": t.id, "name": t.name, "school_year": t.school_year, "is_active": t.is_active}
        for t in db.query(AcademicTerm).order_by(AcademicTerm.start_date.desc()).all()
    ]


@router.get("/builder-data")
def get_builder_data(
    term_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    from app.models.academic import AcademicTerm, ClassSection
    from app.models.users import Teacher
    from app.models.rooms import Room

    if not db.get(AcademicTerm, term_id):
        raise HTTPException(404, "Term not found")

    sections = (
        db.query(ClassSection)
        .filter(ClassSection.academic_term_id == term_id)
        .order_by(ClassSection.grade_level, ClassSection.section_name)
        .all()
    )
    teachers = db.query(Teacher).join(Teacher.user).order_by(User.last_name).all()
    rooms    = (
        db.query(Room)
        .filter(Room.is_active == True)
        .join(Room.room_type)
        .order_by(Room.code)
        .all()
    )

    return {
        "sections": [
            {
                "id": s.id,
                "subject_id": s.subject_id,
                "subject_name": s.subject.name,
                "subject_code": s.subject.code,
                "grade_level": s.grade_level,
                "section_name": s.section_name,
                "required_weekly_periods": s.subject.required_weekly_periods,
                "enrolled_count": len(s.enrollments),
                "max_students": s.max_students,
            }
            for s in sections
        ],
        "teachers": [
            {
                "id": t.id,
                "name": t.user.full_name,
                "employee_code": t.employee_code,
                "subject_ids": [ts.subject_id for ts in t.subject_qualifications],
                "max_weekly_hours": t.max_weekly_hours,
            }
            for t in teachers
        ],
        "rooms": [
            {
                "id": r.id,
                "name": r.name,
                "code": r.code,
                "capacity": r.capacity,
                "room_type": r.room_type.name,
                "room_type_id": r.room_type_id,
            }
            for r in rooms
        ],
    }


@router.post("/")
def create_schedule_manual(
    payload: dict,
    current_user: User = Depends(require_roles("schedule_admin", "headmaster")),
    db: Session = Depends(get_db),
):
    """Card-builder manual schedule: accepts list of {class_section_id, teacher_id, room_id}."""
    term_id     = payload.get("academic_term_id")
    assignments = payload.get("assignments", [])
    if not term_id:
        raise HTTPException(400, "academic_term_id is required")

    schedule = Schedule(
        academic_term_id=term_id,
        status=ScheduleStatus.draft,
        created_by=current_user.id,
    )
    db.add(schedule)
    db.flush()

    warnings = _greedy_build(db, schedule.id, assignments)
    db.commit()
    db.refresh(schedule)

    return {
        "id": schedule.id,
        "status": schedule.status.value,
        "academic_term_id": schedule.academic_term_id,
        "entry_count": len(schedule.entries),
        "warnings": warnings,
    }


@router.get("/", response_model=List[ScheduleResponse])
def list_schedules(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Schedule).order_by(Schedule.created_at.desc()).all()


@router.post("/generate", response_model=ScheduleResponse)
def generate_schedule(
    payload: SolverRequest,
    current_user: User = Depends(require_roles("schedule_admin", "headmaster")),
    db: Session = Depends(get_db),
):
    from app.solver.scheduler import run_solver
    schedule = Schedule(
        academic_term_id=payload.academic_term_id,
        status=ScheduleStatus.draft,
        created_by=current_user.id,
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)

    result = run_solver(db, schedule.id, payload.academic_term_id, payload.time_limit_seconds)
    if not result["feasible"]:
        db.delete(schedule)
        db.commit()
        raise HTTPException(422, f"No feasible schedule found: {result.get('message', '')}")

    db.refresh(schedule)
    return schedule


@router.patch("/{schedule_id}/approve", response_model=ScheduleResponse)
def approve_schedule(
    schedule_id: int,
    current_user: User = Depends(require_roles("headmaster")),
    db: Session = Depends(get_db),
):
    schedule = db.get(Schedule, schedule_id)
    if not schedule:
        raise HTTPException(404, "Schedule not found")
    if schedule.status != ScheduleStatus.draft:
        raise HTTPException(400, "Only draft schedules can be approved")
    schedule.status = ScheduleStatus.approved
    schedule.approved_by = current_user.id
    schedule.approved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(schedule)
    return schedule


@router.patch("/{schedule_id}/activate", response_model=ScheduleResponse)
def activate_schedule(
    schedule_id: int,
    current_user: User = Depends(require_roles("headmaster", "schedule_admin")),
    db: Session = Depends(get_db),
):
    schedule = db.get(Schedule, schedule_id)
    if not schedule:
        raise HTTPException(404, "Schedule not found")
    if schedule.status != ScheduleStatus.approved:
        raise HTTPException(400, "Schedule must be approved before activation")

    # Archive any currently active schedule for same term
    db.query(Schedule).filter(
        Schedule.academic_term_id == schedule.academic_term_id,
        Schedule.status == ScheduleStatus.active,
        Schedule.id != schedule_id,
    ).update({"status": ScheduleStatus.archived})

    schedule.status = ScheduleStatus.active
    db.commit()
    db.refresh(schedule)
    return schedule


@router.get("/my-classes")
def my_classes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns the logged-in teacher's own classes from the active schedule."""
    teacher = current_user.teacher_profile
    if not teacher:
        return []

    active = (
        db.query(Schedule).filter(Schedule.status == ScheduleStatus.active).first()
        or db.query(Schedule).order_by(Schedule.id.desc()).first()
    )
    if not active:
        return []

    entries = (
        db.query(ScheduleEntry)
        .filter(
            ScheduleEntry.schedule_id == active.id,
            ScheduleEntry.teacher_id == teacher.id,
        )
        .all()
    )

    day_order = {"monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3, "friday": 4}
    result = []
    for e in entries:
        ts = e.time_slot
        cs = e.class_section
        result.append({
            "day":        ts.day_of_week.value,
            "period":     ts.period_number,
            "start_time": str(ts.start_time)[:5] if ts.start_time else None,
            "end_time":   str(ts.end_time)[:5]   if ts.end_time   else None,
            "subject":    cs.subject.name,
            "subject_code": cs.subject.code,
            "section":    cs.section_name,
            "grade":      cs.grade_level,
            "room":       e.room.code,
            "room_name":  e.room.name,
        })
    result.sort(key=lambda x: (day_order.get(x["day"], 9), x["period"]))
    return result


@router.get("/{schedule_id}/timetable")
def get_timetable(schedule_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    schedule = db.get(Schedule, schedule_id)
    if not schedule:
        raise HTTPException(404, "Schedule not found")
    return [
        {
            "id": e.id,
            "day": e.time_slot.day_of_week.value,
            "period": e.time_slot.period_number,
            "start_time": e.time_slot.start_time,
            "end_time": e.time_slot.end_time,
            "subject": e.class_section.subject.name,
            "section": e.class_section.section_name,
            "teacher": e.teacher.user.full_name,
            "room": e.room.code,
        }
        for e in schedule.entries
    ]
