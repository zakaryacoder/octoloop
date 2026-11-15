"use client";

import {
  Activity,
  ArrowRightLeft,
  BellRing,
  CalendarCheck,
  CalendarPlus,
  FileText,
  Flag,
  PhoneCall,
  PlusCircle,
  Send,
  Stethoscope,
  UserCheck,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { TONES, eventTypeTone, humanize } from "@/lib/constants";
import type { CaseEvent, CaseEventType } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";
import { tx } from "@/lib/tx";

const EVENT_ICONS: Record<CaseEventType, LucideIcon> = {
  STATUS_CHANGE: ArrowRightLeft,
  NOTE: FileText,
  PATIENT_CONTACT: PhoneCall,
  NOTIFICATION_SENT: BellRing,
  ESCALATION: Flag,
  REFERRAL_CREATED: Send,
  APPOINTMENT_SCHEDULED: CalendarPlus,
  APPOINTMENT_COMPLETED: CalendarCheck,
  CASE_CREATED: PlusCircle,
  CASE_CLOSED: XCircle,
  ASSIGNMENT_CHANGE: UserCheck,
  RESULT_RECORDED: Stethoscope,
};

export function CaseTimeline({ events }: { events: CaseEvent[] }) {
  if (!events || events.length === 0) {
    return (
      <p className="px-2 py-6 text-center text-sm text-ink-muted">
        {tx("No events recorded yet.")}
      </p>
    );
  }
  // Newest first by created_at; render top = newest.
  const sorted = [...events].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  return (
    <ol className="relative ml-2 border-l-2 border-line pl-5">
      {sorted.map((ev, i) => {
        const tone = TONES[eventTypeTone(ev.event_type)];
        const Icon = EVENT_ICONS[ev.event_type] ?? Activity;
        const isFirst = i === 0;
        return (
          <li key={ev.id} className="relative pb-5 last:pb-0">
            <span
              className={
                "absolute -left-[29px] flex h-6 w-6 items-center justify-center rounded-full border-2 border-white shadow-sm " +
                (isFirst ? "animate-pulse-ring " : "")
              }
              style={{ backgroundColor: tone.bg, color: tone.text }}
            >
              <Icon size={12} />
            </span>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span
                className="text-[13px] font-semibold"
                style={{ color: tone.text }}
              >
                {humanize(ev.event_type)}
              </span>
              <span className="text-[11.5px] text-ink-muted tabular">
                {formatDateTime(ev.created_at)}
              </span>
              {ev.actor && (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-ink-muted">
                  {ev.actor}
                </span>
              )}
              {ev.contact_outcome && (
                <span className="rounded bg-teal-light px-1.5 py-0.5 text-[11px] text-teal-dark">
                  {tx("outcome:")} {ev.contact_outcome}
                </span>
              )}
            </div>
            {ev.note && (
              <p className="mt-1 text-[13px] leading-relaxed text-ink-body">
                {ev.note}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
