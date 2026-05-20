import enum
from sqlalchemy import Column, Integer, String, Enum, ForeignKey, DateTime, Date, Text, Numeric, Boolean, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class InvoiceStatus(str, enum.Enum):
    unpaid = "unpaid"
    partial = "partial"
    paid = "paid"
    overdue = "overdue"


class PaymentMethod(str, enum.Enum):
    cash = "cash"
    bank_transfer = "bank_transfer"
    card = "card"
    mobile_money = "mobile_money"


class DiscountType(str, enum.Enum):
    fixed = "fixed"
    percentage = "percentage"


class FeeCategory(Base):
    __tablename__ = "fee_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text)

    fee_structures = relationship("FeeStructure", back_populates="fee_category")
    invoice_line_items = relationship("InvoiceLineItem", back_populates="fee_category")


class FeeStructure(Base):
    __tablename__ = "fee_structures"

    id = Column(Integer, primary_key=True, index=True)
    academic_term_id = Column(Integer, ForeignKey("academic_terms.id"), nullable=False)
    grade_level = Column(Integer, nullable=False)
    fee_category_id = Column(Integer, ForeignKey("fee_categories.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True)  # null = applies to all subjects
    amount = Column(Numeric(12, 2), nullable=False)
    due_date = Column(Date, nullable=False)

    academic_term = relationship("AcademicTerm", back_populates="fee_structures")
    fee_category = relationship("FeeCategory", back_populates="fee_structures")
    subject = relationship("Subject", back_populates="fee_structures")


class ScholarshipDiscount(Base):
    __tablename__ = "scholarships_discounts"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    name = Column(String(200), nullable=False)
    discount_type = Column(Enum(DiscountType), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    academic_term_id = Column(Integer, ForeignKey("academic_terms.id"), nullable=False)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    student = relationship("Student", back_populates="scholarships")
    academic_term = relationship("AcademicTerm", back_populates="scholarships")
    approver = relationship("User", foreign_keys=[approved_by])


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    academic_term_id = Column(Integer, ForeignKey("academic_terms.id"), nullable=False)
    total_amount = Column(Numeric(12, 2), nullable=False)
    discount_amount = Column(Numeric(12, 2), default=0, nullable=False)
    amount_paid = Column(Numeric(12, 2), default=0, nullable=False)
    amount_outstanding = Column(Numeric(12, 2), nullable=False)
    due_date = Column(Date, nullable=False)
    status = Column(Enum(InvoiceStatus), default=InvoiceStatus.unpaid, nullable=False)
    issued_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (UniqueConstraint("student_id", "academic_term_id"),)

    student = relationship("Student", back_populates="invoices")
    academic_term = relationship("AcademicTerm", back_populates="invoices")
    line_items = relationship("InvoiceLineItem", back_populates="invoice", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="invoice")


class InvoiceLineItem(Base):
    __tablename__ = "invoice_line_items"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    fee_category_id = Column(Integer, ForeignKey("fee_categories.id"), nullable=False)
    description = Column(String(255), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)

    invoice = relationship("Invoice", back_populates="line_items")
    fee_category = relationship("FeeCategory", back_populates="invoice_line_items")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    payment_date = Column(Date, nullable=False)
    method = Column(Enum(PaymentMethod), nullable=False)
    reference_number = Column(String(100), unique=True, nullable=True)
    notes = Column(Text, nullable=True)
    received_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    invoice = relationship("Invoice", back_populates="payments")
    receiver = relationship("User", foreign_keys=[received_by])
