from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date
from pydantic import BaseModel
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.core.security import hash_password
from app.models.users import (
    User, UserRole, Student, Parent, ParentStudent, ParentRelationship,
    StudentSpecialNeed, SpecialNeedType,
)

router = APIRouter(prefix="/api/students", tags=["students"])


def _serialize_student(s: Student) -> dict:
    parents = []
    for link in s.parent_links:
        p = link.parent
        parents.append({
            "link_id":      link.id,
            "parent_id":    p.id,
            "user_id":      p.user_id,
            "name":         p.user.full_name,
            "email":        p.user.email,
            "phone":        p.phone,
            "relationship": link.relationship_type.value,
        })
    return {
        "id":            s.id,
        "user_id":       s.user_id,
        "full_name":     s.user.full_name,
        "first_name":    s.user.first_name,
        "last_name":     s.user.last_name,
        "email":         s.user.email,
        "grade_level":   s.grade_level,
        "student_code":  s.student_code,
        "enrollment_date": str(s.enrollment_date),
        "is_active":     s.user.is_active,
        "special_needs": [
            {"id": n.id, "need_type": n.need_type.value, "notes": n.notes}
            for n in s.special_needs
        ],
        "parents": parents,
    }


# ── Pydantic models ───────────────────────────────────────────────────────────

class StudentCreate(BaseModel):
    first_name:      str
    last_name:       str
    email:           str
    password:        str
    grade_level:     int
    enrollment_date: Optional[date] = None


class StudentUpdate(BaseModel):
    first_name:      Optional[str]  = None
    last_name:       Optional[str]  = None
    email:           Optional[str]  = None
    grade_level:     Optional[int]  = None
    enrollment_date: Optional[date] = None
    is_active:       Optional[bool] = None


class ParentCreate(BaseModel):
    """Create a new parent account and link it to the student."""
    first_name:    str
    last_name:     str
    email:         str
    password:      str
    phone:         Optional[str] = ""
    relationship:  str = "guardian"   # mother | father | guardian


class ParentLinkExisting(BaseModel):
    """Link an existing parent (by user_id) to the student."""
    parent_user_id: int
    relationship:   str = "guardian"


class NeedCreate(BaseModel):
    need_type: SpecialNeedType
    notes: Optional[str] = None


# ── Endpoints ──────────────────────────────────────────��──────────────────────

@router.get("/need-types")
def list_need_types(_=Depends(get_current_user)):
    return [{"key": t.name, "value": t.value} for t in SpecialNeedType]


@router.get("/")
def list_students(
    grade: Optional[int] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(Student).join(Student.user)
    if grade:
        q = q.filter(Student.grade_level == grade)
    students = q.order_by(Student.grade_level, User.last_name, User.first_name).all()
    return [_serialize_student(s) for s in students]


@router.post("/")
def create_student(
    payload: StudentCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles("admin", "headmaster")),
):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(400, f"Email '{payload.email}' already registered")

    from app.routers.users import _next_student_code
    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        first_name=payload.first_name,
        last_name=payload.last_name,
        role=UserRole.student,
        is_active=True,
    )
    db.add(user)
    db.flush()

    student = Student(
        user_id=user.id,
        grade_level=payload.grade_level,
        enrollment_date=payload.enrollment_date or date.today(),
        student_code=_next_student_code(db),
    )
    db.add(student)
    db.commit()
    db.refresh(student)
    return _serialize_student(student)


@router.patch("/{student_id}")
def update_student(
    student_id: int,
    payload: StudentUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_roles("admin", "headmaster")),
):
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(404, "Student not found")

    user = student.user
    if payload.email and payload.email != user.email:
        if db.query(User).filter(User.email == payload.email).first():
            raise HTTPException(400, f"Email '{payload.email}' already taken")
        user.email = payload.email

    if payload.first_name:           user.first_name      = payload.first_name
    if payload.last_name:            user.last_name        = payload.last_name
    if payload.is_active is not None: user.is_active       = payload.is_active
    if payload.grade_level:          student.grade_level  = payload.grade_level
    if payload.enrollment_date:      student.enrollment_date = payload.enrollment_date

    db.commit()
    db.refresh(student)
    return _serialize_student(student)


