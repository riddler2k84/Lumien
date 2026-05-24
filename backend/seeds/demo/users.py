import random
from datetime import date
from app.core.security import hash_password
from app.models.users import User, Student, Teacher, Parent, Staff, ParentStudent, UserRole, ParentRelationship

random.seed(42)

GRADE_LEVELS         = list(range(1, 12))   # Primary 1–6 + Secondary 1–5
SECTIONS             = ["A"]                 # 1 section per grade
STUDENTS_PER_SECTION = 9                     # Total students: 11 × 1 × 9 = 99

# ── Pre-compute bcrypt hashes once to avoid ~200 redundant hashes ──────────────
_PW: dict[str, str] = {}

def _pw(key: str) -> str:
    if key not in _PW:
        _PW[key] = hash_password(key)
    return _PW[key]


# ── Malaysian Chinese names (80% of population) ────────────────────────────────
_CN_SURNAMES = [
    "Tan", "Lim", "Lee", "Ng", "Wong", "Chan", "Loh", "Goh", "Yap", "Ong",
    "Cheah", "Chew", "Teh", "Koh", "Leong", "Woo", "Foo", "Chong", "Yong", "Yeoh",
    "Ooi", "Teoh", "Lau", "Chin", "Chua", "Liew", "Low", "Ho", "Poh", "Sim",
    "Quah", "Heng", "Khor", "Beh", "Kong", "Khoo", "Chai", "Hoe", "Mah", "Phang",
]
_CN_MALE = [
    "Wei Ming", "Jian Wei", "Hao Chen", "Kai Jie", "Jun Hao", "Zhi Wei", "Rui Yang",
    "Xin Jie", "Bao Jun", "Cheng Wei", "Da Ming", "Fei Long", "Guang Jun", "Hong Wei",
    "Jun Kai", "Kang Wei", "Li Ming", "Ming Hao", "Peng Jun", "Wei Jie", "Xian Ming",
    "Yi Hao", "Zhao Jun", "Zi Ming", "An Jun", "Bo Wei", "Cai Jie", "De Ming",
    "En Hao", "Fu Jun", "Guo Wei", "Han Lin", "Jia Jun", "Ke Wei", "Long Fei",
    "Meng Hao", "Nian Jun", "Pei Wei", "Qi Ming", "Rong Jie", "Shao Wei",
]
_CN_FEMALE = [
    "Mei Ling", "Hui Lin", "Xiu Ying", "Jia Hui", "Wan Ying", "Xin Ru", "Li Ying",
    "Jing Wen", "Fang Ting", "Ya Wen", "Shu Ying", "Min Hui", "Qing Ling", "Rou Wei",
    "Shu Min", "Ting Ting", "Wan Lin", "Xiao Mei", "Yan Ting", "Zhi Yin", "Ai Lin",
    "Bi Ying", "Chun Mei", "Dan Ni", "En Qi", "Fei Yan", "Gui Ying", "Hong Ling",
    "Jia Ying", "Ke Xin", "Li Xin", "Mei Qi", "Nuo Xi", "Pei Yin", "Qi Ying",
    "Rui Xin", "Si Ying", "Tian Xin", "Wei Ling", "Xia Yin", "Yan Fang",
]

# ── Malaysian Indian / Tamil names (20% of population) ────────────────────────
_IN_SURNAMES = [
    "Rajan", "Kumar", "Muthu", "Krishnan", "Pillai", "Nair", "Raj",
    "Arumugam", "Ramasamy", "Chandran", "Sivakumar", "Balakrishnan",
    "Subramaniam", "Velayutham", "Naidu", "Menon", "Sundaram", "Murugan",
]
_IN_MALE = [
    "Raj", "Arjun", "Vikram", "Dinesh", "Suresh", "Ramesh", "Ganesh",
    "Prakash", "Anand", "Karthik", "Arun", "Deepak", "Mohan", "Naveen",
    "Ravi", "Senthil", "Vignesh", "Ashwin", "Balaji", "Chandra",
    "Dhanesh", "Elan", "Fenish", "Harish", "Irvin", "Jeyan",
]
_IN_FEMALE = [
    "Priya", "Kavitha", "Meena", "Anitha", "Deepa", "Nisha", "Saritha",
    "Radha", "Vimala", "Geetha", "Divya", "Lakshmi", "Parvathi", "Kamala",
    "Amala", "Bharathi", "Chitra", "Devi", "Eswari", "Janani",
    "Komala", "Lavanya", "Malathi", "Nanthini", "Oviya",
]


def _random_name(gender: str) -> tuple[str, str]:
    """Returns (first_name, last_name) — 80% Malaysian Chinese, 20% Malaysian Indian."""
    if random.random() < 0.8:
        first = random.choice(_CN_MALE if gender == "M" else _CN_FEMALE)
        last  = random.choice(_CN_SURNAMES)
    else:
        first = random.choice(_IN_MALE if gender == "M" else _IN_FEMALE)
        last  = random.choice(_IN_SURNAMES)
    return first, last


