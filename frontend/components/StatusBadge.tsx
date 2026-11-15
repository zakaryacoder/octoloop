"use client";

import { Badge } from "@/components/ui/badge";
import {
  TONES,
  appointmentStatusTone,
  caseStatusTone,
  humanize,
  notificationStatusTone,
  priorityTone,
  referralStatusTone,
  resultTone,
  type BadgeTone,
} from "@/lib/constants";
import type {
  AppointmentStatus,
  CaseStatus,
  NotificationStatus,
  Priority,
  ReferralStatus,
  ResultClassification,
} from "@/lib/types";
import { cn } from "@/lib/utils";

export function ToneBadge({
  tone,
  label,
  pulse,
}: {
  tone: keyof typeof TONES;
  label: string;
  pulse?: boolean;
}) {
  const t: BadgeTone = TONES[tone];
  return (
    <Badge style={{ backgroundColor: t.bg, color: t.text }}>
      <span
        className={cn(
          "inline-block h-1.5 w-1.5 rounded-full",
          pulse && "animate-pulse-ring"
        )}
        style={{ backgroundColor: t.dot }}
      />
      {label}
    </Badge>
  );
}

export function CaseStatusBadge({
  status,
  overdue,
}: {
  status: CaseStatus;
  overdue?: boolean;
}) {
  const tone = overdue ? "danger" : caseStatusTone(status);
  return (
    <ToneBadge
      tone={tone}
      label={overdue ? `${humanize(status)} · ${humanize("OVERDUE")}` : humanize(status)}
      pulse={overdue}
    />
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <ToneBadge tone={priorityTone(priority)} label={humanize(priority)} />;
}

export function ResultBadge({
  classification,
  actionable,
}: {
  classification?: ResultClassification | null;
  actionable?: boolean;
}) {
  if (!classification) {
    return <ToneBadge tone="neutral" label={humanize("PENDING_RESULT")} />;
  }
  return (
    <ToneBadge
      tone={resultTone(classification)}
      label={
        actionable
          ? `${humanize(classification)} · ${humanize("ACTIONABLE")}`
          : humanize(classification)
      }
    />
  );
}

export function ReferralStatusBadge({ status }: { status: ReferralStatus }) {
  return <ToneBadge tone={referralStatusTone(status)} label={humanize(status)} />;
}

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <ToneBadge tone={appointmentStatusTone(status)} label={humanize(status)} />
  );
}

export function NotificationStatusBadge({ status }: { status: NotificationStatus }) {
  return (
    <ToneBadge tone={notificationStatusTone(status)} label={humanize(status)} />
  );
}
