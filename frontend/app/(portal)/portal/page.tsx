"use client";
// Patient portal overview — own data only via /portal/* endpoints.
import Link from "next/link";
import {
  Bell,
  CalendarDays,
  ClipboardList,
  Mail,
  MapPin,
  Phone,
  Send,
  Stethoscope,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { useI18n } from "@/lib/i18n";
import type {
  PortalAppointment,
  PortalFollowUp,
  PortalMe,
  PortalNotification,
  PortalReferral,
} from "@/lib/types";
import { ageFromDob, formatDate, formatDateTime, patientFullName } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/states";
import { AppointmentStatusBadge, CaseStatusBadge, ReferralStatusBadge } from "@/components/StatusBadge";

export default function PortalOverviewPage() {
  const { t } = useI18n();
  const me = useAsync<PortalMe>(() => api.get<PortalMe>("/portal/me"), []);
  const appts = useAsync<PortalAppointment[] | { items: PortalAppointment[] }>(
    () => api.get("/portal/appointments"),
    []
  );
  const refs = useAsync<PortalReferral[] | { items: PortalReferral[] }>(
    () => api.get("/portal/referrals"),
    []
  );
  const fus = useAsync<PortalFollowUp[] | { items: PortalFollowUp[] }>(
    () => api.get("/portal/follow-ups"),
    []
  );
  const notifs = useAsync<PortalNotification[] | { items: PortalNotification[] }>(
    () => api.get("/portal/notifications"),
    []
  );

  const loading = me.loading;
  const error = me.error;
  const refetch = me.refetch;

  if (loading) return <Card><TableSkeleton rows={6} cols={3} /></Card>;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!me.data) return null;

  const name = patientFullName(me.data);
  const age = ageFromDob(me.data.date_of_birth);
  const apptList = Array.isArray(appts.data) ? appts.data : (appts.data?.items ?? []);
  const refList = Array.isArray(refs.data) ? refs.data : (refs.data?.items ?? []);
  const fuList = Array.isArray(fus.data) ? fus.data : (fus.data?.items ?? []);
  const notifList = Array.isArray(notifs.data) ? notifs.data : (notifs.data?.items ?? []);
  const upcoming = apptList
    .filter((a) => ["SCHEDULED", "CONFIRMED", "CHECKED_IN", "RESCHEDULED"].includes(a.status))
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0];
  const openFus = fuList.filter((f) => f.status !== "CLOSED");

  const stats = [
    { label: t("portal.appointments"), value: apptList.length, icon: CalendarDays, href: "/portal/appointments", tone: "text-blue-600 bg-blue-50" },
    { label: t("portal.referrals"), value: refList.length, icon: Send, href: "/portal/referrals", tone: "text-teal-dark bg-teal-light" },
    { label: t("portal.followUps"), value: openFus.length, icon: ClipboardList, href: "/portal/follow-ups", tone: "text-amber-700 bg-amber-50" },
    { label: t("portal.notifications"), value: notifList.length, icon: Bell, href: "/portal/notifications", tone: "text-violet-700 bg-violet-50" },
  ];

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-center gap-4 p-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal text-lg font-bold text-white">
            {name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-ink-heading">
              {t("portal.welcome")}, {name}
            </h1>
            <p className="mt-0.5 text-sm text-ink-muted">
              {me.data.mrn && <><span className="font-mono">{me.data.mrn}</span> · </>}
              {age !== null && <>{age} {t("portal.dob").toLowerCase()} · </>}
              {formatDate(me.data.date_of_birth)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-ink-muted">
              {me.data.phone && <span className="inline-flex items-center gap-1.5"><Phone size={13} /> {me.data.phone}</span>}
              {me.data.email && <span className="inline-flex items-center gap-1.5"><Mail size={13} /> {me.data.email}</span>}
              {me.data.address && <span className="inline-flex items-center gap-1.5"><MapPin size={13} /> {me.data.address}</span>}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.href} href={s.href}>
              <Card className="h-full transition-shadow hover:shadow-pop">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${s.tone}`}>
                    <Icon size={18} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold tabular text-ink-heading">{s.value}</p>
                    <p className="text-[11.5px] text-ink-muted">{s.label}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2"><CalendarDays size={16} className="text-teal-dark" /> {t("portal.appointments")}</CardTitle>
            <Link href="/portal/appointments" className="text-xs font-medium text-teal-dark hover:underline">{t("common.viewAll")} →</Link>
          </CardHeader>
          <CardContent>
            {upcoming ? (
              <div className="rounded-lg border border-teal/30 bg-teal-light/40 p-4">
                <p className="text-[13px] font-semibold text-teal-dark">{formatDateTime(upcoming.scheduled_at)}</p>
                <p className="mt-1 text-sm text-ink-body">{upcoming.department || t("portal.department")}</p>
                {upcoming.clinician && <p className="text-[12.5px] text-ink-muted">{t("portal.clinician")}: {upcoming.clinician}</p>}
                <div className="mt-2"><AppointmentStatusBadge status={upcoming.status} /></div>
              </div>
            ) : (
              <EmptyState title={t("portal.noRecords")} description={t("portal.appointments")} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2"><Stethoscope size={16} className="text-teal-dark" /> {t("portal.followUps")}</CardTitle>
            <Link href="/portal/follow-ups" className="text-xs font-medium text-teal-dark hover:underline">{t("common.viewAll")} →</Link>
          </CardHeader>
          <CardContent>
            {openFus.length === 0 ? (
              <EmptyState title={t("portal.noRecords")} description={t("portal.followUps")} />
            ) : (
              <ul className="space-y-2.5">
                {openFus.slice(0, 3).map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-3 rounded-lg border border-line p-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[12px] text-ink-muted">{f.case_ref}</p>
                      <p className="text-[13px] font-medium text-ink-body">{f.next_action || "—"}</p>
                    </div>
                    <CaseStatusBadge status={f.status} overdue={f.overdue} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2"><Bell size={16} className="text-teal-dark" /> {t("portal.notifications")}</CardTitle>
          <Link href="/portal/notifications" className="text-xs font-medium text-teal-dark hover:underline">{t("common.viewAll")} →</Link>
        </CardHeader>
        <CardContent>
          {notifList.length === 0 ? (
            <EmptyState title={t("portal.noRecords")} description={t("portal.notifications")} />
          ) : (
            <ul className="divide-y divide-line/60">
              {notifList.slice(0, 4).map((n) => (
                <li key={n.id} className="py-2.5">
                  <p className="text-[13.5px] font-medium text-ink-heading">{n.subject}</p>
                  <p className="mt-0.5 text-[12.5px] text-ink-muted">{n.message}</p>
                  <p className="mt-0.5 text-[11px] text-ink-muted tabular">{formatDateTime(n.sent_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      {refs.error && <p className="text-xs text-ink-muted">{refs.error}</p>}
    </div>
  );
}
