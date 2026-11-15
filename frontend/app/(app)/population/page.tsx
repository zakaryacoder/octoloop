"use client";
// Population Health Intelligence (Phase 5) — staff only, aggregated & anonymized.
// All data from real /population/* endpoints; CSV export via /population/export.
import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  Clock,
  Download,
  Globe2,
  Loader2,
  Percent,
  Send,
  Stethoscope,
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
import { SCREENING_TYPES, humanize } from "@/lib/constants";
import type {
  PopulationCoveragePoint,
  PopulationDelayedCare,
  PopulationGeographic,
  PopulationOverview,
  PopulationTrendPoint,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, PageHeader } from "@/components/states";
import { KpiCard } from "@/components/KpiCard";
import { tx } from "@/lib/tx";

const CHART_TICKS = { fontSize: 11, fill: "#64748B" };

interface Filters {
  from: string;
  to: string;
  region: string;
  type: string;
}

const EMPTY: Filters = { from: "", to: "", region: "", type: "" };

export default function PopulationPage() {
  const { t } = useI18n();
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);

  const params: Record<string, unknown> = {};
  if (applied.from) params.from = applied.from;
  if (applied.to) params.to = applied.to;
  if (applied.type) params.type = applied.type;
  // region is a display filter; geographic endpoint returns all regions.

  const overview = useAsync<PopulationOverview>(
    () => api.get<PopulationOverview>("/population/overview", params),
    [applied]
  );
  const coverage = useAsync<PopulationCoveragePoint[]>(
    () => api.get<PopulationCoveragePoint[]>("/population/coverage", params),
    [applied]
  );
  const geographic = useAsync<PopulationGeographic[]>(
    () => api.get<PopulationGeographic[]>("/population/geographic"),
    []
  );
  const delayed = useAsync<PopulationDelayedCare[]>(
    () => api.get<PopulationDelayedCare[]>("/population/delayed-care"),
    []
  );
  const trends = useAsync<PopulationTrendPoint[]>(
    () => api.get<PopulationTrendPoint[]>("/population/trends", { months: 12 }),
    []
  );

  const loading = overview.loading;
  const error = overview.error;

  const onExport = async () => {
    setExporting(true);
    setExportErr(null);
    try {
      await api.download(
        "/population/export",
        { format: "csv", ...params },
        "octoloop-population-export.csv"
      );
    } catch (e) {
      setExportErr(e instanceof Error ? e.message : tx("Export failed"));
    } finally {
      setExporting(false);
    }
  };

  const regions = geographic.data ?? [];
  const filteredRegions = applied.region
    ? regions.filter((r) => r.region === applied.region)
    : regions;
  const maxScreening = Math.max(...filteredRegions.map((r) => r.screening_count), 1);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={t("pop.title")}
        subtitle={t("pop.subtitle")}
        actions={
          <Button onClick={onExport} disabled={exporting}>
            {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            {t("pop.exportCsv")}
          </Button>
        }
      />

      <div className="mb-5 rounded-lg border border-teal/30 bg-teal-light/50 px-4 py-2.5 text-[12.5px] text-teal-dark">
        <Globe2 size={14} className="mr-1.5 inline" />
        {t("pop.operationalLabel")}
      </div>
      {exportErr && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{exportErr}</div>
      )}

      {/* Filters */}
      <Card className="mb-5">
        <div className="flex flex-wrap items-end gap-3 p-4">
          <div className="w-40">
            <Label>{t("pop.filters.from")}</Label>
            <Input type="date" value={draft.from} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} />
          </div>
          <div className="w-40">
            <Label>{t("pop.filters.to")}</Label>
            <Input type="date" value={draft.to} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} />
          </div>
          <div className="w-48">
            <Label>{t("pop.filters.region")}</Label>
            <Select value={draft.region} onChange={(e) => setDraft((d) => ({ ...d, region: e.target.value }))}>
              <option value="">{t("pop.filters.allRegions")}</option>
              {regions.map((r) => (
                <option key={r.region} value={r.region}>{r.region}</option>
              ))}
            </Select>
          </div>
          <div className="w-48">
            <Label>{t("pop.filters.type")}</Label>
            <Select value={draft.type} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}>
              <option value="">{t("pop.filters.allTypes")}</option>
              {SCREENING_TYPES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
            </Select>
          </div>
          <Button onClick={() => setApplied(draft)}>{t("pop.filters.apply")}</Button>
          <Button variant="ghost" size="sm" onClick={() => { setDraft(EMPTY); setApplied(EMPTY); }}>{t("common.reset")}</Button>
        </div>
      </Card>

      {loading && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-line/60 bg-white p-4 shadow-card">
              <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
              <div className="mt-3 h-7 w-16 animate-pulse rounded bg-slate-200" />
            </div>
          ))}
        </div>
      )}
      {error && <ErrorState message={error} onRetry={overview.refetch} />}

      {overview.data && !loading && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            <KpiCard label={t("pop.kpi.coverage")} value={`${overview.data.screening_coverage_rate.toFixed(1)}%`} icon={Percent} tone="teal" />
            <KpiCard label={t("pop.kpi.abnormalRate")} value={`${overview.data.abnormal_rate.toFixed(1)}%`} icon={Activity} tone="red" />
            <KpiCard label={t("pop.kpi.followupCompletion")} value={`${overview.data.follow_up_completion_rate.toFixed(1)}%`} icon={Stethoscope} tone="navy" />
            <KpiCard label={t("pop.kpi.avgDays")} value={overview.data.avg_days_to_consultation.toFixed(1)} icon={Clock} tone="blue" />
            <KpiCard label={t("pop.kpi.delayedCare")} value={overview.data.delayed_care_count} icon={AlertTriangle} tone="amber" />
            <KpiCard label={t("pop.kpi.referralCompletion")} value={`${overview.data.referral_completion_rate.toFixed(1)}%`} icon={Send} tone="violet" />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>{t("pop.chartByType")}</CardTitle></CardHeader>
              <CardContent>
                {overview.data.by_type?.length ? (
                  <div style={{ height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={overview.data.by_type} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                        <CartesianGrid stroke="#EEF2F7" vertical={false} />
                        <XAxis dataKey="type" tick={CHART_TICKS} axisLine={false} tickLine={false} tickFormatter={(v: string) => humanize(v).slice(0, 8)} />
                        <YAxis tick={CHART_TICKS} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }} labelFormatter={(l: string) => humanize(String(l))} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="screenings" name="Screenings" fill="#12304A" radius={[4, 4, 0, 0]} barSize={18} />
                        <Bar dataKey="abnormal" name="Abnormal" fill="#DC2626" radius={[4, 4, 0, 0]} barSize={18} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <EmptyState title={t("pop.noData")} />}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>{t("pop.chartCoverage")}</CardTitle></CardHeader>
              <CardContent>
                {coverage.data && coverage.data.length > 0 ? (
                  <div style={{ height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={coverage.data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                        <CartesianGrid stroke="#EEF2F7" vertical={false} />
                        <XAxis dataKey="month" tick={CHART_TICKS} axisLine={false} tickLine={false} />
                        <YAxis tick={CHART_TICKS} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line type="monotone" dataKey="coverage_rate" name="Coverage %" stroke="#13A89E" strokeWidth={2.5} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="total" name="Total" stroke="#12304A" strokeWidth={2} dot={{ r: 2 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : <EmptyState title={t("pop.noData")} />}
              </CardContent>
            </Card>
          </div>

          {/* Geographic distribution — region cards with bars (no map library) */}
          <Card className="mt-5">
            <CardHeader><CardTitle>{t("pop.chartGeographic")}</CardTitle></CardHeader>
            <CardContent>
              {filteredRegions.length === 0 ? (
                <EmptyState title={t("pop.noData")} description={t("pop.filters.region")} />
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {filteredRegions.map((r) => (
                    <div key={r.region} className="rounded-lg border border-line p-3.5">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[13.5px] font-semibold text-ink-heading">{r.region}</span>
                        <span className="text-[12px] font-semibold tabular text-navy">{r.screening_count}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-teal" style={{ width: `${(r.screening_count / maxScreening) * 100}%` }} />
                      </div>
                      <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
                        <MiniStat label={t("pop.abnormalCount")} value={String(r.abnormal_count)} tone="text-red-600" />
                        <MiniStat label={t("pop.completionRate")} value={`${r.completion_rate.toFixed(0)}%`} tone="text-teal-dark" />
                        <MiniStat label={t("pop.overdueRate")} value={`${r.overdue_rate.toFixed(0)}%`} tone="text-amber-600" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>{t("pop.chartDelayedCare")}</CardTitle></CardHeader>
              <CardContent>
                {delayed.data && delayed.data.length > 0 ? (
                  <div style={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={delayed.data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                        <CartesianGrid stroke="#EEF2F7" vertical={false} />
                        <XAxis dataKey="bucket_days" tick={CHART_TICKS} axisLine={false} tickLine={false} />
                        <YAxis tick={CHART_TICKS} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }} labelFormatter={(l: string) => `${l} days`} />
                        <Bar dataKey="count" name="Cases" fill="#D97706" radius={[4, 4, 0, 0]} barSize={22} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <EmptyState title={t("pop.noData")} />}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>{t("pop.chartTrends")}</CardTitle></CardHeader>
              <CardContent>
                {trends.data && trends.data.length > 0 ? (
                  <div style={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trends.data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                        <CartesianGrid stroke="#EEF2F7" vertical={false} />
                        <XAxis dataKey="month" tick={CHART_TICKS} axisLine={false} tickLine={false} />
                        <YAxis tick={CHART_TICKS} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line type="monotone" dataKey="follow_up_completion_rate" name="Follow-up completion %" stroke="#13A89E" strokeWidth={2} dot={{ r: 2 }} />
                        <Line type="monotone" dataKey="abnormal_rate" name="Abnormal rate %" stroke="#DC2626" strokeWidth={2} dot={{ r: 2 }} />
                        <Line type="monotone" dataKey="screening_coverage_rate" name="Coverage %" stroke="#12304A" strokeWidth={2} dot={{ r: 2 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : <EmptyState title={t("pop.noData")} />}
              </CardContent>
            </Card>
          </div>
        </>
      )}
      {loading && (
        <Card className="mt-5"><TableSkeleton rows={6} cols={3} /></Card>
      )}
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-md bg-slate-50 px-1 py-1.5">
      <p className={`text-[13px] font-bold tabular ${tone}`}>{value}</p>
      <p className="text-[10px] text-ink-muted">{label}</p>
    </div>
  );
}
