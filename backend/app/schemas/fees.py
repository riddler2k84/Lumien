from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal
from app.models.fees import InvoiceStatus, PaymentMethod, DiscountType


class FeeCategoryResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]

    model_config = {"from_attributes": True}


class FeeStructureResponse(BaseModel):
    id: int
    academic_term_id: int
    grade_level: int
    fee_category_id: int
    amount: Decimal
    due_date: date

    model_config = {"from_attributes": True}


class InvoiceLineItemResponse(BaseModel):
    id: int
    fee_category_id: int
    description: str
    amount: Decimal

    model_config = {"from_attributes": True}


class PaymentCreate(BaseModel):
    invoice_id: int
    amount: Decimal
    payment_date: date
    method: PaymentMethod
    reference_number: Optional[str] = None
    notes: Optional[str] = None


class PaymentResponse(BaseModel):
    id: int
    invoice_id: int
    amount: Decimal
    payment_date: date
    method: PaymentMethod
    reference_number: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class InvoiceResponse(BaseModel):
    id: int
    student_id: int
    academic_term_id: int
    total_amount: Decimal
    discount_amount: Decimal
    amount_paid: Decimal
    amount_outstanding: Decimal
    due_date: date
    status: InvoiceStatus
    issued_at: datetime
    line_items: List[InvoiceLineItemResponse] = []
    payments: List[PaymentResponse] = []

    model_config = {"from_attributes": True}


class ScholarshipCreate(BaseModel):
    student_id: int
    name: str
    discount_type: DiscountType
    amount: Decimal
    academic_term_id: int


class ScholarshipResponse(BaseModel):
    id: int
    student_id: int
    name: str
    discount_type: DiscountType
    amount: Decimal
    academic_term_id: int
    approved_by: int

    model_config = {"from_attributes": True}
