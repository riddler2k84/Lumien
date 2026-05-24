from app.models.payroll import ComponentType

# ── Pay Grades (Malaysian Ringgit) ─────────────────────────────────────────────
PAY_GRADES = [
    {"name": "Teaching Staff Grade 1",   "base_salary":  3500.00, "currency": "MYR"},
    {"name": "Teaching Staff Grade 2",   "base_salary":  4500.00, "currency": "MYR"},
    {"name": "Teaching Staff Grade 3",   "base_salary":  5800.00, "currency": "MYR"},
    {"name": "Senior Teacher",           "base_salary":  7000.00, "currency": "MYR"},
    {"name": "Head of Department",       "base_salary":  8500.00, "currency": "MYR"},
    {"name": "Admin Staff Grade 1",      "base_salary":  2800.00, "currency": "MYR"},
    {"name": "Admin Staff Grade 2",      "base_salary":  3500.00, "currency": "MYR"},
    {"name": "Schedule Administrator",   "base_salary":  4200.00, "currency": "MYR"},
    {"name": "Headmaster",               "base_salary": 12000.00, "currency": "MYR"},
]

# ── Pay Components – Malaysian statutory deductions + allowances ───────────────
#   Employee deductions: EPF 11%, SOCSO 0.5%, EIS 0.2%, PCB (est. 8%)
#   Employer side is computed on-the-fly (EPF 13%, SOCSO 1.75%, EIS 0.2%) —
#   not stored as line items so they don't affect employee net_pay.
PAY_COMPONENTS = [
    # ── Allowances ─────────────────────────────────────────────────────────────
    {
        "name": "Transport Allowance",
        "component_type": ComponentType.allowance,
        "is_percentage": False,
        "default_value": 150.00,
        "description": "Monthly transport allowance",
    },
    {
        "name": "Housing Allowance",
        "component_type": ComponentType.allowance,
        "is_percentage": False,
        "default_value": 500.00,
        "description": "Monthly housing allowance",
    },
    {
        "name": "Professional Development",
        "component_type": ComponentType.allowance,
        "is_percentage": False,
        "default_value": 100.00,
        "description": "Monthly professional development allowance",
    },
    # ── Statutory Deductions – Employee ────────────────────────────────────────
    {
        "name": "EPF (Employee 11%)",
        "component_type": ComponentType.deduction,
        "is_percentage": True,
        "default_value": 11.00,
        "description": "Kumpulan Wang Simpanan Pekerja – employee 11% of basic salary",
    },
    {
        "name": "SOCSO (Employee 0.5%)",
        "component_type": ComponentType.deduction,
        "is_percentage": True,
        "default_value": 0.50,
        "description": "Pertubuhan Keselamatan Sosial – employee 0.5% (capped at RM 4,000 salary)",
    },
    {
        "name": "EIS (Employee 0.2%)",
        "component_type": ComponentType.deduction,
        "is_percentage": True,
        "default_value": 0.20,
        "description": "Employment Insurance System – employee 0.2% (capped at RM 4,000 salary)",
    },
    {
        "name": "PCB / Income Tax",
        "component_type": ComponentType.deduction,
        "is_percentage": True,
        "default_value": 8.00,
        "description": "Potongan Cukai Bulanan – monthly income tax withholding (estimated rate)",
    },
]
