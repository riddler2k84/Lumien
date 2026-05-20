from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.models.scheduling import ScheduleStatus


class ScheduleCreate(BaseModel):
    academic_term_id: int


class ScheduleResponse(BaseModel):
    id: int
    academic_term_id: int
    status: ScheduleStatus
    created_by: int
    approved_by: Optional[int]
    created_at: datetime
    approved_at: Optional[datetime]

    model_config = {"from_attributes": True}


class ScheduleEntryResponse(BaseModel):
    id: int
    schedule_id: int
    class_section_id: int
    teacher_id: int
    room_id: int
    time_slot_id: int

    model_config = {"from_attributes": True}


class SolverRequest(BaseModel):
    academic_term_id: int
    time_limit_seconds: int = 60
