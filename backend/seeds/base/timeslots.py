from app.models.academic import DayOfWeek

DAYS = [DayOfWeek.monday, DayOfWeek.tuesday, DayOfWeek.wednesday, DayOfWeek.thursday, DayOfWeek.friday]

# 8 periods per day (7:30 AM – 3:30 PM, with a lunch break at period 5 skipped in scheduling)
PERIODS = [
    (1, "07:30", "08:15"),
    (2, "08:15", "09:00"),
    (3, "09:00", "09:45"),
    (4, "09:45", "10:30"),
    # period 5 = recess / break — not a teaching slot
    (5, "11:00", "11:45"),
    (6, "11:45", "12:30"),
    # period 7 = lunch
    (7, "13:30", "14:15"),
    (8, "14:15", "15:00"),
]

TIME_SLOTS = [
    {"day_of_week": day, "period_number": period, "start_time": start, "end_time": end}
    for day in DAYS
    for period, start, end in PERIODS
]