def _my_phone() -> str:
    """Random Malaysian mobile number (+60 1x-xxxxxxx)."""
    prefix = random.choice(["11", "12", "13", "14", "16", "17", "18", "19"])
    return f"+60 {prefix}-{random.randint(1_000_000, 9_999_999):07d}"


# ── Fixed staff specs (name, email, pwd_base, role, dept, emp_code) ───────────
_STAFF_SPECS = [
    #  first      last     email                        pwd_base      role                     dept              emp_code
    ("Katherine", "Puah",  "headmaster@school.edu.sg",  "headmaster", UserRole.headmaster,     "Headmaster",     "HM-001"),
    (None,        None,    "admin1@school.edu.sg",      "admin",      UserRole.admin,          "Administration", "ADM-001"),
    (None,        None,    "admin2@school.edu.sg",      "admin",      UserRole.admin,          "Finance",        "ADM-002"),
    (None,        None,    "schedadmin1@school.edu.sg", "schedadmin", UserRole.schedule_admin, "Timetabling",    "SA-001"),
    (None,        None,    "finance@school.edu.sg",     "finance",    UserRole.admin,          "Finance",        "ADM-003"),
]


def seed_users(db, subjects: list) -> dict:
    created: dict = {"students": [], "teachers": [], "parents": [], "staff": []}

    # ── Staff ──────────────────────────────────────────────────────────────────
    for first_name, last_name, email, pwd_base, role, dept, emp_code in _STAFF_SPECS:
        if first_name is None:
            gender = random.choice(["M", "F"])
            first_name, last_name = _random_name(gender)
        user = User(
            email=email,
            password_hash=_pw("Demo@" + pwd_base.capitalize() + "1"),
            first_name=first_name,
            last_name=last_name,
            role=role,
            is_active=True,
        )
        db.add(user)
        db.flush()
        db.add(Staff(user_id=user.id, department=dept, employee_code=emp_code))
        created["staff"].append(user)

    # ── Teachers (15) ──────────────────────────────────────────────────────────
    for i in range(1, 16):
        gender = random.choice(["M", "F"])
        first_name, last_name = _random_name(gender)
        user = User(
            email=f"teacher{i:02d}@school.edu.sg",
            password_hash=_pw("Demo@Teacher1"),
            first_name=first_name,
            last_name=last_name,
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
        teacher_subjects = random.sample(subjects, k=min(random.randint(1, 3), len(subjects)))
        created["teachers"].append((teacher, teacher_subjects))

    # ── Students and Parents ───────────────────────────────────────────────────
    student_num = 1
    for grade in GRADE_LEVELS:
        for section in SECTIONS:
            for _ in range(STUDENTS_PER_SECTION):
                gender = random.choice(["M", "F"])
                first_name, last_name = _random_name(gender)
                user = User(
                    email=f"student{student_num:04d}@school.edu.sg",
                    password_hash=_pw("Demo@Student1"),
                    first_name=first_name,
                    last_name=last_name,
                    role=UserRole.student,
                    is_active=True,
                )
                db.add(user)
                db.flush()
                student = Student(
                    user_id=user.id,
                    grade_level=grade,
                    enrollment_date=date(2026, 1, 5),
                    student_code=f"S{student_num:05d}",
                )
                db.add(student)
                db.flush()
                created["students"].append(student)
                student_num += 1

    # ── Parents (one per student, ~20% sibling sharing) ───────────────────────
    students   = created["students"]
    parent_num = 1
    assigned   = set()

    for i, student in enumerate(students):
        if student.id in assigned:
            continue

        gender = random.choice(["M", "F"])
        first_name, _ = _random_name(gender)
        last_name = student.user.last_name        # same family surname

        parent_user = User(
            email=f"parent{parent_num:04d}@example.com",
            password_hash=_pw("Demo@Parent1"),
            first_name=first_name,
            last_name=last_name,
            role=UserRole.parent,
            is_active=True,
        )
        db.add(parent_user)
        db.flush()
        parent = Parent(user_id=parent_user.id, phone=_my_phone())
        db.add(parent)
        db.flush()
        created["parents"].append(parent)

        rel = random.choice([ParentRelationship.mother, ParentRelationship.father])
        db.add(ParentStudent(parent_id=parent.id, student_id=student.id, relationship_type=rel))
        assigned.add(student.id)

        if random.random() < 0.2 and i + 1 < len(students):
            sibling = students[i + 1]
            if sibling.id not in assigned:
                db.add(ParentStudent(parent_id=parent.id, student_id=sibling.id, relationship_type=rel))
                assigned.add(sibling.id)

        parent_num += 1

    db.flush()
    return created
