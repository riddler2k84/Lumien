import random
from datetime import date, timedelta
from app.models.academic import (
    AcademicTerm, ClassSection, TeacherSubject, TeacherAvailability, Enrollment, TimeSlot
)

random.seed(42)

GRADE_LEVELS = list(range(1, 13))
SECTIONS = ["A", "B", "C"]


def seed_academic(db, subjects: list, students: list, teachers_with_subjects: list, time_slots: list) -> dict:
    created = {}

    # --- Academic Terms (current + 1 past) ---
    terms = [
        AcademicTerm(
            name="2025 Semester 2",
            school_year="2025",
            start_date=date(2025, 7, 7),
            end_date=date(2025, 11, 28),
            is_active=False,
        ),
        AcademicTerm(
            name="2026 Semester 1",
            school_year="2026",
            start_date=date(2026, 1, 5),
            end_date=date(2026, 5, 29),
            is_active=True,
        ),
    ]
    for t in terms:
        db.add(t)
    db.flush()
    current_term = terms[1]
    created["terms"] = terms
    created["current_term"] = current_term

    # --- Teacher Subjects ---
    for teacher, teacher_subjects in teachers_with_subjects:
        for subject in teacher_subjects:
            db.add(TeacherSubject(teacher_id=teacher.id, subject_id=subject.id))
    db.flush()

    # --- Teacher Availability (5% slots marked unavailable per teacher) ---
    for teacher, _ in teachers_with_subjects:
        unavailable_slots = random.sample(time_slots, k=max(1, len(time_slots) // 20))
        for ts in unavailable_slots:
            db.add(TeacherAvailability(teacher_id=teacher.id, time_slot_id=ts.id, is_available=False))
    db.flush()

    # --- Class Sections ---
    subject_by_grade: dict[int, list] = {}
    for subject in subjects:
        for grade in range(subject.grade_level_min, subject.grade_level_max + 1):
            subject_by_grade.setdefault(grade, []).append(subject)

    sections = []
    for grade in GRADE_LEVELS:
        for section_letter in SECTIONS:
            grade_subjects = subject_by_grade.get(grade, [])
            for subject in grade_subjects:
                cs = ClassSection(
                    subject_id=subject.id,
                    academic_term_id=current_term.id,
                    section_name=f"{grade}{section_letter}",
                    grade_level=grade,
                    max_students=30,
                )
                db.add(cs)
                sections.append((grade, section_letter, subject, cs))
    db.flush()
    created["sections"] = sections

    # --- Enrollments: each student enrolls in all subjects for their grade+section ---
    students_by_grade_section: dict[tuple, list] = {}
    idx = 0
    for grade in GRADE_LEVELS:
        for section_letter in SECTIONS:
            grade_students = students[idx: idx + 30]
            students_by_grade_section[(grade, section_letter)] = grade_students
            idx += 30

    enrollment_date = date(2026, 1, 5)
    for grade, section_letter, subject, cs in sections:
        grade_section_students = students_by_grade_section.get((grade, section_letter), [])
        for student in grade_section_students:
            db.add(Enrollment(student_id=student.id, class_section_id=cs.id, enrolled_at=enrollment_date))
    db.flush()

    created["students_by_grade_section"] = students_by_grade_section
    return created
