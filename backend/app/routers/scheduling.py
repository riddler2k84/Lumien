from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.scheduling import Schedule, ScheduleStatus
from app.models.users import User
from app.schemas.scheduling import ScheduleCreate, ScheduleResponse, SolverRequest

router = APIRouter(prefix="/api/schedules", tags=["scheduling"])


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
