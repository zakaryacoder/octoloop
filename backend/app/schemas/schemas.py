from datetime import date, datetime
from typing import Generic, List, Optional, TypeVar

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.enums import (
    AppointmentStatus,
    CaseEventType,
    CaseStatus,
    ClosureReason,
    NotificationAudience,
    NotificationChannel,
    NotificationStatus,
    Priority,
    ReferralStatus,
    ResultClassification,
    ScreeningType,
)

T = TypeVar("T")


class Paginated(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int
    pages: int = 0  # V2: consistent pagination metadata across all list endpoints


# ---------- Auth / User ----------
class LoginRequest(BaseModel):
    username: str
    password: str


class UserBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    full_name: str
    role: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserBrief
    # V2: refresh token rotation + access TTL.
    refresh_token: Optional[str] = None
    expires_in: Optional[int] = None  # access token TTL in seconds (900)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    full_name: str
    role: str
    email: str = ""
    is_active: bool = True
    last_login_at: Optional[datetime] = None


class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str = ""
    role: str = "viewer"
    email: str = ""


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


# ---------- Patient ----------
class PatientBase(BaseModel):
    mrn: str
    first_name: str
    last_name: str
    date_of_birth: Optional[date] = None
    gender: str = ""
    phone: str = ""
    email: str = ""
    address: str = ""
    primary_clinician_id: Optional[int] = None
    medical_history_summary: str = ""
    allergies: str = ""


class PatientCreate(PatientBase):
    pass


class PatientUpdate(BaseModel):
    mrn: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    primary_clinician_id: Optional[int] = None
    medical_history_summary: Optional[str] = None
    allergies: Optional[str] = None


class PatientOut(PatientBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    updated_at: datetime


# ---------- Screening ----------
class ScreeningCreate(BaseModel):
    patient_id: int
    type: ScreeningType
    screening_date: date
    facility: str = ""
    performed_by: Optional[str] = None


class ScreeningResultCreate(BaseModel):
    result_classification: ResultClassification
    result_summary: str = ""
    recorded_by: Optional[int] = None


class ScreeningAssign(BaseModel):
    clinician_id: int


class ScreeningOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    patient_id: int
    patient_name: str = ""
    type: str
    screening_date: date
    facility: str = ""
    performed_by: Optional[str] = None
    result_classification: Optional[str] = None
    result_summary: str = ""
    actionable: bool = False
    assigned_clinician_id: Optional[int] = None
    created_at: datetime


class ScreeningWithCaseResponse(BaseModel):
    screening: ScreeningOut
    created_case: Optional["CaseOut"] = None


# ---------- Case ----------
class CaseCreate(BaseModel):
    patient_id: int
    screening_id: Optional[int] = None
    priority: Priority = Priority.MEDIUM
    responsible_id: Optional[int] = None
    due_date: Optional[date] = None
    next_action: str = ""


class CaseUpdate(BaseModel):
    priority: Optional[Priority] = None
    responsible_id: Optional[int] = None
    due_date: Optional[date] = None
    next_action: Optional[str] = None


class CaseAdvance(BaseModel):
    to_status: CaseStatus
    note: Optional[str] = None


class CaseEventCreate(BaseModel):
    event_type: CaseEventType
    note: str = ""
    contact_outcome: Optional[str] = None


class CaseClose(BaseModel):
    closure_reason: ClosureReason
    note: str = ""


class CaseEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    case_id: int
    event_type: str
    note: str = ""
    contact_outcome: str = ""
    actor_id: Optional[int] = None
    created_at: datetime


class CaseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    case_ref: str
    patient_id: int
    patient_name: str = ""
    screening_id: Optional[int] = None
    screening_type: str = ""
    result_classification: str = ""
    priority: str
    responsible_id: Optional[int] = None
    responsible_name: str = ""
    status: str
    due_date: Optional[date] = None
    last_contact_at: Optional[datetime] = None
    next_action: str = ""
    created_at: datetime
    updated_at: datetime
    overdue: bool = False


# ---------- Referral ----------
class ReferralCreate(BaseModel):
    patient_id: int
    case_id: Optional[int] = None
    to_department: str
    reason: str = ""
    notes: Optional[str] = None


class ReferralAccept(BaseModel):
    notes: Optional[str] = None


class ReferralReject(BaseModel):
    reason: str


class ReferralComplete(BaseModel):
    outcome: str


class ReferralOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    patient_id: int
    patient_name: str = ""
    case_id: Optional[int] = None
    from_department: str = ""
    to_department: str
    reason: str = ""
    status: str
    sent_at: Optional[datetime] = None
    responded_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    notes: str = ""


# ---------- Appointment ----------
class AppointmentCreate(BaseModel):
    patient_id: int
    case_id: Optional[int] = None
    referral_id: Optional[int] = None
    department: str = ""
    clinician_id: Optional[int] = None
    scheduled_at: datetime
    duration_min: Optional[int] = 30
    notes: Optional[str] = None


class AppointmentUpdate(BaseModel):
    scheduled_at: datetime
    notes: Optional[str] = None


class AppointmentCancel(BaseModel):
    reason: str


class AppointmentComplete(BaseModel):
    attended: bool
    notes: Optional[str] = None


class AppointmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    patient_id: int
    patient_name: str = ""
    case_id: Optional[int] = None
    referral_id: Optional[int] = None
    department: str = ""
    clinician_id: Optional[int] = None
    scheduled_at: datetime
    duration_min: int = 30
    status: str
    notes: str = ""
    attended_at: Optional[datetime] = None


# ---------- Notification ----------
class NotificationSend(BaseModel):
    audience: NotificationAudience
    patient_id: Optional[int] = None
    staff_user_id: Optional[int] = None
    case_id: Optional[int] = None
    channel: NotificationChannel = NotificationChannel.PORTAL
    subject: str = ""
    message: str = ""


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    audience: str
    patient_id: Optional[int] = None
    staff_user_id: Optional[int] = None
    case_id: Optional[int] = None
    channel: str
    status: str
    subject: str = ""
    message: str = ""
    sent_at: Optional[datetime] = None
    acknowledged_at: Optional[datetime] = None


# ---------- Dashboard ----------
class ScreeningVolumeMonth(BaseModel):
    month: str
    total: int
    abnormal: int


class CasesByStatusItem(BaseModel):
    status: str
    count: int


class OverdueByResponsibleItem(BaseModel):
    responsible: str
    count: int


class RecentActivityItem(BaseModel):
    id: int
    timestamp: datetime
    actor: str
    action: str
    patient_name: str = ""
    case_id: Optional[int] = None


class DashboardSummary(BaseModel):
    total_patients: int
    total_screenings: int
    abnormal_results: int
    open_follow_up_cases: int
    overdue_cases: int
    completed_follow_ups: int
    pending_referrals: int
    upcoming_appointments: int
    follow_up_completion_rate: float
    screening_to_care_conversion_rate: float
    screening_volume_by_month: List[ScreeningVolumeMonth]
    cases_by_status: List[CasesByStatusItem]
    overdue_by_responsible: List[OverdueByResponsibleItem]
    recent_activity: List[RecentActivityItem]


# ---------- Analytics ----------
class AnalyticsOverview(BaseModel):
    screening_volume: int
    abnormal_rate: float
    follow_up_completion_rate: float
    avg_days_screening_to_notification: float
    avg_days_screening_to_consultation: float
    overdue_rate: float
    referral_completion_rate: float
    lost_to_follow_up_count: int


class ScreeningVolumeRow(BaseModel):
    month: str
    total: int
    abnormal: int
    actionable: int


class TimelinessRow(BaseModel):
    screening_type: str
    avg_days_to_notification: float
    avg_days_to_consultation: float
    median_days_to_closure: float


class LostFollowupRow(BaseModel):
    reason: str
    count: int


# ---------- AI ----------
class AISummarizeRequest(BaseModel):
    case_id: int


class AISummarizeResponse(BaseModel):
    summary: str
    overdue: bool
    missing_steps: List[str]
    suggested_next_actions: List[str]
    risk_flags: List[str]


class TopOverdueCase(BaseModel):
    case_ref: str
    patient_name: str
    days_overdue: int


class AIOperationalInsights(BaseModel):
    insights: List[str]
    top_overdue_cases: List[TopOverdueCase]
    bottlenecks: List[str]


# ---------- Admin ----------
class RoleOut(BaseModel):
    name: str
    permissions: List[str]


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    timestamp: datetime
    user_id: Optional[int] = None
    username: str = ""
    action: str
    entity_type: str = ""
    entity_id: Optional[int] = None
    ip_address: str = ""
    details: str = ""


class EscalationRuleBase(BaseModel):
    name: str
    enabled: bool = True
    level: int = 1  # V2: L1/L2/L3 multi-level
    trigger_overdue_days: int = 3
    escalate_to_role: str = "coordinator"
    notify_channel: str = "PORTAL"


class EscalationRuleCreate(EscalationRuleBase):
    pass


class EscalationRuleUpdate(BaseModel):
    name: Optional[str] = None
    enabled: Optional[bool] = None
    level: Optional[int] = None
    trigger_overdue_days: Optional[int] = None
    escalate_to_role: Optional[str] = None
    notify_channel: Optional[str] = None


class EscalationRuleOut(EscalationRuleBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime


class CaseDetail(CaseOut):
    events: List[CaseEventOut] = []
    referrals: List[ReferralOut] = []
    appointments: List[AppointmentOut] = []
    patient: Optional[PatientOut] = None
    screening: Optional[ScreeningOut] = None


class PatientDetail(PatientOut):
    screenings: List[ScreeningOut] = []
    follow_up_cases: List[CaseOut] = []
    referrals: List[ReferralOut] = []
    appointments: List[AppointmentOut] = []


# ---------- V2: Auth refresh / logout ----------
class RefreshRequest(BaseModel):
    refresh_token: str

class RefreshResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int

class LogoutRequest(BaseModel):
    refresh_token: Optional[str] = None

# ---------- V2: Escalation history ----------
class EscalationLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    case_id: int
    rule_id: int
    level: int
    trigger_date: datetime
    detail: str = ""
    created_at: datetime

# ---------- V2: Notifications preferences / delivery ----------
class NotificationPreferences(BaseModel):
    channel_enabled: dict = {}

class DeliveryLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    notification_id: int
    provider: str
    status: str
    detail: str = ""
    attempts: int
    created_at: datetime

# ---------- V2: Population health (aggregated, anonymized only) ----------
class PopulationByType(BaseModel):
    type: str
    screenings: int
    abnormal: int
    completion_rate: float

class PopulationOverview(BaseModel):
    screening_coverage_rate: float
    abnormal_rate: float
    follow_up_completion_rate: float
    avg_days_to_consultation: float
    delayed_care_count: int
    referral_completion_rate: float
    by_type: List[PopulationByType]
    disclaimer: str = ""

class PopulationCoverageRow(BaseModel):
    month: str
    total: int
    abnormal: int
    coverage_rate: float

class PopulationGeographicRow(BaseModel):
    region: str
    screening_count: int
    abnormal_count: int
    completion_rate: float
    overdue_rate: float

class PopulationDelayedCareRow(BaseModel):
    screening_type: str
    bucket_days: str
    count: int

class PopulationTrendsRow(BaseModel):
    month: str
    screenings: int
    abnormal_rate: float
    completion_rate: float
    overdue_count: int

# ---------- V2: AI query-dashboard ----------
class AIQueryRequest(BaseModel):
    question: str

class AIQueryResponse(BaseModel):
    answer: str
    routed_to: str  # population | dashboard | escalation | unknown
    data: dict = {}
    disclaimer: str

# ---------- V2: Patient portal ----------
class PortalMe(BaseModel):
    mrn: str
    first_name: str
    last_name: str
    date_of_birth: Optional[date] = None
    gender: str = ""
    phone: str = ""
    email: str = ""

class PortalAppointment(BaseModel):
    department: str
    clinician_name: str = ""
    scheduled_at: datetime
    status: str

class PortalReferral(BaseModel):
    to_department: str
    status: str
    reason: str = ""

class PortalFollowUp(BaseModel):
    case_ref: str
    screening_type: str
    status: str
    next_action: str = ""
    due_date: Optional[date] = None

class PortalNotification(BaseModel):
    subject: str = ""
    message: str = ""
    channel: str = ""
    created_at: datetime

class PortalInstruction(BaseModel):
    instruction: str
    created_at: datetime

class PortalContactInfo(BaseModel):
    facility_name: str
    phone: str
    email: str
    hours: str

# ---------- V2: Patient instructions (staff-entered) ----------
class PatientInstructionCreate(BaseModel):
    instruction: str

class PatientInstructionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    patient_id: int
    instruction: str
    entered_by: Optional[int] = None
    created_at: datetime

ScreeningWithCaseResponse.model_rebuild()
