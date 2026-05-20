import random
from datetime import date, timedelta
from app.models.attendance import AttendanceSession, AttendanceRecord, AttendanceStatus, SessionStatus
from app.models.scheduling import ScheduleEntry, Schedule, ScheduleStatus

random.seed(42)

WEEKDAYS = {0, 1, 2, 3, 4}  # Mon-Fri


def seed_attendance(db, schedule: Schedule, admin_user_id: int, days_back: int = 30):
    entries = db.query(ScheduleEntry).filter(ScheduleEntry.schedule_id == schedule.id).all()
    if not entries:
        return

    today = date.today()
    school_days = []
    d = today - timedelta(days=days_back)
    while d < today:
        if d.weekday() in WEEKDAYS:
            school_days.append(d)
        d += timedelta(days=1)

    sessions_created = 0
    for entry in entries:
        for school_day in school_days:
            if entry.time_slot.day_of_week.value != ["monday", "tuesday", "wednesday", "thursday", "friday"][school_day.weekday()]:
                continue

            session = AttendanceSession(
                schedule_entry_id=entry.id,
                class_section_id=entry.class_section_id,
                teacher_id=entry.teacher_id,
                time_slot_id=entry.time_slot_id,
                date=school_day,
                status=SessionStatus.marked,
                marked_by=admin_user_id,
            )
            db.add(session)
            db.flush()

            enrollments = entry.class_section.enrollments
            for enrollment in enrollments:
                r = random.random()
                if r < 0.85:
                    status = AttendanceStatus.present
                    mins_late = None
                elif r < 0.92:
                    status = AttendanceStatus.late
                    mins_late = random.randint(5, 30)
                elif r < 0.97:
                    status = AttendanceStatus.absent
                    mins_late = None
                else:
                    status = AttendanceStatus.excused
                    mins_late = None

                db.add(AttendanceRecord(
                    attendance_session_id=session.id,
                    student_id=enrollment.student_id,
                    status=status,
                    minutes_late=mins_late,
                ))
            sessions_created += 1

    db.flush()
    return sessions_created
