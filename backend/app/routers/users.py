from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import require_roles
from app.models.users import User

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/")
def list_users(
    db: Session = Depends(get_db),
    _=Depends(require_roles("admin", "headmaster", "schedule_admin")),
):
    users = db.query(User).order_by(User.last_name, User.first_name).all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "role": u.role.value,
            "is_active": u.is_active,
            # profile IDs so the frontend can call role-specific APIs
            "student_id": u.student_profile.id if u.student_profile else None,
            "teacher_id": u.teacher_profile.id if u.teacher_profile else None,
        }
        for u in users
    ]
