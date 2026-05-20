import enum
from sqlalchemy import Column, Integer, String, Enum, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class ScheduleStatus(str, enum.Enum):
    draft = "draft"
    approved = "approved"
    active = "active"
    archived = "archived"


class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, index=True)
    academic_term_id = Column(Integer, ForeignKey("academic_terms.id"), nullable=False)
    status = Column(Enum(ScheduleStatus), default=ScheduleStatus.draft, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    approved_at = Column(DateTime(timezone=True), nullable=True)

    academic_term = relationship("AcademicTerm", back_populates="schedules")
    creator = relationship("User", foreign_keys=[created_by])
    approver = relationship("User", foreign_keys=[approved_by])
    entries = relationship("ScheduleEntry", back_populates="schedule", cascade="all, delete-orphan")


class ScheduleEntry(Base):
    __tablename__ = "schedule_entries"

    id = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(Integer, ForeignKey("schedules.id"), nullable=False)
    class_section_id = Column(Integer, ForeignKey("class_sections.id"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=False)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)
    time_slot_id = Column(Integer, ForeignKey("time_slots.id"), nullable=False)

    __table_args__ = (
        # No teacher double-booking
        UniqueConstraint("schedule_id", "teacher_id", "time_slot_id", name="uq_teacher_slot"),
        # No room double-booking
        UniqueConstraint("schedule_id", "room_id", "time_slot_id", name="uq_room_slot"),
        # No class double-booking
        UniqueConstraint("schedule_id", "class_section_id", "time_slot_id", name="uq_class_slot"),
    )

    schedule = relationship("Schedule", back_populates="entries")
    class_section = relationship("ClassSection", back_populates="schedule_entries")
    teacher = relationship("Teacher", back_populates="schedule_entries")
    room = relationship("Room", back_populates="schedule_entries")
    time_slot = relationship("TimeSlot", back_populates="schedule_entries")
    attendance_sessions = relationship("AttendanceSession", back_populates="schedule_entry")
