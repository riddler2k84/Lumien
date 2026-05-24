from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.rooms import Room, RoomType

router = APIRouter(prefix="/api/rooms", tags=["rooms"])


def _serialize(r: Room) -> dict:
    return {
        "id": r.id,
        "name": r.name,
        "code": r.code,
        "capacity": r.capacity,
        "building": r.building,
        "floor": r.floor,
        "is_active": r.is_active,
        "room_type_id": r.room_type_id,
        "room_type": r.room_type.name,
    }


# ── Room Types ──────────────────────────────────────────────────────────────

class RoomTypeCreate(BaseModel):
    name: str
    description: Optional[str] = None


@router.get("/types")
def list_room_types(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return [
        {"id": rt.id, "name": rt.name, "description": rt.description}
        for rt in db.query(RoomType).order_by(RoomType.name).all()
    ]


@router.post("/types")
def create_room_type(
    payload: RoomTypeCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles("admin", "headmaster")),
):
    if db.query(RoomType).filter(RoomType.name == payload.name).first():
        raise HTTPException(400, f"Room type '{payload.name}' already exists")
    rt = RoomType(name=payload.name, description=payload.description)
    db.add(rt)
    db.commit()
    db.refresh(rt)
    return {"id": rt.id, "name": rt.name, "description": rt.description}


# ── Rooms ────────────────────────────────────────────────────────────────────

class RoomCreate(BaseModel):
    name: str
    code: str
    room_type_id: int
    capacity: int
    building: Optional[str] = None
    floor: Optional[str] = None


class RoomUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    room_type_id: Optional[int] = None
    capacity: Optional[int] = None
    building: Optional[str] = None
    floor: Optional[str] = None
    is_active: Optional[bool] = None


@router.get("/")
def list_rooms(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(Room).join(Room.room_type)
    if not include_inactive:
        q = q.filter(Room.is_active == True)
    return [_serialize(r) for r in q.order_by(Room.building, Room.code).all()]


@router.post("/")
def create_room(
    payload: RoomCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles("admin", "headmaster", "schedule_admin")),
):
    if db.query(Room).filter(Room.code == payload.code).first():
        raise HTTPException(400, f"Room code '{payload.code}' already exists")
    if not db.get(RoomType, payload.room_type_id):
        raise HTTPException(404, "Room type not found")
    room = Room(**payload.model_dump())
    db.add(room)
    db.commit()
    db.refresh(room)
    return _serialize(room)


@router.patch("/{room_id}")
def update_room(
    room_id: int,
    payload: RoomUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_roles("admin", "headmaster", "schedule_admin")),
):
    room = db.get(Room, room_id)
    if not room:
        raise HTTPException(404, "Room not found")
    if payload.code and payload.code != room.code:
        if db.query(Room).filter(Room.code == payload.code).first():
            raise HTTPException(400, f"Code '{payload.code}' already taken")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(room, field, value)
    db.commit()
    db.refresh(room)
    return _serialize(room)


@router.get("/{room_id}/classes")
def room_classes(
    room_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Return all scheduled classes assigned to this room from the active schedule."""
    from app.models.scheduling import Schedule, ScheduleEntry, ScheduleStatus
    from app.models.academic import ClassSection

    room = db.get(Room, room_id)
    if not room:
        raise HTTPException(404, "Room not found")

    # Use the active schedule; fall back to the most recent one
    schedule = (
        db.query(Schedule).filter(Schedule.status == ScheduleStatus.active).first()
        or db.query(Schedule).order_by(Schedule.id.desc()).first()
    )
    if not schedule:
        return []

    entries = (
        db.query(ScheduleEntry)
        .filter(ScheduleEntry.schedule_id == schedule.id, ScheduleEntry.room_id == room_id)
        .all()
    )

    results = []
    for e in entries:
        ts = e.time_slot
        cs = e.class_section
        teacher = e.teacher.user if e.teacher else None
        results.append({
            "day":        ts.day_of_week.value,
            "period":     ts.period_number,
            "start_time": str(ts.start_time)[:5] if ts.start_time else None,
            "end_time":   str(ts.end_time)[:5]   if ts.end_time   else None,
            "subject":    cs.subject.name,
            "section":    cs.section_name,
            "grade":      cs.grade_level,
            "teacher":    teacher.full_name if teacher else "—",
        })

    # Sort by day order then period
    day_order = {"monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3, "friday": 4}
    results.sort(key=lambda x: (day_order.get(x["day"], 9), x["period"]))
    return results


@router.delete("/{room_id}")
def deactivate_room(
    room_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_roles("admin", "headmaster")),
):
    room = db.get(Room, room_id)
    if not room:
        raise HTTPException(404, "Room not found")
    room.is_active = False
    db.commit()
    return {"status": "deactivated"}
