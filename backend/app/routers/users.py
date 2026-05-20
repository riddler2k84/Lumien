from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.dependencies import require_roles
from app.models.users import User
from app.schemas.users import UserResponse

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/", response_model=List[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    _=Depends(require_roles("admin", "headmaster", "schedule_admin")),
):
    return db.query(User).order_by(User.last_name, User.first_name).all()
