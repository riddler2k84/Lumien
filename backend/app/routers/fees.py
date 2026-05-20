from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.fees import Invoice, Payment, ScholarshipDiscount, InvoiceStatus
from app.models.users import User
from app.schemas.fees import InvoiceResponse, PaymentCreate, PaymentResponse, ScholarshipCreate, ScholarshipResponse

router = APIRouter(prefix="/api/fees", tags=["fees"])


@router.get("/invoices", response_model=List[InvoiceResponse])
def list_invoices(
    student_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Invoice)
    if current_user.role.value == "student":
        q = q.filter(Invoice.student_id == current_user.student_profile.id)
    elif current_user.role.value == "parent":
        child_ids = [ps.student_id for ps in current_user.parent_profile.student_links]
        q = q.filter(Invoice.student_id.in_(child_ids))
    elif student_id:
        q = q.filter(Invoice.student_id == student_id)
    return q.all()


@router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(invoice_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    invoice = db.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(404, "Invoice not found")
    return invoice


@router.post("/payments", response_model=PaymentResponse)
def record_payment(
    payload: PaymentCreate,
    current_user: User = Depends(require_roles("admin", "headmaster")),
    db: Session = Depends(get_db),
):
    invoice = db.get(Invoice, payload.invoice_id)
    if not invoice:
        raise HTTPException(404, "Invoice not found")

    payment = Payment(**payload.model_dump(), received_by=current_user.id)
    db.add(payment)

    invoice.amount_paid = float(invoice.amount_paid) + float(payload.amount)
    invoice.amount_outstanding = float(invoice.total_amount) - float(invoice.discount_amount) - float(invoice.amount_paid)
    if invoice.amount_outstanding <= 0:
        invoice.status = InvoiceStatus.paid
    else:
        invoice.status = InvoiceStatus.partial

    db.commit()
    db.refresh(payment)
    return payment


@router.post("/scholarships", response_model=ScholarshipResponse)
def create_scholarship(
    payload: ScholarshipCreate,
    current_user: User = Depends(require_roles("headmaster", "admin")),
    db: Session = Depends(get_db),
):
    scholarship = ScholarshipDiscount(**payload.model_dump(), approved_by=current_user.id)
    db.add(scholarship)
    db.commit()
    db.refresh(scholarship)
    return scholarship


@router.get("/overdue")
def overdue_invoices(
    current_user: User = Depends(require_roles("admin", "headmaster")),
    db: Session = Depends(get_db),
):
    from datetime import date
    overdue = db.query(Invoice).filter(
        Invoice.status.in_([InvoiceStatus.unpaid, InvoiceStatus.partial]),
        Invoice.due_date < date.today(),
    ).all()
    for inv in overdue:
        if inv.status != InvoiceStatus.paid:
            inv.status = InvoiceStatus.overdue
    db.commit()
    return [{"invoice_id": i.id, "student_id": i.student_id, "outstanding": float(i.amount_outstanding)} for i in overdue]
