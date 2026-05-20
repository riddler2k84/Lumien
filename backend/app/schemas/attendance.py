from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
from app.models.attendance import AttendanceStatus, SessionStatus, ExcusalStatus


class AttendanceRecordInput(BaseModel):
    student_id: int
    status: AttendanceStatus
    minutes_late: Optional[int] = None
    notes: Optional[str] = None


class MarkAttendanceRequest(BaseModel):
    records: List[AttendanceRecordInput]


class AttendanceRecordResponse(BaseModel):
    id: int
    student_id: int
    status: AttendanceStatus
    minutes_late: Optional[int]
    notes: Optional[str]

    model_config = {"from_attributes": True}


class AttendanceSessionResponse(BaseModel):
    id: int
    schedule_entry_id: int
    class_section_id: int
    teacher_id: int
    date: date
    status: SessionStatus
    marked_at: Optional[datetime]
    records: List[AttendanceRecordResponse] = []

    model_config = {"from_attributes": True}


class ExcusalCreate(BaseModel):
    student_id: int
    date_from: date
    date_to: date
    reason: str
    document_url: Optional[str] = None


class ExcusalResponse(BaseModel):
    id: int
    student_id: int
    date_from: date
    date_to: date
    reason: str
    status: ExcusalStatus
    submitted_by: int
    reviewed_by: Optional[int]
    reviewed_at: Optional[datetime]

    model_config = {"from_attributes": True}


class AttendanceSummary(BaseModel):
    student_id: int
    total_sessions: int
    present: int
    absent: int
    late: int
    excused: int
    attendance_rate: float
