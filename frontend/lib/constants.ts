import type {
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
  Role,
  ScreeningType,
} from "./types";
import { enumLabel } from "./enum-labels";

// Ordered workflow — used for advance dropdown and timeline progress.
export const CASE_STATUS_ORDER: CaseStatus[] = [
  "NEW_RESULT",
  "AWAITING_REVIEW",
  "PATIENT_NOTIFICATION_PENDING",
  "PATIENT_NOTIFIED",
  "AWAITING_CONFIRMATION",
  "REFERRAL_PENDING",
  "APPOINTMENT_PENDING",
  "CONSULTATION_COMPLETED",
  "TREATMENT_OR_SURVEILLANCE",
  "CLOSED",
];

export const SCREENING_TYPES: ScreeningType[] = [
  "BREAST",
  "CERVICAL",
  "COLORECTAL",
  "DIABETES",
  "HYPERTENSION",
  "OTHER",
];

export const RESULT_CLASSIFICATIONS: ResultClassification[] = [
  "NORMAL",
  "BORDERLINE",
  "ABNORMAL",
  "INADEQUATE",
];

export const ACTIONABLE_CLASSIFICATIONS: ResultClassification[] = [
  "ABNORMAL",
  "BORDERLINE",
];

export const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export const CLOSURE_REASONS: ClosureReason[] = [
  "RESOLVED",
  "LOST_TO_FOLLOWUP",
  "TRANSFERRED",
  "NO_ACTION_REQUIRED",
  "DECEASED",
];

export const REFERRAL_STATUSES: ReferralStatus[] = [
  "DRAFT",
  "SENT",
  "ACCEPTED",
  "REJECTED",
  "COMPLETED",
  "CANCELLED",
];

export const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "SCHEDULED",
  "CONFIRMED",
  "CHECKED_IN",
  "COMPLETED",
  "NO_SHOW",
  "CANCELLED",
  "RESCHEDULED",
];

export const NOTIFICATION_CHANNELS: NotificationChannel[] = [
  "SMS",
  "EMAIL",
  "PHONE",
  "PORTAL",
  "LETTER",
];

export const NOTIFICATION_STATUSES: NotificationStatus[] = [
  "PENDING",
  "SENT",
  "DELIVERED",
  "FAILED",
  "ACKNOWLEDGED",
];

export const NOTIFICATION_AUDIENCES: NotificationAudience[] = [
  "PATIENT",
  "STAFF",
];

export const ROLES: Role[] = ["admin", "clinician", "nurse", "coordinator", "viewer"];

export const CASE_EVENT_TYPES: CaseEventType[] = [
  "STATUS_CHANGE",
  "NOTE",
  "PATIENT_CONTACT",
  "NOTIFICATION_SENT",
  "ESCALATION",
  "REFERRAL_CREATED",
  "APPOINTMENT_SCHEDULED",
  "APPOINTMENT_COMPLETED",
  "CASE_CREATED",
  "CASE_CLOSED",
  "ASSIGNMENT_CHANGE",
  "RESULT_RECORDED",
];

// Badge palette per DESIGN_TOKENS.md. Each entry = { dot, text, bg }.
export type BadgeTone = {
  dot: string;
  text: string;
  bg: string;
  ring?: string;
};

export const TONES: Record<
  "success" | "warning" | "danger" | "info" | "neutral" | "urgent",
  BadgeTone
> = {
  success: { dot: "#13A89E", text: "#0E8A82", bg: "#E6F6F5" },
  warning: { dot: "#D97706", text: "#B45309", bg: "#FEF3C7" },
  danger: { dot: "#DC2626", text: "#B91C1C", bg: "#FEE2E2" },
  info: { dot: "#2563EB", text: "#1D4ED8", bg: "#DBEAFE" },
  neutral: { dot: "#64748B", text: "#475569", bg: "#F1F5F9" },
  urgent: { dot: "#7C3AED", text: "#6D28D9", bg: "#EDE9FE" },
};

export function humanize(s: string): string {
  // Translated label for known enum values (EN/FR/AR); fall back to prettified raw value.
  const translated = enumLabel(s);
  if (translated) return translated;
  return s
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Case status -> tone. Closed/terminal = success; overdue handled separately (danger).
export function caseStatusTone(status: CaseStatus): keyof typeof TONES {
  if (status === "CLOSED") return "success";
  if (status === "NEW_RESULT") return "danger";
  if (
    status === "AWAITING_REVIEW" ||
    status === "AWAITING_CONFIRMATION" ||
    status === "REFERRAL_PENDING" ||
    status === "APPOINTMENT_PENDING"
  )
    return "warning";
  if (
    status === "PATIENT_NOTIFICATION_PENDING" ||
    status === "PATIENT_NOTIFIED"
  )
    return "info";
  return "neutral";
}

export function resultTone(r?: ResultClassification | null): keyof typeof TONES {
  if (r === "ABNORMAL") return "danger";
  if (r === "BORDERLINE") return "warning";
  if (r === "NORMAL") return "success";
  return "neutral";
}

export function priorityTone(p: Priority): keyof typeof TONES {
  if (p === "URGENT") return "urgent";
  if (p === "HIGH") return "danger";
  if (p === "MEDIUM") return "warning";
  return "neutral";
}

export function referralStatusTone(s: ReferralStatus): keyof typeof TONES {
  if (s === "COMPLETED" || s === "ACCEPTED") return "success";
  if (s === "REJECTED" || s === "CANCELLED") return "danger";
  if (s === "SENT") return "info";
  return "neutral";
}

export function appointmentStatusTone(
  s: AppointmentStatus
): keyof typeof TONES {
  if (s === "COMPLETED" || s === "CHECKED_IN") return "success";
  if (s === "NO_SHOW" || s === "CANCELLED") return "danger";
  if (s === "CONFIRMED") return "info";
  if (s === "RESCHEDULED") return "warning";
  return "neutral";
}

export function notificationStatusTone(
  s: NotificationStatus
): keyof typeof TONES {
  if (s === "DELIVERED" || s === "ACKNOWLEDGED") return "success";
  if (s === "FAILED") return "danger";
  if (s === "SENT") return "info";
  return "neutral";
}

export function eventTypeTone(t: CaseEventType): keyof typeof TONES {
  switch (t) {
    case "CASE_CLOSED":
    case "APPOINTMENT_COMPLETED":
      return "success";
    case "ESCALATION":
      return "danger";
    case "STATUS_CHANGE":
    case "ASSIGNMENT_CHANGE":
      return "info";
    case "NOTIFICATION_SENT":
    case "PATIENT_CONTACT":
    case "APPOINTMENT_SCHEDULED":
    case "REFERRAL_CREATED":
      return "warning";
    case "RESULT_RECORDED":
    case "CASE_CREATED":
      return "urgent";
    default:
      return "neutral";
  }
}
