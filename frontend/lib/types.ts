// OCTOLOOP — frozen API contract types (v1). Do not deviate from API_CONTRACT.md.

export type Role = "admin" | "clinician" | "nurse" | "coordinator" | "viewer" | "patient";

export type ScreeningType =
  | "BREAST"
  | "CERVICAL"
  | "COLORECTAL"
  | "DIABETES"
  | "HYPERTENSION"
  | "OTHER";

export type ResultClassification =
  | "NORMAL"
  | "BORDERLINE"
  | "ABNORMAL"
  | "INADEQUATE";

export type CaseStatus =
  | "NEW_RESULT"
  | "AWAITING_REVIEW"
  | "PATIENT_NOTIFICATION_PENDING"
  | "PATIENT_NOTIFIED"
  | "AWAITING_CONFIRMATION"
  | "REFERRAL_PENDING"
  | "APPOINTMENT_PENDING"
  | "CONSULTATION_COMPLETED"
  | "TREATMENT_OR_SURVEILLANCE"
  | "CLOSED";

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type ClosureReason =
  | "RESOLVED"
  | "LOST_TO_FOLLOWUP"
  | "TRANSFERRED"
  | "NO_ACTION_REQUIRED"
  | "DECEASED";

export type ReferralStatus =
  | "DRAFT"
  | "SENT"
  | "ACCEPTED"
  | "REJECTED"
  | "COMPLETED"
  | "CANCELLED";

export type AppointmentStatus =
  | "SCHEDULED"
  | "CONFIRMED"
  | "CHECKED_IN"
  | "COMPLETED"
  | "NO_SHOW"
  | "CANCELLED"
  | "RESCHEDULED";

export type NotificationChannel = "SMS" | "EMAIL" | "PHONE" | "PORTAL" | "LETTER";
export type NotificationStatus =
  | "PENDING"
  | "SENT"
  | "DELIVERED"
  | "FAILED"
  | "ACKNOWLEDGED";
export type NotificationAudience = "PATIENT" | "STAFF";

export type CaseEventType =
  | "STATUS_CHANGE"
  | "NOTE"
  | "PATIENT_CONTACT"
  | "NOTIFICATION_SENT"
  | "ESCALATION"
  | "REFERRAL_CREATED"
  | "APPOINTMENT_SCHEDULED"
  | "APPOINTMENT_COMPLETED"
  | "CASE_CREATED"
  | "CASE_CLOSED"
  | "ASSIGNMENT_CHANGE"
  | "RESULT_RECORDED";

export interface User {
  id: number;
  username: string;
  full_name: string;
  role: Role;
  email?: string;
  is_active?: boolean;
  last_login_at?: string | null;
}

export interface LoginResponse {
  access_token: string;
  token_type: "bearer";
  user: User;
}

