from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.users import Student, User, StudentSpecialNeed, SpecialNeedType

router = APIRouter(prefix="/api/students", tags=["students"])


# ── Special need types (enum list) ───────────────────────────────────────────

@router.get("/need-types")
def list_need_types(_=Depends(get_current_user)):
    return [{"key": t.name, "value": t.value} for t in SpecialNeedType]


# ── Student list with special-needs summary ───────────────────────────────────

@router.get("/")
def list_students(db: Session = Depends(get_db), _=Depends(get_current_user)):
    students = (
        db.query(Student)
        .join(Student.user)
        .filter(User.is_active == True)
        .order_by(Student.grade_level, User.last_name, User.first_name)
        .all()
    )
    return [
        {
            "id": s.id,
            "user_id": s.user_id,
            "full_name": s.user.full_name,
            "email": s.user.email,
            "grade_level": s.grade_level,
            "student_code": s.student_code,
            "special_needs": [
                {"id": n.id, "need_type": n.need_type.value, "notes": n.notes}
                for n in s.special_needs
            ],
        }
        for s in students
    ]


# ── Per-student special needs CRUD ───────────────────────────────────────────

class NeedCreate(BaseModel):
    need_type: SpecialNeedType
    notes: Optional[str] = None


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
        raise HTTPException(409, f"'{payload.need_type.value}' already recorded for this student")
    need = StudentSpecialNeed(student_id=student_id, **payload.model_dump())
    db.add(need)
    db.commit()
    db.refresh(need)
    return {"id": need.id, "need_type": need.need_type.value, "notes": need.notes}


@router.delete("/{student_id}/needs/{need_id}")
def remove_need(
    student_id: int,
    need_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_roles("admin", "headmaster", "teacher")),
):
    need = db.query(StudentSpecialNeed).filter_by(id=need_id, student_id=student_id).first()
    if not need:
        raise HTTPException(404, "Need record not found")
    db.delete(need)
    db.commit()
    return {"status": "removed"}
