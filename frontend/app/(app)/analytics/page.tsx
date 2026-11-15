"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Info } from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import type { AnalyticsOverview } from "@/lib/types";
import { humanize } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/skeleton";
import { ErrorState, PageHeader } from "@/components/states";
import { tx } from "@/lib/tx";

const TICK = { fontSize: 11, fill: "#64748B" };
const PIE_COLORS = ["#12304A", "#13A89E", "#D97706", "#DC2626", "#2563EB", "#7C3AED", "#64748B"];

function IllustrativeNote() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-medium text-amber-800">
      <Info size={11} /> {tx("Illustrative simulated data")}
    </span>
  );
}

export default function AnalyticsPage() {
  const overview = useAsync<AnalyticsOverview>(() => api.get<AnalyticsOverview>("/analytics/overview"), []);
  const volume = useAsync<{ month: string; total: number; abnormal: number; actionable: number }[]>(
    () => api.get("/analytics/screening-volume", { months: 12 }),
    []
  );
  const timeliness = useAsync<{ screening_type: string; avg_days_to_notification: number; avg_days_to_consultation: number; median_days_to_closure: number }[]>(
    () => api.get("/analytics/timeliness"),
    []
  );
  const lost = useAsync<{ reason: string; count: number }[]>(
    () => api.get("/analytics/lost-to-followup"),
    []
  );

  const anyLoading = overview.loading || volume.loading || timeliness.loading || lost.loading;
  const anyError = overview.error || volume.error || timeliness.error || lost.error;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={tx("Analytics")}
        subtitle={tx("Programme-level performance indicators. Values are computed from live data but labelled as illustrative simulated extracts.")}
        actions={<IllustrativeNote />}
      />

      {anyError && <ErrorState message={anyError} onRetry={() => { overview.refetch(); volume.refetch(); timeliness.refetch(); lost.refetch(); }} />}

      {anyLoading && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-line/60 bg-white p-4 shadow-card">
              <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
              <div className="mt-3 h-7 w-16 animate-pulse rounded bg-slate-200" />
            </div>
          ))}
        </div>
      )}

      {overview.data && !anyLoading && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <MetricCard label={tx("Screening volume")} value={overview.data.screening_volume} suffix="" />
          <MetricCard label={tx("Abnormal rate")} value={overview.data.abnormal_rate} suffix="%" />
          <MetricCard label={tx("Follow-up completion")} value={overview.data.follow_up_completion_rate} suffix="%" tone="teal" />
          <MetricCard label={tx("Overdue rate")} value={overview.data.overdue_rate} suffix="%" tone="red" />
          <MetricCard label={tx("Avg days → notification")} value={overview.data.avg_days_screening_to_notification} suffix="d" />
          <MetricCard label={tx("Avg days → consultation")} value={overview.data.avg_days_screening_to_consultation} suffix="d" />
          <MetricCard label={tx("Referral completion")} value={overview.data.referral_completion_rate} suffix="%" tone="teal" />
          <MetricCard label={tx("Lost to follow-up")} value={overview.data.lost_to_follow_up_count} suffix="" tone="red" />
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{tx("Screening volume by month")}</CardTitle>
            <IllustrativeNote />
          </CardHeader>
          <CardContent>
            {volume.data && volume.data.length > 0 ? (
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={volume.data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="#EEF2F7" vertical={false} />
                    <XAxis dataKey="month" tick={TICK} axisLine={false} tickLine={false} />
                    <YAxis tick={TICK} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="total" name="Total" stroke="#12304A" strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="abnormal" name="Abnormal" stroke="#DC2626" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="actionable" name="Actionable" stroke="#13A89E" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyChart />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tx("Timeliness by screening type (days)")}</CardTitle>
            <IllustrativeNote />
          </CardHeader>
          <CardContent>
            {timeliness.data && timeliness.data.length > 0 ? (
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timeliness.data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="#EEF2F7" vertical={false} />
                    <XAxis dataKey="screening_type" tick={TICK} axisLine={false} tickLine={false} tickFormatter={(v: string) => humanize(v).slice(0, 6)} />
                    <YAxis tick={TICK} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }} labelFormatter={(l: string) => humanize(String(l))} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="avg_days_to_notification" name="→ Notification" fill="#13A89E" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="avg_days_to_consultation" name="→ Consultation" fill="#12304A" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="median_days_to_closure" name="Median closure" fill="#D97706" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyChart />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tx("Lost to follow-up by reason")}</CardTitle>
            <IllustrativeNote />
          </CardHeader>
          <CardContent>
            {lost.data && lost.data.length > 0 ? (
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={lost.data} dataKey="count" nameKey="reason" cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={2}>
                      {lost.data.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyChart />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tx("Completion & conversion rates")}</CardTitle>
            <IllustrativeNote />
          </CardHeader>
          <CardContent>
            {overview.data ? (
              <div className="space-y-5 pt-2">
                <RateBar label={tx("Follow-up completion rate")} value={overview.data.follow_up_completion_rate} color="#13A89E" />
                <RateBar label={tx("Referral completion rate")} value={overview.data.referral_completion_rate} color="#7C3AED" />
                <RateBar label={tx("Overdue rate (lower is better)")} value={overview.data.overdue_rate} color="#DC2626" invert />
              </div>
            ) : (
              <EmptyChart />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ label, value, suffix, tone }: { label: string; value: number; suffix: string; tone?: "teal" | "red" }) {
  const color = tone === "red" ? "text-red-600" : tone === "teal" ? "text-teal-dark" : "text-navy";
  return (
    <Card className="p-4">
      <p className="text-[12.5px] font-medium text-ink-muted">{label}</p>
      <p className={`mt-1.5 text-[26px] font-semibold leading-none tabular ${color}`}>
        {typeof value === "number" ? (Number.isInteger(value) ? value : value.toFixed(1)) : "—"}
        <span className="ml-1 text-sm font-medium text-ink-muted">{suffix}</span>
      </p>
      <p className="mt-2"><IllustrativeNote /></p>
    </Card>
  );
}

function RateBar({ label, value, color, invert }: { label: string; value: number; color: string; invert?: boolean }) {
  const pct = Math.max(0, Math.min(100, value || 0));
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[13px]">
        <span className="font-medium text-ink-body">{label}</span>
        <span className="font-semibold tabular" style={{ color }}>{pct.toFixed(1)}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color, opacity: invert ? 0.75 : 1 }} />
      </div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[240px] items-center justify-center text-sm text-ink-muted">
      <TableSkeleton rows={1} cols={1} />
      <span className="absolute">{tx("No data returned by API.")}</span>
    </div>
  );
}
