from ortools.sat.python import cp_model
from sqlalchemy.orm import Session
from app.models.academic import ClassSection, TimeSlot, TeacherAvailability, TeacherSubject, SubjectRequirement
from app.models.rooms import Room, RoomFacility
from app.models.scheduling import ScheduleEntry
from app.models.users import Teacher


def run_solver(db: Session, schedule_id: int, academic_term_id: int, time_limit_seconds: int = 60) -> dict:
    model = cp_model.CpModel()

    sections = db.query(ClassSection).filter(ClassSection.academic_term_id == academic_term_id).all()
    time_slots = db.query(TimeSlot).all()
    teachers = db.query(Teacher).all()
    rooms = db.query(Room).filter(Room.is_active == True).all()

    if not sections or not time_slots or not teachers or not rooms:
        return {"feasible": False, "message": "Insufficient data to build schedule"}

    ts_ids = [ts.id for ts in time_slots]
    room_ids = [r.id for r in rooms]
    teacher_ids = [t.id for t in teachers]
    section_ids = [s.id for s in sections]

    # Index lookups
    ts_map = {ts.id: ts for ts in time_slots}
    room_map = {r.id: r for r in rooms}
    teacher_map = {t.id: t for t in teachers}
    section_map = {s.id: s for s in sections}

    # Teacher unavailability set
    unavailable = {
        (a.teacher_id, a.time_slot_id)
        for a in db.query(TeacherAvailability).filter(TeacherAvailability.is_available == False).all()
    }

    # Teacher -> qualified subject ids
    teacher_subjects: dict[int, set[int]] = {}
    for ts_row in db.query(TeacherSubject).all():
        teacher_subjects.setdefault(ts_row.teacher_id, set()).add(ts_row.subject_id)

    # Subject -> mandatory facility ids and min quantities
    subject_facilities: dict[int, list[tuple[int, int]]] = {}  # subject_id -> [(facility_id, min_qty)]
    for req in db.query(SubjectRequirement).filter(SubjectRequirement.is_mandatory == True).all():
        subject_facilities.setdefault(req.subject_id, []).append((req.facility_id, req.min_quantity))

    # Room -> {facility_id: quantity}
    room_facilities: dict[int, dict[int, int]] = {}
    for rf in db.query(RoomFacility).all():
        room_facilities.setdefault(rf.room_id, {})[rf.facility_id] = rf.quantity

    def room_satisfies_subject(room_id: int, subject_id: int) -> bool:
        reqs = subject_facilities.get(subject_id, [])
        if not reqs:
            return True
        rf = room_facilities.get(room_id, {})
        return all(rf.get(fid, 0) >= min_qty for fid, min_qty in reqs)

    # Decision variables: assign[section_id, time_slot_id, teacher_id, room_id] = bool
    # To keep the model tractable we pre-filter feasible combinations
    assigns: dict[tuple, cp_model.IntVar] = {}

    for section in sections:
        subject_id = section.subject_id
        required_periods = section.subject.required_weekly_periods

        feasible_teachers = [t_id for t_id in teacher_ids if subject_id in teacher_subjects.get(t_id, set())]
        feasible_rooms = [r_id for r_id in room_ids
                          if room_satisfies_subject(r_id, subject_id)
                          and room_map[r_id].capacity >= section.max_students]

        if not feasible_teachers or not feasible_rooms:
            return {
                "feasible": False,
                "message": f"No feasible teacher or room for section {section.section_name} ({section.subject.name})"
            }

        for ts_id in ts_ids:
            for t_id in feasible_teachers:
                if (t_id, ts_id) in unavailable:
                    continue
                for r_id in feasible_rooms:
                    key = (section.id, ts_id, t_id, r_id)
                    assigns[key] = model.new_bool_var(f"a_{section.id}_{ts_id}_{t_id}_{r_id}")

    # Each section must be assigned exactly required_weekly_periods slots
    for section in sections:
        subject_id = section.subject_id
        required_periods = section.subject.required_weekly_periods
        section_vars = [v for (s_id, ts_id, t_id, r_id), v in assigns.items() if s_id == section.id]
        model.add(sum(section_vars) == required_periods)

    # Each section can only be in one place per time slot
    for section in sections:
        for ts_id in ts_ids:
            slot_vars = [v for (s_id, t, t_id, r_id), v in assigns.items() if s_id == section.id and t == ts_id]
            if slot_vars:
                model.add(sum(slot_vars) <= 1)

    # No teacher double-booking per slot
    for t_id in teacher_ids:
        for ts_id in ts_ids:
            teacher_slot_vars = [v for (s_id, t, tid, r_id), v in assigns.items() if tid == t_id and t == ts_id]
            if teacher_slot_vars:
                model.add(sum(teacher_slot_vars) <= 1)

    # No room double-booking per slot
    for r_id in room_ids:
        for ts_id in ts_ids:
            room_slot_vars = [v for (s_id, t, t_id, rid), v in assigns.items() if rid == r_id and t == ts_id]
            if room_slot_vars:
                model.add(sum(room_slot_vars) <= 1)

    # Teacher weekly hours constraint
    for teacher in teachers:
        teacher_vars = [v for (s_id, ts_id, t_id, r_id), v in assigns.items() if t_id == teacher.id]
        if teacher_vars:
            model.add(sum(teacher_vars) <= teacher.max_weekly_hours)

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit_seconds
    solver.parameters.num_search_workers = 4
    status = solver.solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return {"feasible": False, "message": f"Solver status: {solver.status_name(status)}"}

    # Write results to DB
    entries = []
    for (s_id, ts_id, t_id, r_id), var in assigns.items():
        if solver.value(var):
            entries.append(ScheduleEntry(
                schedule_id=schedule_id,
                class_section_id=s_id,
                teacher_id=t_id,
                room_id=r_id,
                time_slot_id=ts_id,
            ))

    db.bulk_save_objects(entries)
    db.commit()

    return {"feasible": True, "entries": len(entries)}
