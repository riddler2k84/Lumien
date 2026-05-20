import enum
from sqlalchemy import Column, Integer, String, Boolean, Enum, ForeignKey, Text, Date, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base


class DayOfWeek(str, enum.Enum):
    monday = "monday"
    tuesday = "tuesday"
    wednesday = "wednesday"
    thursday = "thursday"
    friday = "friday"


class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    code = Column(String(20), unique=True, nullable=False)
    description = Column(Text)
    grade_level_min = Column(Integer, nullable=False)  # applicable grade range
    grade_level_max = Column(Integer, nullable=False)
    required_weekly_periods = Column(Integer, nullable=False, default=5)

    teacher_qualifications = relationship("TeacherSubject", back_populates="subject")
    requirements = relationship("SubjectRequirement", back_populates="subject")
    class_sections = relationship("ClassSection", back_populates="subject")
    fee_structures = relationship("FeeStructure", back_populates="subject")


class SubjectRequirement(Base):
    __tablename__ = "subject_requirements"

    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    facility_id = Column(Integer, ForeignKey("facilities.id"), nullable=False)
    min_quantity = Column(Integer, default=1, nullable=False)
    is_mandatory = Column(Boolean, default=True, nullable=False)

    subject = relationship("Subject", back_populates="requirements")
    facility = relationship("Facility", back_populates="subject_requirements")


class AcademicTerm(Base):
    __tablename__ = "academic_terms"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    school_year = Column(String(20), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    is_active = Column(Boolean, default=False, nullable=False)

    class_sections = relationship("ClassSection", back_populates="academic_term")
    schedules = relationship("Schedule", back_populates="academic_term")
    fee_structures = relationship("FeeStructure", back_populates="academic_term")
    invoices = relationship("Invoice", back_populates="academic_term")
    scholarships = relationship("ScholarshipDiscount", back_populates="academic_term")
    payroll_periods = relationship("PayPeriod", back_populates="academic_term")


class TimeSlot(Base):
    __tablename__ = "time_slots"

    id = Column(Integer, primary_key=True, index=True)
    day_of_week = Column(Enum(DayOfWeek), nullable=False)
    period_number = Column(Integer, nullable=False)
    start_time = Column(String(5), nullable=False)  # HH:MM
    end_time = Column(String(5), nullable=False)

    __table_args__ = (UniqueConstraint("day_of_week", "period_number"),)

    schedule_entries = relationship("ScheduleEntry", back_populates="time_slot")
    teacher_availability = relationship("TeacherAvailability", back_populates="time_slot")
    attendance_sessions = relationship("AttendanceSession", back_populates="time_slot")


class ClassSection(Base):
    __tablename__ = "class_sections"

    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    academic_term_id = Column(Integer, ForeignKey("academic_terms.id"), nullable=False)
    section_name = Column(String(20), nullable=False)  # e.g. "10A"
    grade_level = Column(Integer, nullable=False)
    max_students = Column(Integer, nullable=False, default=35)

    subject = relationship("Subject", back_populates="class_sections")
    academic_term = relationship("AcademicTerm", back_populates="class_sections")
    enrollments = relationship("Enrollment", back_populates="class_section")
    schedule_entries = relationship("ScheduleEntry", back_populates="class_section")
    attendance_sessions = relationship("AttendanceSession", back_populates="class_section")


class TeacherSubject(Base):
    __tablename__ = "teacher_subjects"

    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)

    __table_args__ = (UniqueConstraint("teacher_id", "subject_id"),)

    teacher = relationship("Teacher", back_populates="subject_qualifications")
    subject = relationship("Subject", back_populates="teacher_qualifications")


class TeacherAvailability(Base):
    __tablename__ = "teacher_availability"

    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=False)
    time_slot_id = Column(Integer, ForeignKey("time_slots.id"), nullable=False)
    is_available = Column(Boolean, default=True, nullable=False)

    __table_args__ = (UniqueConstraint("teacher_id", "time_slot_id"),)

    teacher = relationship("Teacher", back_populates="availability")
    time_slot = relationship("TimeSlot", back_populates="teacher_availability")


class Enrollment(Base):
    __tablename__ = "enrollments"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    class_section_id = Column(Integer, ForeignKey("class_sections.id"), nullable=False)
    enrolled_at = Column(Date, nullable=False)

    __table_args__ = (UniqueConstraint("student_id", "class_section_id"),)

    student = relationship("Student", back_populates="enrollments")
    class_section = relationship("ClassSection", back_populates="enrollments")
