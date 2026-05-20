import random
from datetime import date, timedelta
from faker import Faker
from app.core.security import hash_password
from app.models.users import User, Student, Teacher, Parent, Staff, ParentStudent, UserRole, ParentRelationship

fake = Faker("en_GB")
fake.seed_instance(42)
random.seed(42)

GRADE_LEVELS = list(range(1, 13))  # 1-12
SECTIONS = ["A", "B", "C"]
STUDENTS_PER_SECTION = 30


def seed_users(db, subjects: list) -> dict:
    created: dict = {"students": [], "teachers": [], "parents": [], "staff": []}

    # --- Staff (admin, headmaster, schedule_admin) ---
    staff_specs = [
        ("headmaster@school.edu.sg",   "headmaster",    UserRole.headmaster,     "Headmaster",       "HM-001"),
        ("admin1@school.edu.sg",       "admin",         UserRole.admin,          "Administration",   "ADM-001"),
        ("admin2@school.edu.sg",       "admin",         UserRole.admin,          "Finance",          "ADM-002"),
        ("admin3@school.edu.sg",       "admin",         UserRole.admin,          "Student Affairs",  "ADM-003"),
        ("schedadmin1@school.edu.sg",  "schedadmin",    UserRole.schedule_admin, "Timetabling",      "SA-001"),
        ("schedadmin2@school.edu.sg",  "schedadmin",    UserRole.schedule_admin, "Timetabling",      "SA-002"),
        ("finance@school.edu.sg",      "finance",       UserRole.admin,          "Finance",          "ADM-004"),
        ("hr@school.edu.sg",           "hrstaff",       UserRole.admin,          "HR",               "ADM-005"),
    ]
    for email, pwd_base, role, dept, emp_code in staff_specs:
        user = User(
            email=email,
            password_hash=hash_password("Demo@" + pwd_base.capitalize() + "1"),
            first_name=fake.first_name(),
            last_name=fake.last_name(),
            role=role,
            is_active=True,
        )
        db.add(user)
        db.flush()
        staff = Staff(user_id=user.id, department=dept, employee_code=emp_code)
        db.add(staff)
        created["staff"].append(user)

    # --- Teachers (50) ---
    subject_codes = [s.code for s in subjects]
    teacher_subject_map = {}  # teacher_id -> list of subject objects

    for i in range(1, 51):
        user = User(
            email=f"teacher{i:02d}@school.edu.sg",
            password_hash=hash_password("Demo@Teacher1"),
            first_name=fake.first_name(),
            last_name=fake.last_name(),
            role=UserRole.teacher,
            is_active=True,
        )
        db.add(user)
        db.flush()
        teacher = Teacher(
            user_id=user.id,
            max_weekly_hours=random.choice([25, 28, 30]),
            employee_code=f"TCH-{i:03d}",
        )
        db.add(teacher)
        db.flush()
        # Assign 1-3 subjects per teacher
        teacher_subjects = random.sample(subjects, k=random.randint(1, 3))
        teacher_subject_map[teacher.id] = teacher_subjects
        created["teachers"].append((teacher, teacher_subjects))

    # --- Students and Parents ---
    student_num = 1
    for grade in GRADE_LEVELS:
        for section in SECTIONS:
            for _ in range(STUDENTS_PER_SECTION):
                gender = random.choice(["M", "F"])
                first_name = fake.first_name_male() if gender == "M" else fake.first_name_female()
                user = User(
                    email=f"student{student_num:04d}@school.edu.sg",
                    password_hash=hash_password("Demo@Student1"),
                    first_name=first_name,
                    last_name=fake.last_name(),
                    role=UserRole.student,
                    is_active=True,
                )
                db.add(user)
                db.flush()
                enrollment_date = date(2020, 1, 8) + timedelta(days=random.randint(0, 365))
                student = Student(
                    user_id=user.id,
                    grade_level=grade,
                    enrollment_date=enrollment_date,
                    student_code=f"S{student_num:05d}",
                )
                db.add(student)
                db.flush()
                created["students"].append(student)
                student_num += 1

    # --- Parents (pair students, siblings share parents ~20% of time) ---
    students = created["students"]
    parent_num = 1
    assigned = set()

    for i, student in enumerate(students):
        if student.id in assigned:
            continue

        parent_user = User(
            email=f"parent{parent_num:04d}@example.com",
            password_hash=hash_password("Demo@Parent1"),
            first_name=fake.first_name(),
            last_name=student.user.last_name,
            role=UserRole.parent,
            is_active=True,
        )
        db.add(parent_user)
        db.flush()
        parent = Parent(user_id=parent_user.id, phone=fake.phone_number())
        db.add(parent)
        db.flush()
        created["parents"].append(parent)

        rel = random.choice([ParentRelationship.mother, ParentRelationship.father])
        db.add(ParentStudent(parent_id=parent.id, student_id=student.id, relationship_type=rel))
        assigned.add(student.id)

        # ~20% chance: link a sibling (another student with same last name)
        if random.random() < 0.2 and i + 1 < len(students):
            sibling = students[i + 1]
            if sibling.id not in assigned:
                db.add(ParentStudent(parent_id=parent.id, student_id=sibling.id, relationship_type=rel))
                assigned.add(sibling.id)

        parent_num += 1

    db.flush()
    return created
