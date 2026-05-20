"""
Entry point for seeding the database.
  - Base seed: always runs (subjects, room types, facilities, rooms, time slots, pay components)
  - Demo seed: only when APP_MODE=demo
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import SessionLocal, engine, Base

# Base data
from seeds.base.subjects import SUBJECTS
from seeds.base.rooms import ROOM_TYPES, FACILITIES, ROOMS
from seeds.base.timeslots import TIME_SLOTS
from seeds.base.payroll_components import PAY_GRADES, PAY_COMPONENTS

# Models
from app.models import (
    Subject, SubjectRequirement, RoomType, Room, Facility, RoomFacility,
    TimeSlot, SystemConfig, PayGrade, PayComponent
)


def _clear_all(db: Session):
    """Truncate all tables in reverse dependency order for a clean re-seed."""
    from sqlalchemy import text, inspect, event
    dialect = engine.dialect.name
    if dialect == "postgresql":
        db.execute(text("SET session_replication_role = 'replica'"))
        for table in reversed(Base.metadata.sorted_tables):
            db.execute(table.delete())
        db.execute(text("SET session_replication_role = 'origin'"))
    elif dialect == "sqlite":
        db.execute(text("PRAGMA foreign_keys = OFF"))
        for table in reversed(Base.metadata.sorted_tables):
            db.execute(table.delete())
        db.execute(text("PRAGMA foreign_keys = ON"))
    else:
        for table in reversed(Base.metadata.sorted_tables):
            db.execute(table.delete())
    db.commit()


def _seed_base(db: Session) -> dict:
    refs = {}

    # Subjects
    subject_objs = []
    for s in SUBJECTS:
        obj = Subject(**s)
        db.add(obj)
        subject_objs.append(obj)
    db.flush()
    refs["subjects"] = subject_objs

    # Room types
    rt_map = {}
    for rt in ROOM_TYPES:
        obj = RoomType(**rt)
        db.add(obj)
        db.flush()
        rt_map[rt["name"]] = obj

    # Facilities
    fac_map = {}
    for fac in FACILITIES:
        obj = Facility(**fac)
        db.add(obj)
        db.flush()
        fac_map[fac["name"]] = obj

    # Rooms
    room_objs = []
    for room_def in ROOMS:
        code, rt_name, name, capacity, floor, building, fac_list = room_def
        room = Room(
            room_type_id=rt_map[rt_name].id,
            name=name,
            code=code,
            capacity=capacity,
            floor=floor,
            building=building,
        )
        db.add(room)
        db.flush()
        for fac_name, qty in fac_list:
            db.add(RoomFacility(room_id=room.id, facility_id=fac_map[fac_name].id, quantity=qty))
        room_objs.append(room)
    db.flush()
    refs["rooms"] = room_objs
    refs["fac_map"] = fac_map

    # Subject requirements (lab subjects)
    chem = next(s for s in subject_objs if s.code == "CHEM")
    bio = next(s for s in subject_objs if s.code == "BIO")
    phy = next(s for s in subject_objs if s.code == "PHY")
    cs = next(s for s in subject_objs if s.code == "CS")
    art = next(s for s in subject_objs if s.code == "ART")
    music = next(s for s in subject_objs if s.code == "MUS")
    pe = next(s for s in subject_objs if s.code == "PE")

    req_defs = [
        (chem.id, fac_map["Bunsen Burners"].id, 10, True),
        (chem.id, fac_map["Fume Hood"].id, 1, True),
        (bio.id,  fac_map["Microscopes"].id, 15, True),
        (phy.id,  fac_map["Bunsen Burners"].id, 5, False),
        (cs.id,   fac_map["Computers"].id, 20, True),
        (art.id,  fac_map["Art Sink"].id, 1, True),
        (music.id, fac_map["Piano"].id, 1, True),
        (pe.id,   fac_map["Sports Equipment"].id, 1, True),
    ]
    for subject_id, facility_id, min_qty, mandatory in req_defs:
        db.add(SubjectRequirement(
            subject_id=subject_id,
            facility_id=facility_id,
            min_quantity=min_qty,
            is_mandatory=mandatory,
        ))

    # Time slots
    ts_objs = []
    for ts in TIME_SLOTS:
        obj = TimeSlot(**ts)
        db.add(obj)
        ts_objs.append(obj)
    db.flush()
    refs["time_slots"] = ts_objs

    # Pay grades + components
    pg_objs = []
    for pg in PAY_GRADES:
        obj = PayGrade(**pg)
        db.add(obj)
        pg_objs.append(obj)
    db.flush()
    refs["pay_grades"] = pg_objs

    pc_objs = []
    for pc in PAY_COMPONENTS:
        obj = PayComponent(**pc)
        db.add(obj)
        pc_objs.append(obj)
    db.flush()
    refs["pay_components"] = pc_objs

    # System config
    db.add(SystemConfig(key="currency",        value=settings.DEFAULT_CURRENCY))
    db.add(SystemConfig(key="currency_symbol", value=settings.CURRENCY_SYMBOL))
    db.add(SystemConfig(key="school_name",     value=settings.APP_NAME))
    db.add(SystemConfig(key="school_type",     value=settings.SCHOOL_TYPE))
    db.add(SystemConfig(key="school_country",  value=settings.SCHOOL_COUNTRY))
    db.add(SystemConfig(key="grades_offered",  value="Primary 1 – Secondary 5"))
    db.flush()

    return refs


def _seed_demo(db: Session, refs: dict):
    from seeds.demo.users import seed_users
    from seeds.demo.academic import seed_academic
    from seeds.demo.fees import seed_fees
    from seeds.demo.payroll import seed_payroll
    from seeds.demo.schedule import seed_schedule, seed_attendance_from_schedule

    user_data = seed_users(db, refs["subjects"])

    teachers = [t for t, _ in user_data["teachers"]]
    teacher_users = [t.user for t in teachers]
    teachers_with_subjects = user_data["teachers"]
    staff_users = user_data["staff"]
    students = user_data["students"]

    academic_data = seed_academic(
        db,
        refs["subjects"],
        students,
        teachers_with_subjects,
        refs["time_slots"],
    )

    current_term = academic_data["current_term"]
    admin_user = next(u for u in staff_users if u.role.value == "admin")
    headmaster_user = next(u for u in staff_users if u.role.value == "headmaster")

    print("  Building timetable...")
    schedule = seed_schedule(db, current_term, admin_user.id)
    db.commit()

    print("  Seeding attendance records...")
    seed_attendance_from_schedule(db, schedule, admin_user.id, days_back=30)
    db.commit()

    seed_fees(db, students, current_term, admin_user.id, headmaster_user.id)
    seed_payroll(db, staff_users, teacher_users, refs["pay_grades"], refs["pay_components"],
                 current_term, admin_user.id)

    db.commit()
    print(f"Demo seed complete: {len(students)} students, {len(teachers)} teachers, "
          f"{len(staff_users)} staff seeded.")


def run_seed(db: Session, force: bool = False):
    if force:
        print("Clearing existing data...")
        _clear_all(db)

    print("Seeding base data...")
    refs = _seed_base(db)
    db.commit()

    if settings.is_demo:
        print("Seeding demo data...")
        _seed_demo(db, refs)
    else:
        # Production: just create a default headmaster account
        from app.models.users import User, Staff, UserRole
        from app.core.security import hash_password
        existing = db.query(User).filter(User.email == "admin@school.edu.sg").first()
        if not existing:
            user = User(
                email="admin@school.edu.sg",
                password_hash=hash_password("ChangeMe@123"),
                first_name="School",
                last_name="Administrator",
                role=UserRole.headmaster,
                is_active=True,
            )
            db.add(user)
            db.flush()
            db.add(Staff(user_id=user.id, department="Administration", employee_code="HM-001"))
            db.commit()
            print("Production seed complete. Default admin: admin@school.edu.sg / ChangeMe@123")


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        run_seed(db, force="--force" in sys.argv)
    finally:
        db.close()