export interface Patient {
  id: number;
  mrn: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  primary_clinician_id?: number | null;
  medical_history_summary?: string | null;
  allergies?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PatientDetail extends Patient {
  screenings: Screening[];
  follow_up_cases: FollowUpCase[];
  referrals: Referral[];
  appointments: Appointment[];
}

export interface Screening {
  id: number;
  patient_id: number;
  patient_name?: string;
  type: ScreeningType;
  screening_date: string;
  facility?: string | null;
  performed_by?: string | null;
  result_classification?: ResultClassification | null;
  result_summary?: string | null;
  actionable?: boolean;
  assigned_clinician_id?: number | null;
  created_at: string;
}

export interface FollowUpCase {
  id: number;
  case_ref: string;
  patient_id: number;
  patient_name?: string;
  screening_id?: number | null;
  screening_type?: ScreeningType | null;
  result_classification?: ResultClassification | null;
  priority: Priority;
  responsible_id?: number | null;
  responsible_name?: string | null;
  status: CaseStatus;
  due_date?: string | null;
  last_contact_at?: string | null;
  next_action?: string | null;
  created_at: string;
  updated_at: string;
  overdue: boolean;
}

export interface CaseEvent {
  id: number;
  case_id: number;
  event_type: CaseEventType;
  note?: string | null;
  actor?: string | null;
  contact_outcome?: string | null;
  created_at: string;
}

export interface CaseDetail extends FollowUpCase {
  events: CaseEvent[];
  referrals: Referral[];
  appointments: Appointment[];
  patient: Patient;
  screening?: Screening | null;
}

export interface Referral {
  id: number;
  patient_id: number;
  patient_name?: string;
  case_id?: number | null;
  from_department?: string | null;
  to_department: string;
  reason: string;
  status: ReferralStatus;
  sent_at?: string | null;
  responded_at?: string | null;
  completed_at?: string | null;
  notes?: string | null;
}

export interface Appointment {
  id: number;
  patient_id: number;
  patient_name?: string;
  case_id?: number | null;
  referral_id?: number | null;
  department: string;
  clinician_id?: number | null;
  scheduled_at: string;
  duration_min?: number | null;
  status: AppointmentStatus;
  notes?: string | null;
  attended_at?: string | null;
}

export interface NotificationItem {
  id: number;
  audience: NotificationAudience;
  patient_id?: number | null;
  staff_user_id?: number | null;
  case_id?: number | null;
  channel: NotificationChannel;
  status: NotificationStatus;
  subject: string;
  message: string;
  sent_at?: string | null;
  acknowledged_at?: string | null;
}

export interface DashboardSummary {
  total_patients: number;
  total_screenings: number;
  abnormal_results: number;
  open_follow_up_cases: number;
  overdue_cases: number;
  completed_follow_ups: number;
  pending_referrals: number;
  upcoming_appointments: number;
  follow_up_completion_rate: number;
  screening_to_care_conversion_rate: number;
  screening_volume_by_month: { month: string; total: number; abnormal: number }[];
  cases_by_status: { status: string; count: number }[];
  overdue_by_responsible: { responsible: string; count: number }[];
  recent_activity: {
    id: number;
    timestamp: string;
    actor: string;
    action: string;
    patient_name?: string | null;
    case_id?: number | null;
  }[];
}

export interface AnalyticsOverview {
  screening_volume: number;
  abnormal_rate: number;
  follow_up_completion_rate: number;
  avg_days_screening_to_notification: number;
  avg_days_screening_to_consultation: number;
  overdue_rate: number;
  referral_completion_rate: number;
  lost_to_follow_up_count: number;
}

export interface AiCaseSummary {
  summary: string;
  overdue: boolean;
  missing_steps: string[];
  suggested_next_actions: string[];
  risk_flags: string[];
  disclaimer?: string;
}

export interface EscalationRule {
  id: number;
  name: string;
  enabled: boolean;
  trigger_overdue_days: number;
  escalate_to_role: Role;
  notify_channel: NotificationChannel;
  created_at: string;
}

export interface AuditLog {
  id: number;
  timestamp: string;
  user_id?: number | null;
  username?: string | null;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  ip_address?: string | null;
  details?: string | null;
}

export interface RoleDef {
  name: Role;
  permissions: string[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface SettingsMap {
  [key: string]: string;
}

// ===== V2 extensions =====
export interface LoginResponseV2 extends LoginResponse {
  refresh_token?: string;
  expires_in?: number;
}

// Patient portal (/portal/*) — strict own-data, no internal notes.
export interface PortalMe {
  patient_id: number;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  date_of_birth?: string | null;
  phone?: string | null;
  email?: string | null;
  mrn?: string;
  address?: string | null;
}
export interface PortalAppointment {
  id: number;
  department?: string;
  clinician?: string | null;
  scheduled_at: string;
  status: AppointmentStatus;
  notes?: string | null;
}
export interface PortalReferral {
  id: number;
  to_department: string;
  status: ReferralStatus;
  reason?: string | null;
  sent_at?: string | null;
}
export interface PortalFollowUp {
  id: number;
  case_ref: string;
  screening_type?: ScreeningType | null;
  status: CaseStatus;
  next_action?: string | null;
  due_date?: string | null;
  overdue?: boolean;
}
export interface PortalNotification {
  id: number;
  channel: NotificationChannel;
  subject: string;
  message: string;
  sent_at?: string | null;
  status?: NotificationStatus;
}
export interface PortalInstruction {
  id: number;
  title?: string;
  content: string;
  entered_by?: string | null;
  created_at?: string;
}
export interface PortalContactInfo {
  facility_name?: string;
  phone?: string;
  email?: string;
  hours?: string;
}

// Population health (Phase 5) — aggregated & anonymized only.
export interface PopulationOverview {
  screening_coverage_rate: number;
  abnormal_rate: number;
  follow_up_completion_rate: number;
  avg_days_to_consultation: number;
  delayed_care_count: number;
  referral_completion_rate: number;
  by_type: { type: string; screenings: number; abnormal: number; completion_rate: number }[];
}
export interface PopulationCoveragePoint {
  month: string;
  coverage_rate?: number;
  total?: number;
  abnormal?: number;
  [key: string]: unknown;
}
export interface PopulationGeographic {
  region: string;
  screening_count: number;
  abnormal_count: number;
  completion_rate: number;
  overdue_rate: number;
}
export interface PopulationDelayedCare {
  screening_type: string;
  bucket_days: string;
  count: number;
}
export interface PopulationTrendPoint {
  month: string;
  [key: string]: unknown;
}

// AI operational insights (Phase 7).
export interface OperationalInsights {
  insights: string[];
  top_overdue_cases: { case_ref: string; patient_name?: string; days_overdue: number }[];
  bottlenecks: string[];
  disclaimer?: string;
}

// Notification preferences (Phase 12).
export interface NotificationPreferences {
  channel_enabled: Partial<Record<NotificationChannel, boolean>>;
}
