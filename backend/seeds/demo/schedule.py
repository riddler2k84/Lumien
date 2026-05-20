"""
Greedy demo schedule builder — no OR-Tools needed.
Assigns teacher + room + time slot to every class section using a greedy round-robin.
Guarantees: no teacher double-booking, no room double-booking, no section double-booking.
"""
import random
from datetime import date, timedelta
from collections import defaultdict

from app.models.scheduling import Schedule, ScheduleEntry, ScheduleStatus
from app.models.academic import ClassSection, TimeSlot, TeacherSubject, SubjectRequirement
from app.models.rooms import Room, RoomFacility
from app.models.users import Teacher
from app.models.attendance import AttendanceSession, AttendanceRecord, AttendanceStatus, SessionStatus

random.seed(99)

WEEKDAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday"]


def _room_ok(room: Room, subject_id: int, section_max: int, subject_facility_reqs: dict) -> bool:
    if room.capacity < section_max:
        return False
    reqs = subject_facility_reqs.get(subject_id, [])
    room_facs = {rf.facility_id: rf.quantity for rf in room.facilities}
    return all(room_facs.get(fid, 0) >= min_qty for fid, min_qty, mandatory in reqs if mandatory)


def seed_schedule(db, current_term, admin_user_id: int) -> Schedule:
    # Load all data
    sections = db.query(ClassSection).filter(ClassSection.academic_term_id == current_term.id).all()
    time_slots = db.query(TimeSlot).order_by(TimeSlot.day_of_week, TimeSlot.period_number).all()
    teachers = db.query(Teacher).all()
    rooms = db.query(Room).filter(Room.is_active == True).all()

    # Build lookup tables
    teacher_subjects: dict[int, set[int]] = defaultdict(set)
    for ts in db.query(TeacherSubject).all():
        teacher_subjects[ts.teacher_id].add(ts.subject_id)

    subject_facility_reqs: dict[int, list] = defaultdict(list)
    for req in db.query(SubjectRequirement).all():
        subject_facility_reqs[req.subject_id].append((req.facility_id, req.min_quantity, req.is_mandatory))

    # Track occupied slots
    teacher_busy: set[tuple[int, int]] = set()   # (teacher_id, ts_id)
    room_busy: set[tuple[int, int]] = set()       # (room_id, ts_id)
    section_busy: set[tuple[int, int]] = set()    # (section_id, ts_id)
    # Track that students in same grade+section_letter don't have 2 classes at once
    grade_section_busy: set[tuple[str, int]] = set()  # ("7A", ts_id)

    # Create schedule record
    schedule = Schedule(
        academic_term_id=current_term.id,
        status=ScheduleStatus.active,
        created_by=admin_user_id,
        approved_by=admin_user_id,
    )
    db.add(schedule)
    db.flush()

    entries = []
    unscheduled = []

    for section in sections:
        subject_id = section.subject_id
        required = section.subject.required_weekly_periods
        grade_sec_key = section.section_name  # e.g. "7A"

        # Find qualified teachers for this subject
        qualified_teachers = [t for t in teachers if subject_id in teacher_subjects[t.id]]
        if not qualified_teachers:
            unscheduled.append(section.section_name + "/" + section.subject.code)
            continue

        # Find suitable rooms
        suitable_rooms = [r for r in rooms if _room_ok(r, subject_id, section.max_students, subject_facility_reqs)]
        if not suitable_rooms:
            # Fallback: any room with enough capacity
            suitable_rooms = [r for r in rooms if r.capacity >= section.max_students]
        if not suitable_rooms:
            unscheduled.append(section.section_name + "/" + section.subject.code)
            continue

        periods_assigned = 0
        # Shuffle slots each section for variety
        shuffled_slots = time_slots[:]
        random.shuffle(shuffled_slots)

        for ts in shuffled_slots:
            if periods_assigned >= required:
                break

            ts_id = ts.id
            if (section.id, ts_id) in section_busy:
                continue
            if (grade_sec_key, ts_id) in grade_section_busy:
                continue

            # Find a free teacher
            teacher = next(
                (t for t in qualified_teachers if (t.id, ts_id) not in teacher_busy),
                None
            )
            if not teacher:
                continue

            # Find a free room
            room = next(
                (r for r in suitable_rooms if (r.id, ts_id) not in room_busy),
                None
            )
            if not room:
                continue

            # Assign
            teacher_busy.add((teacher.id, ts_id))
            room_busy.add((room.id, ts_id))
            section_busy.add((section.id, ts_id))
            grade_section_busy.add((grade_sec_key, ts_id))

            entries.append(ScheduleEntry(
                schedule_id=schedule.id,
                class_section_id=section.id,
                teacher_id=teacher.id,
                room_id=room.id,
                time_slot_id=ts_id,
            ))
            periods_assigned += 1

        if periods_assigned < required:
            unscheduled.append(f"{section.section_name}/{section.subject.code} ({periods_assigned}/{required})")

    db.bulk_save_objects(entries)
    db.flush()

    if unscheduled:
        print(f"  Warning: {len(unscheduled)} sections partially/un-scheduled (demo constraints)")

    print(f"  Schedule created: {len(entries)} entries across {len(sections)} sections")
    return schedule


def seed_attendance_from_schedule(db, schedule: Schedule, admin_user_id: int, days_back: int = 30):
    """Generate attendance sessions + records for the last N school days."""
    entries = db.query(ScheduleEntry).filter(ScheduleEntry.schedule_id == schedule.id).all()
    if not entries:
        return 0

    today = date.today()
    school_days = []
    d = today - timedelta(days=days_back)
    while d < today:
        if d.weekday() < 5:  # Mon-Fri
            school_days.append(d)
        d += timedelta(days=1)

    day_name_map = {i: name for i, name in enumerate(WEEKDAY_NAMES)}

    sessions_created = 0
    for entry in entries:
        slot_day = entry.time_slot.day_of_week.value
        for school_day in school_days:
            if day_name_map[school_day.weekday()] != slot_day:
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

            for enrollment in entry.class_section.enrollments:
                r = random.random()
                if r < 0.83:
                    status, mins = AttendanceStatus.present, None
                elif r < 0.90:
                    status, mins = AttendanceStatus.late, random.randint(5, 25)
                elif r < 0.97:
                    status, mins = AttendanceStatus.absent, None
                else:
                    status, mins = AttendanceStatus.excused, None

                db.add(AttendanceRecord(
                    attendance_session_id=session.id,
                    student_id=enrollment.student_id,
                    status=status,
                    minutes_late=mins,
                ))
            sessions_created += 1

    db.flush()
    print(f"  Attendance: {sessions_created} sessions seeded over {len(school_days)} school days")
    return sessions_created
