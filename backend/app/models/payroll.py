import enum
from sqlalchemy import Column, Integer, String, Enum, ForeignKey, DateTime, Date, Text, Numeric, Boolean, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class PayPeriodStatus(str, enum.Enum):
    open = "open"
    processing = "processing"
    paid = "paid"
    closed = "closed"


class PayslipStatus(str, enum.Enum):
    draft = "draft"
    approved = "approved"
    paid = "paid"


class ComponentType(str, enum.Enum):
    allowance = "allowance"
    deduction = "deduction"


class PayGrade(Base):
    __tablename__ = "pay_grades"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    base_salary = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(10), default="SGD", nullable=False)

    employee_pay = relationship("EmployeePay", back_populates="pay_grade")


class EmployeePay(Base):
    __tablename__ = "employee_pay"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    pay_grade_id = Column(Integer, ForeignKey("pay_grades.id"), nullable=False)
    effective_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)

    user = relationship("User")
    pay_grade = relationship("PayGrade", back_populates="employee_pay")


class PayComponent(Base):
    __tablename__ = "pay_components"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text)
    component_type = Column(Enum(ComponentType), nullable=False)
    is_percentage = Column(Boolean, default=False, nullable=False)
    default_value = Column(Numeric(12, 4), nullable=False)  # amount or % rate

    employee_overrides = relationship("EmployeePayComponent", back_populates="pay_component")
    payslip_line_items = relationship("PayslipLineItem", back_populates="pay_component")


class EmployeePayComponent(Base):
    __tablename__ = "employee_pay_components"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    pay_component_id = Column(Integer, ForeignKey("pay_components.id"), nullable=False)
    override_value = Column(Numeric(12, 4), nullable=True)  # null = use default

    __table_args__ = (UniqueConstraint("user_id", "pay_component_id"),)

    user = relationship("User")
    pay_component = relationship("PayComponent", back_populates="employee_overrides")


class PayPeriod(Base):
    __tablename__ = "pay_periods"

    id = Column(Integer, primary_key=True, index=True)
    academic_term_id = Column(Integer, ForeignKey("academic_terms.id"), nullable=True)
    name = Column(String(100), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    pay_date = Column(Date, nullable=False)
    status = Column(Enum(PayPeriodStatus), default=PayPeriodStatus.open, nullable=False)

    academic_term = relationship("AcademicTerm", back_populates="payroll_periods")
    payslips = relationship("Payslip", back_populates="pay_period")


class Payslip(Base):
    __tablename__ = "payslips"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    pay_period_id = Column(Integer, ForeignKey("pay_periods.id"), nullable=False)
    base_salary = Column(Numeric(12, 2), nullable=False)
    total_allowances = Column(Numeric(12, 2), default=0, nullable=False)
    total_deductions = Column(Numeric(12, 2), default=0, nullable=False)
    net_pay = Column(Numeric(12, 2), nullable=False)
    status = Column(Enum(PayslipStatus), default=PayslipStatus.draft, nullable=False)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (UniqueConstraint("user_id", "pay_period_id"),)

    user = relationship("User", foreign_keys=[user_id], back_populates=None)
    pay_period = relationship("PayPeriod", back_populates="payslips")
    approver = relationship("User", foreign_keys=[approved_by])
    line_items = relationship("PayslipLineItem", back_populates="payslip", cascade="all, delete-orphan")


class PayslipLineItem(Base):
    __tablename__ = "payslip_line_items"

    id = Column(Integer, primary_key=True, index=True)
    payslip_id = Column(Integer, ForeignKey("payslips.id"), nullable=False)
    pay_component_id = Column(Integer, ForeignKey("pay_components.id"), nullable=False)
    component_type = Column(Enum(ComponentType), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)

    payslip = relationship("Payslip", back_populates="line_items")
    pay_component = relationship("PayComponent", back_populates="payslip_line_items")
