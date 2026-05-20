from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone
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
