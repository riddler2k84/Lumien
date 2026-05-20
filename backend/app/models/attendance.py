import enum
from sqlalchemy import Column, Integer, String, Boolean, Enum, ForeignKey, DateTime, Date, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class AttendanceStatus(str, enum.Enum):
    present = "present"
    absent = "absent"
    late = "late"
    excused = "excused"


class SessionStatus(str, enum.Enum):
    pending = "pending"
    marked = "marked"
    cancelled = "cancelled"


class ExcusalStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class AttendanceSession(Base):
    __tablename__ = "attendance_sessions"

    id = Column(Integer, primary_key=True, index=True)
    schedule_entry_id = Column(Integer, ForeignKey("schedule_entries.id"), nullable=False)
    class_section_id = Column(Integer, ForeignKey("class_sections.id"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=False)
    time_slot_id = Column(Integer, ForeignKey("time_slots.id"), nullable=False)
    date = Column(Date, nullable=False)
    status = Column(Enum(SessionStatus), default=SessionStatus.pending, nullable=False)
    marked_at = Column(DateTime(timezone=True), nullable=True)
    marked_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    __table_args__ = (UniqueConstraint("schedule_entry_id", "date"),)

    schedule_entry = relationship("ScheduleEntry", back_populates="attendance_sessions")
    class_section = relationship("ClassSection", back_populates="attendance_sessions")
    teacher = relationship("Teacher", back_populates="attendance_sessions")
    time_slot = relationship("TimeSlot", back_populates="attendance_sessions")
    marker = relationship("User", foreign_keys=[marked_by])
    records = relationship("AttendanceRecord", back_populates="session", cascade="all, delete-orphan")


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id = Column(Integer, primary_key=True, index=True)
    attendance_session_id = Column(Integer, ForeignKey("attendance_sessions.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    status = Column(Enum(AttendanceStatus), default=AttendanceStatus.present, nullable=False)
    minutes_late = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (UniqueConstraint("attendance_session_id", "student_id"),)

    session = relationship("AttendanceSession", back_populates="records")
    student = relationship("Student", back_populates="attendance_records")


class AbsenceExcusal(Base):
    __tablename__ = "absence_excusals"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    date_from = Column(Date, nullable=False)
    date_to = Column(Date, nullable=False)
    reason = Column(Text, nullable=False)
    document_url = Column(String(500), nullable=True)
    submitted_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(Enum(ExcusalStatus), default=ExcusalStatus.pending, nullable=False)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    student = relationship("Student")
    submitter = relationship("User", foreign_keys=[submitted_by])
    reviewer = relationship("User", foreign_keys=[reviewed_by])
