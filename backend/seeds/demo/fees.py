import random
from datetime import date, timedelta
from decimal import Decimal
from app.models.fees import (
    FeeCategory, FeeStructure, Invoice, InvoiceLineItem,
    Payment, ScholarshipDiscount, InvoiceStatus, PaymentMethod, DiscountType
)

random.seed(42)

FEE_CATEGORIES = [
    {"name": "Tuition Fee",      "description": "Monthly tuition fee"},
    {"name": "Lab Fee",          "description": "Science laboratory usage fee"},
    {"name": "Computer Lab Fee", "description": "Computer lab usage fee"},
    {"name": "Activity Fee",     "description": "Co-curricular and sports activities"},
    {"name": "Exam Fee",         "description": "Assessment and examination fee"},
    {"name": "Library Fee",      "description": "Library access and resources"},
]

TUITION_BY_GRADE = {
    1: 800, 2: 800, 3: 850, 4: 850, 5: 900, 6: 900,
    7: 1100, 8: 1100, 9: 1200, 10: 1200, 11: 1300, 12: 1300,
}


def seed_fees(db, students: list, current_term, admin_user_id: int, headmaster_user_id: int):
    # Categories
    cat_map = {}
    for cat_data in FEE_CATEGORIES:
        cat = FeeCategory(**cat_data)
        db.add(cat)
        db.flush()
        cat_map[cat_data["name"]] = cat

    # Fee structures per grade
    due_date = current_term.end_date - timedelta(days=30)
    for grade in range(1, 13):
        db.add(FeeStructure(
            academic_term_id=current_term.id,
            grade_level=grade,
            fee_category_id=cat_map["Tuition Fee"].id,
            amount=Decimal(str(TUITION_BY_GRADE[grade])),
            due_date=due_date,
        ))
        db.add(FeeStructure(
            academic_term_id=current_term.id,
            grade_level=grade,
            fee_category_id=cat_map["Activity Fee"].id,
            amount=Decimal("80.00"),
            due_date=due_date,
        ))
        db.add(FeeStructure(
            academic_term_id=current_term.id,
            grade_level=grade,
            fee_category_id=cat_map["Exam Fee"].id,
            amount=Decimal("50.00"),
            due_date=due_date,
        ))
        db.add(FeeStructure(
            academic_term_id=current_term.id,
            grade_level=grade,
            fee_category_id=cat_map["Library Fee"].id,
            amount=Decimal("20.00"),
            due_date=due_date,
        ))
        if grade >= 7:
            db.add(FeeStructure(
                academic_term_id=current_term.id,
                grade_level=grade,
                fee_category_id=cat_map["Lab Fee"].id,
                amount=Decimal("60.00"),
                due_date=due_date,
            ))
        if grade >= 4:
            db.add(FeeStructure(
                academic_term_id=current_term.id,
                grade_level=grade,
                fee_category_id=cat_map["Computer Lab Fee"].id,
                amount=Decimal("40.00"),
                due_date=due_date,
            ))
    db.flush()

    # Scholarships (~5% of students)
    scholarship_students = random.sample(students, k=max(1, len(students) // 20))
    for student in scholarship_students:
        db.add(ScholarshipDiscount(
            student_id=student.id,
            name=random.choice(["Merit Scholarship", "Financial Aid", "Sibling Discount", "Excellence Award"]),
            discount_type=random.choice([DiscountType.fixed, DiscountType.percentage]),
            amount=Decimal(str(random.choice([100, 150, 200, 10, 15, 20]))),
            academic_term_id=current_term.id,
            approved_by=headmaster_user_id,
        ))
    db.flush()

    # Invoices per student
    scholarship_set = {s.id for s in scholarship_students}
    for student in students:
        grade = student.grade_level
        tuition = Decimal(str(TUITION_BY_GRADE[grade]))
        activity = Decimal("80.00")
        exam = Decimal("50.00")
        library = Decimal("20.00")
        lab = Decimal("60.00") if grade >= 7 else Decimal("0")
        computer = Decimal("40.00") if grade >= 4 else Decimal("0")
        total = tuition + activity + exam + library + lab + computer

        discount = Decimal("0")
        if student.id in scholarship_set:
            discount = Decimal("100.00")  # simplified fixed discount

        outstanding = total - discount
        r = random.random()
        if r < 0.60:
            paid = outstanding
            status = InvoiceStatus.paid
        elif r < 0.80:
            paid = round(outstanding * Decimal(str(random.uniform(0.3, 0.9))), 2)
            status = InvoiceStatus.partial
        elif r < 0.90:
            paid = Decimal("0")
            status = InvoiceStatus.unpaid
        else:
            paid = Decimal("0")
            status = InvoiceStatus.overdue

        invoice = Invoice(
            student_id=student.id,
            academic_term_id=current_term.id,
            total_amount=total,
            discount_amount=discount,
            amount_paid=paid,
            amount_outstanding=outstanding - paid,
            due_date=due_date,
            status=status,
        )
        db.add(invoice)
        db.flush()

        # Line items
        line_defs = [
            (cat_map["Tuition Fee"], f"Tuition Fee — Grade {grade}", tuition),
            (cat_map["Activity Fee"], "Activity & Sports Fee", activity),
            (cat_map["Exam Fee"], "Examination Fee", exam),
            (cat_map["Library Fee"], "Library Fee", library),
        ]
        if grade >= 7:
            line_defs.append((cat_map["Lab Fee"], "Science Laboratory Fee", lab))
        if grade >= 4:
            line_defs.append((cat_map["Computer Lab Fee"], "Computer Lab Fee", computer))

        for cat, desc, amt in line_defs:
            if amt > 0:
                db.add(InvoiceLineItem(invoice_id=invoice.id, fee_category_id=cat.id, description=desc, amount=amt))

        # Payment record if paid/partial
        if paid > 0:
            method = random.choice(list(PaymentMethod))
            db.add(Payment(
                invoice_id=invoice.id,
                amount=paid,
                payment_date=current_term.start_date + timedelta(days=random.randint(1, 30)),
                method=method,
                reference_number=f"PAY-{student.id:05d}-{current_term.id}",
                received_by=admin_user_id,
            ))

    db.flush()
