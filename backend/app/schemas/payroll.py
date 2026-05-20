from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal
from app.models.payroll import PayPeriodStatus, PayslipStatus, ComponentType


class PayGradeResponse(BaseModel):
    id: int
    name: str
    base_salary: Decimal
    currency: str

    model_config = {"from_attributes": True}


class PayPeriodResponse(BaseModel):
    id: int
    name: str
    start_date: date
    end_date: date
    pay_date: date
    status: PayPeriodStatus

    model_config = {"from_attributes": True}


class PayslipLineItemResponse(BaseModel):
    id: int
    pay_component_id: int
    component_type: ComponentType
    amount: Decimal

    model_config = {"from_attributes": True}


class PayslipResponse(BaseModel):
    id: int
    user_id: int
    pay_period_id: int
    base_salary: Decimal
    total_allowances: Decimal
    total_deductions: Decimal
    net_pay: Decimal
    status: PayslipStatus
    approved_by: Optional[int]
    approved_at: Optional[datetime]
    line_items: List[PayslipLineItemResponse] = []

    model_config = {"from_attributes": True}


class RunPayrollRequest(BaseModel):
    pay_period_id: int
