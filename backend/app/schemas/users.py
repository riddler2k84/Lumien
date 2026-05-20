from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import date
from app.models.users import UserRole, ParentRelationship


class UserBase(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    role: UserRole


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    id: int
    is_active: bool

    model_config = {"from_attributes": True}


class StudentCreate(BaseModel):
    user: UserCreate
    grade_level: int
    enrollment_date: date
    student_code: str


class StudentResponse(BaseModel):
    id: int
    user_id: int
    grade_level: int
    enrollment_date: date
    student_code: str
    user: UserResponse

    model_config = {"from_attributes": True}


class TeacherCreate(BaseModel):
    user: UserCreate
    max_weekly_hours: int = 30
    employee_code: str


class TeacherResponse(BaseModel):
    id: int
    user_id: int
    max_weekly_hours: int
    employee_code: str
    user: UserResponse

    model_config = {"from_attributes": True}


class ParentCreate(BaseModel):
    user: UserCreate
    phone: Optional[str] = None


class ParentResponse(BaseModel):
    id: int
    user_id: int
    phone: Optional[str]
    user: UserResponse

    model_config = {"from_attributes": True}


class StaffCreate(BaseModel):
    user: UserCreate
    department: Optional[str] = None
    employee_code: str


class StaffResponse(BaseModel):
    id: int
    user_id: int
    department: Optional[str]
    employee_code: str
    user: UserResponse

    model_config = {"from_attributes": True}


class ParentStudentLink(BaseModel):
    parent_id: int
    student_id: int
    relationship_type: ParentRelationship
