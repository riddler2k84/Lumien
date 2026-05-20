ROOM_TYPES = [
    {"name": "Classroom",     "description": "Standard teaching classroom"},
    {"name": "Science Lab",   "description": "Laboratory for Biology, Chemistry, Physics"},
    {"name": "Computer Lab",  "description": "Computer lab for CS and digital learning"},
    {"name": "Gymnasium",     "description": "Indoor sports hall"},
    {"name": "Music Room",    "description": "Room with instruments for music lessons"},
    {"name": "Art Room",      "description": "Room with art supplies and sinks"},
    {"name": "Auditorium",    "description": "Large hall for assemblies and events"},
]

FACILITIES = [
    {"name": "Projector",        "description": "Digital projector / smartboard"},
    {"name": "Whiteboard",       "description": "Standard whiteboard"},
    {"name": "Computers",        "description": "Student desktop/laptop workstations"},
    {"name": "Bunsen Burners",   "description": "Gas burners for chemistry lab"},
    {"name": "Microscopes",      "description": "Optical microscopes for biology"},
    {"name": "Fume Hood",        "description": "Safety fume hood for chemistry"},
    {"name": "Piano",            "description": "Upright piano"},
    {"name": "Musical Instruments", "description": "General instrument set (drums, guitars)"},
    {"name": "Art Sink",         "description": "Deep sinks for art room"},
    {"name": "Sports Equipment", "description": "Balls, nets, mats for PE"},
    {"name": "Stage",            "description": "Raised stage platform"},
    {"name": "Air Conditioning", "description": "Central air conditioning"},
]

# (room_code, room_type_name, name, capacity, floor, building, facilities: [(facility_name, qty)])
ROOMS = [
    # Classrooms — 30 rooms
    *[
        (f"CR-{i:02d}", "Classroom", f"Classroom {i:02d}", 35, str((i - 1) // 10 + 1), "Block A",
         [("Projector", 1), ("Whiteboard", 1), ("Air Conditioning", 1)])
        for i in range(1, 31)
    ],
    # Science Labs — 4
    ("SL-01", "Science Lab", "Science Lab 1",   30, "2", "Block B", [("Microscopes", 30), ("Whiteboard", 1), ("Projector", 1)]),
    ("SL-02", "Science Lab", "Science Lab 2",   30, "2", "Block B", [("Bunsen Burners", 20), ("Fume Hood", 2), ("Whiteboard", 1)]),
    ("SL-03", "Science Lab", "Science Lab 3",   30, "3", "Block B", [("Bunsen Burners", 20), ("Microscopes", 15), ("Fume Hood", 2), ("Projector", 1)]),
    ("SL-04", "Science Lab", "Science Lab 4",   30, "3", "Block B", [("Microscopes", 30), ("Projector", 1), ("Whiteboard", 1)]),
    # Computer Labs — 2
    ("CL-01", "Computer Lab", "Computer Lab 1", 35, "1", "Block C", [("Computers", 35), ("Projector", 1), ("Whiteboard", 1), ("Air Conditioning", 1)]),
    ("CL-02", "Computer Lab", "Computer Lab 2", 35, "1", "Block C", [("Computers", 35), ("Projector", 1), ("Air Conditioning", 1)]),
    # Gymnasium — 1
    ("GYM-01", "Gymnasium", "Main Gymnasium",   200, "G", "Block D", [("Sports Equipment", 1)]),
    # Music Rooms — 2
    ("MR-01", "Music Room", "Music Room 1",     30, "2", "Block E", [("Piano", 1), ("Musical Instruments", 1), ("Whiteboard", 1)]),
    ("MR-02", "Music Room", "Music Room 2",     30, "2", "Block E", [("Piano", 1), ("Musical Instruments", 1)]),
    # Art Rooms — 2
    ("AR-01", "Art Room", "Art Room 1",         30, "3", "Block E", [("Art Sink", 4), ("Whiteboard", 1)]),
    ("AR-02", "Art Room", "Art Room 2",         30, "3", "Block E", [("Art Sink", 4)]),
    # Auditorium — 1
    ("AUD-01", "Auditorium", "Main Auditorium", 500, "G", "Block F", [("Stage", 1), ("Projector", 2), ("Air Conditioning", 1)]),
]
