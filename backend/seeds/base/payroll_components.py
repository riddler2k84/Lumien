from app.models.payroll import ComponentType

# Singapore CPF rates (employer + employee) simplified for demo
PAY_GRADES = [
    {"name": "Teaching Staff Grade 1",   "base_salary": 3200.00,  "currency": "SGD"},
    {"name": "Teaching Staff Grade 2",   "base_salary": 4000.00,  "currency": "SGD"},
    {"name": "Teaching Staff Grade 3",   "base_salary": 5200.00,  "currency": "SGD"},
    {"name": "Senior Teacher",           "base_salary": 6500.00,  "currency": "SGD"},
    {"name": "Head of Department",       "base_salary": 8000.00,  "currency": "SGD"},
    {"name": "Admin Staff Grade 1",      "base_salary": 2800.00,  "currency": "SGD"},
    {"name": "Admin Staff Grade 2",      "base_salary": 3600.00,  "currency": "SGD"},
    {"name": "Schedule Administrator",   "base_salary": 4200.00,  "currency": "SGD"},
    {"name": "Headmaster",               "base_salary": 12000.00, "currency": "SGD"},
]

PAY_COMPONENTS = [
    # Allowances
    {"name": "Transport Allowance",      "component_type": ComponentType.allowance, "is_percentage": False, "default_value": 100.00,  "description": "Monthly transport allowance"},
    {"name": "Housing Allowance",        "component_type": ComponentType.allowance, "is_percentage": False, "default_value": 300.00,  "description": "Monthly housing allowance"},
    {"name": "Professional Development", "component_type": ComponentType.allowance, "is_percentage": False, "default_value": 50.00,   "description": "Monthly PD allowance"},
    # Deductions
    {"name": "CPF Employee (20%)",       "component_type": ComponentType.deduction, "is_percentage": True,  "default_value": 20.00,   "description": "Employee CPF contribution"},
    {"name": "Income Tax",               "component_type": ComponentType.deduction, "is_percentage": True,  "default_value": 7.00,    "description": "Estimated monthly income tax"},
    {"name": "SDL",                      "component_type": ComponentType.deduction, "is_percentage": False, "default_value": 2.00,    "description": "Skills Development Levy"},
]
