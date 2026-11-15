"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Hourglass,
  Percent,
  Send,
  Sparkles,
  Stethoscope,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { useI18n } from "@/lib/i18n";
import type { DashboardSummary, OperationalInsights } from "@/lib/types";
import { humanize } from "@/lib/constants";
import { timeAgo } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/KpiCard";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, PageHeader } from "@/components/states";
import { tx } from "@/lib/tx";

const CHART_TICKS = { fontSize: 11, fill: "#64748B" };

export default function DashboardPage() {
  const { t } = useI18n();
  const { data, loading, error, refetch } = useAsync<DashboardSummary>(
    () => api.get<DashboardSummary>("/dashboard/summary"),
    []
  );
  const insights = useAsync<OperationalInsights>(
    () => api.get<OperationalInsights>("/ai/operational-insights"),
    []
  );

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={tx("Command Center")}
        subtitle={tx("Real-time operational view of screening follow-up across the facility.")}
        actions={
          <Link href="/cases">
            <button className="inline-flex h-9 items-center gap-2 rounded-lg bg-navy px-4 text-sm font-medium text-white hover:bg-navy-dark transition-colors">
              <ClipboardList size={15} /> {tx("Open cases")}
            </button>
          </Link>
        }
      />

      {loading && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-line/60 bg-white p-4 shadow-card">
              <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
              <div className="mt-3 h-7 w-16 animate-pulse rounded bg-slate-200" />
            </div>
          ))}
        </div>
      )}

      {error && <ErrorState message={error} onRetry={refetch} />}

      {data && !loading && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
            <KpiCard label={tx("Total Patients")} value={data.total_patients} icon={Users} tone="navy" />
            <KpiCard label={tx("Screenings")} value={data.total_screenings} icon={Stethoscope} tone="blue" />
            <KpiCard label={tx("Abnormal Results")} value={data.abnormal_results} icon={Activity} tone="red" />
            <KpiCard label={tx("Open Follow-up Cases")} value={data.open_follow_up_cases} icon={ClipboardList} tone="navy" />
            <KpiCard label={tx("Overdue Cases")} value={data.overdue_cases} icon={AlertTriangle} tone="red" />
            <KpiCard label={tx("Completed Follow-ups")} value={data.completed_follow_ups} icon={CheckCircle2} tone="teal" />
            <KpiCard label={tx("Pending Referrals")} value={data.pending_referrals} icon={Send} tone="amber" />
            <KpiCard label={tx("Upcoming Appointments")} value={data.upcoming_appointments} icon={CalendarClock} tone="blue" />
            <KpiCard
              label={tx("Follow-up Completion")}
              value={`${data.follow_up_completion_rate.toFixed(1)}%`}
              icon={Percent}
              tone="teal"
            />
            <KpiCard
              label={tx("Screening→Care Conversion")}
              value={`${data.screening_to_care_conversion_rate.toFixed(1)}%`}
              icon={Hourglass}
              tone="violet"
            />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>{tx("Screening volume by month")}</CardTitle>
                <span className="text-[11px] text-ink-muted">{tx("Total vs abnormal")}</span>
              </CardHeader>
              <CardContent>
                <div style={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.screening_volume_by_month} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                      <CartesianGrid stroke="#EEF2F7" vertical={false} />
                      <XAxis dataKey="month" tick={CHART_TICKS} axisLine={false} tickLine={false} />
                      <YAxis tick={CHART_TICKS} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12, boxShadow: "0 4px 12px rgba(18,48,74,0.08)" }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="total" name="Total" stroke="#12304A" strokeWidth={2.5} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="abnormal" name="Abnormal" stroke="#13A89E" strokeWidth={2.5} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{tx("Open cases by status")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div style={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.cases_by_status} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
                      <CartesianGrid stroke="#EEF2F7" horizontal={false} />
                      <XAxis type="number" tick={CHART_TICKS} axisLine={false} tickLine={false} />
                      <YAxis
                        type="category"
                        dataKey="status"
                        tick={{ ...CHART_TICKS, width: 110 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: string) => humanize(v).slice(0, 14)}
                        width={110}
                      />
                      <Tooltip
                        contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }}
                        formatter={(v: number, n: string) => [v, humanize(n)]}
                        labelFormatter={(l: string) => humanize(String(l))}
                      />
                      <Bar dataKey="count" name="Cases" fill="#13A89E" radius={[0, 4, 4, 0]} barSize={14} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>{tx("Recent activity")}</CardTitle>
                <Link href="/cases" className="inline-flex items-center gap-1 text-xs font-medium text-teal-dark hover:underline">
                  {tx("View cases")} <ArrowUpRight size={13} />
                </Link>
              </CardHeader>
              <CardContent>
                {data.recent_activity.length === 0 ? (
                  <EmptyState title={tx("No recent activity")} description={tx("Events will appear here as staff work cases.")} />
                ) : (
                  <ul className="divide-y divide-line/60">
                    {data.recent_activity.slice(0, 8).map((a) => (
                      <li key={a.id} className="flex items-start gap-3 py-2.5">
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-teal" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13.5px] text-ink-body">
                            <span className="font-semibold text-ink-heading">{a.actor}</span>{" "}
                            {a.action}
                            {a.patient_name && (
                              <> — <span className="font-medium text-navy">{a.patient_name}</span></>
                            )}
                          </p>
                          <p className="mt-0.5 text-[11.5px] text-ink-muted">{timeAgo(a.timestamp)}</p>
                        </div>
                        {a.case_id && (
                          <Link
                            href={`/cases/${a.case_id}`}
                            className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-ink-body hover:bg-teal-light hover:text-teal-dark transition-colors"
                          >
                            {tx("Case #")}{a.case_id}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{tx("Overdue by responsible")}</CardTitle>
              </CardHeader>
              <CardContent>
                {data.overdue_by_responsible.length === 0 ? (
                  <EmptyState title={tx("No overdue cases")} description={tx("All open cases are within their due dates.")} icon="inbox" />
                ) : (
                  <ul className="space-y-3">
                    {data.overdue_by_responsible.map((r) => {
                      const max = Math.max(...data.overdue_by_responsible.map((x) => x.count), 1);
                      return (
                        <li key={r.responsible}>
                          <div className="mb-1 flex items-center justify-between text-[12.5px]">
                            <span className="font-medium text-ink-body truncate">{r.responsible}</span>
                            <span className="font-semibold text-red-600 tabular">{r.count}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-red-500"
                              style={{ width: `${(r.count / max) * 100}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
          {/* Operational insights panel (Phase 7/11) — GET /ai/operational-insights */}
          <Card className="mt-5 border-violet-200/60">
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2">
                <Sparkles size={16} className="text-violet-600" /> {t("dash.insights.title")}
              </CardTitle>
              <span className="text-[11px] text-ink-muted">{t("dash.insights.disclaimer")}</span>
            </CardHeader>
            <CardContent>
              {insights.loading && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="space-y-2">
                      <div className="h-3 w-28 animate-pulse rounded bg-slate-200" />
                      <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
                      <div className="h-3 w-5/6 animate-pulse rounded bg-slate-100" />
                    </div>
                  ))}
                </div>
              )}
              {insights.error && (
                <p className="text-sm text-ink-muted">{t("dash.insights.empty")} ({insights.error})</p>
              )}
              {insights.data && !insights.loading && (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                  <div>
                    <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-ink-muted">{t("dash.insights.title")}</p>
                    {insights.data.insights?.length ? (
                      <ul className="space-y-2">
                        {insights.data.insights.slice(0, 5).map((it, i) => (
                          <li key={i} className="flex gap-2 text-[12.5px] text-ink-body">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
                            {it}
                          </li>
                        ))}
                      </ul>
                    ) : <p className="text-[12.5px] text-ink-muted">{t("dash.insights.empty")}</p>}
                  </div>
                  <div>
                    <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-ink-muted">{t("dash.insights.topOverdue")}</p>
                    {insights.data.top_overdue_cases?.length ? (
                      <ul className="space-y-2">
                        {insights.data.top_overdue_cases.slice(0, 5).map((c, i) => (
                          <li key={i} className="flex items-center justify-between gap-2 text-[12.5px]">
                            <span className="font-mono text-ink-body">{c.case_ref}</span>
                            <span className="font-semibold text-red-600 tabular">{c.days_overdue} {t("dash.insights.daysOverdue")}</span>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="text-[12.5px] text-ink-muted">—</p>}
                  </div>
                  <div>
                    <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-ink-muted">{t("dash.insights.bottlenecks")}</p>
                    {insights.data.bottlenecks?.length ? (
                      <ul className="space-y-2">
                        {insights.data.bottlenecks.slice(0, 5).map((b, i) => (
                          <li key={i} className="flex gap-2 text-[12.5px] text-ink-body">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                            {b}
                          </li>
                        ))}
                      </ul>
                    ) : <p className="text-[12.5px] text-ink-muted">—</p>}
                  </div>
                </div>
              )}
              <p className="mt-4 border-t border-line pt-2 text-[11px] leading-relaxed text-ink-muted">
                {insights.data?.disclaimer || t("common.operationalDisclaimer")}
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {loading && (
        <Card className="mt-5">
          <TableSkeleton rows={6} cols={4} />
        </Card>
      )}
    </div>
  );
}
