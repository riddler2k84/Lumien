import enum
from sqlalchemy import Column, Integer, String, Boolean, Enum, DateTime, ForeignKey, Date, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class UserRole(str, enum.Enum):
    student = "student"
    teacher = "teacher"
    parent = "parent"
    admin = "admin"
    schedule_admin = "schedule_admin"
    headmaster = "headmaster"


class ParentRelationship(str, enum.Enum):
    mother = "mother"
    father = "father"
    guardian = "guardian"


class SpecialNeedType(str, enum.Enum):
    visual_impairment       = "Visual Impairment"
    hearing_impairment      = "Hearing Impairment"
    physical_disability     = "Physical Disability"
    learning_disability     = "Learning Disability"
    adhd                    = "ADHD"
    autism_spectrum         = "Autism Spectrum"
    speech_language         = "Speech / Language"
    gifted                  = "Gifted & Talented"
    emotional_behavioral    = "Emotional / Behavioral"
    intellectual_disability = "Intellectual Disability"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    student_profile = relationship("Student", back_populates="user", uselist=False)
    teacher_profile = relationship("Teacher", back_populates="user", uselist=False)
    parent_profile = relationship("Parent", back_populates="user", uselist=False)
    staff_profile = relationship("Staff", back_populates="user", uselist=False)

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    grade_level = Column(Integer, nullable=False)  # 1-11
    enrollment_date = Column(Date, nullable=False)
    student_code = Column(String(20), unique=True, nullable=False)

    user = relationship("User", back_populates="student_profile")
    parent_links = relationship("ParentStudent", back_populates="student")
    enrollments = relationship("Enrollment", back_populates="student")
    attendance_records = relationship("AttendanceRecord", back_populates="student")
    invoices = relationship("Invoice", back_populates="student")
    scholarships = relationship("ScholarshipDiscount", back_populates="student")
    special_needs = relationship("StudentSpecialNeed", back_populates="student", cascade="all, delete-orphan")


class StudentSpecialNeed(Base):
    __tablename__ = "student_special_needs"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    need_type = Column(Enum(SpecialNeedType), nullable=False)
    notes = Column(String(500))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (UniqueConstraint("student_id", "need_type", name="uq_student_need"),)

    student = relationship("Student", back_populates="special_needs")


class Teacher(Base):
    __tablename__ = "teachers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    max_weekly_hours = Column(Integer, default=30, nullable=False)
    employee_code = Column(String(20), unique=True, nullable=False)

    user = relationship("User", back_populates="teacher_profile")
    subject_qualifications = relationship("TeacherSubject", back_populates="teacher")
    availability = relationship("TeacherAvailability", back_populates="teacher")
    schedule_entries = relationship("ScheduleEntry", back_populates="teacher")
    attendance_sessions = relationship("AttendanceSession", back_populates="teacher")


class Parent(Base):
    __tablename__ = "parents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    phone = Column(String(20))

    user = relationship("User", back_populates="parent_profile")
    student_links = relationship("ParentStudent", back_populates="parent")


class ParentStudent(Base):
    __tablename__ = "parent_students"

    id = Column(Integer, primary_key=True, index=True)
    parent_id = Column(Integer, ForeignKey("parents.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    relationship_type = Column(Enum(ParentRelationship), nullable=False)

    parent = relationship("Parent", back_populates="student_links")
    student = relationship("Student", back_populates="parent_links")


class Staff(Base):
    __tablename__ = "staff"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    department = Column(String(100))
    employee_code = Column(String(20), unique=True, nullable=False)

    user = relationship("User", back_populates="staff_profile")