# ── Parent management ─────────────────────────────────────────────────────────

@router.post("/{student_id}/parents")
def add_parent(
    student_id: int,
    payload: ParentCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles("admin", "headmaster")),
):
    """Create a new parent account and link to this student."""
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(404, "Student not found")

    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(400, f"Email '{payload.email}' already registered — use link-existing instead")

    try:
        rel = ParentRelationship(payload.relationship)
    except ValueError:
        raise HTTPException(400, f"Unknown relationship '{payload.relationship}'")

    parent_user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        first_name=payload.first_name,
        last_name=payload.last_name,
        role=UserRole.parent,
        is_active=True,
    )
    db.add(parent_user)
    db.flush()

    parent = Parent(user_id=parent_user.id, phone=payload.phone or "")
    db.add(parent)
    db.flush()

    db.add(ParentStudent(parent_id=parent.id, student_id=student_id, relationship_type=rel))
    db.commit()
    db.refresh(student)
    return _serialize_student(student)


@router.post("/{student_id}/parents/link")
def link_existing_parent(
    student_id: int,
    payload: ParentLinkExisting,
    db: Session = Depends(get_db),
    _=Depends(require_roles("admin", "headmaster")),
):
    """Link an already-existing parent account (e.g. sibling family) to this student."""
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(404, "Student not found")

    parent_user = db.get(User, payload.parent_user_id)
    if not parent_user or not parent_user.parent_profile:
        raise HTTPException(404, "Parent user not found")

    parent = parent_user.parent_profile
    existing = db.query(ParentStudent).filter_by(
        parent_id=parent.id, student_id=student_id
    ).first()
    if existing:
        raise HTTPException(409, "This parent is already linked to this student")

    try:
        rel = ParentRelationship(payload.relationship)
    except ValueError:
        rel = ParentRelationship.guardian

    db.add(ParentStudent(parent_id=parent.id, student_id=student_id, relationship_type=rel))
    db.commit()
    db.refresh(student)
    return _serialize_student(student)


@router.delete("/{student_id}/parents/{link_id}")
def remove_parent_link(
    student_id: int,
    link_id:    int,
    db: Session = Depends(get_db),
    _=Depends(require_roles("admin", "headmaster")),
):
    link = db.query(ParentStudent).filter_by(id=link_id, student_id=student_id).first()
    if not link:
        raise HTTPException(404, "Parent link not found")
    db.delete(link)
    db.commit()
    return {"status": "unlinked"}


# ── Special needs CRUD (kept from original) ───────────────────────────────────

@router.get("/{student_id}/needs")
def get_needs(
    student_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(404, "Student not found")
    return [{"id": n.id, "need_type": n.need_type.value, "notes": n.notes} for n in student.special_needs]


@router.post("/{student_id}/needs")
def add_need(
    student_id: int,
    payload: NeedCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles("admin", "headmaster", "teacher")),
):
    if not db.get(Student, student_id):
        raise HTTPException(404, "Student not found")
    existing = db.query(StudentSpecialNeed).filter_by(
        student_id=student_id, need_type=payload.need_type
    ).first()
    if existing:
        raise HTTPException(409, f"'{payload.need_type.value}' already recorded")
    need = StudentSpecialNeed(student_id=student_id, **payload.model_dump())
    db.add(need)
    db.commit()
    db.refresh(need)
    return {"id": need.id, "need_type": need.need_type.value, "notes": need.notes}


@router.delete("/{student_id}/needs/{need_id}")
def remove_need(
    student_id: int,
    need_id:    int,
    db: Session = Depends(get_db),
    _=Depends(require_roles("admin", "headmaster", "teacher")),
):
    need = db.query(StudentSpecialNeed).filter_by(id=need_id, student_id=student_id).first()
    if not need:
        raise HTTPException(404, "Need record not found")
    db.delete(need)
    db.commit()
    return {"status": "removed"}
