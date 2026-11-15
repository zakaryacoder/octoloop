"use client";

import { useState } from "react";
import { Info, Timer, Stethoscope, Send, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import type { AnalyticsOverview } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/skeleton";
import { ErrorState, PageHeader } from "@/components/states";
import { KpiCard } from "@/components/KpiCard";
import { tx } from "@/lib/tx";

type MetricKey = "notif" | "consult" | "referral" | "overdue";

// lowerIsBetter: for days and overdue rate a decrease is an improvement.
const METRICS: { key: MetricKey; label: string; unit: string; lowerIsBetter: boolean }[] = [
  { key: "notif", label: "Avg days → notification", unit: "d", lowerIsBetter: true },
  { key: "consult", label: "Avg days → consultation", unit: "d", lowerIsBetter: true },
  { key: "referral", label: tx("Referral completion rate"), unit: "%", lowerIsBetter: false },
  { key: "overdue", label: "Overdue rate (lower is better)", unit: "%", lowerIsBetter: true },
];

function fmt(v: number | null, unit: string): string {
  if (v === null || Number.isNaN(v)) return "—";
  return `${Math.round(v * 10) / 10}${unit === "%" ? "%" : ""}`;
}

export default function ImpactPage() {
  const overview = useAsync<AnalyticsOverview>(
    () => api.get<AnalyticsOverview>("/analytics/overview"),
    []
  );
  // Baseline values are ASSUMPTIONS entered by the user, never measurements.
  const [baseline, setBaseline] = useState<Record<MetricKey, string>>({
    notif: "",
    consult: "",
    referral: "",
    overdue: "",
  });
  const [source, setSource] = useState("");

  const o = overview.data;
  const current: Record<MetricKey, number | null> = {
    notif: o ? Math.max(0, o.avg_days_screening_to_notification) : null,
    consult: o ? Math.max(0, o.avg_days_screening_to_consultation) : null,
    referral: o ? o.referral_completion_rate : null,
    overdue: o ? o.overdue_rate : null,
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={tx("Impact")}
        subtitle={tx("Compare current performance with a baseline you define. Baseline values are assumptions, not measurements.")}
        actions={
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-medium text-amber-800">
            <Info size={11} /> {tx("Illustrative simulated data")}
          </span>
        }
      />

      {overview.error && <ErrorState message={overview.error} onRetry={overview.refetch} />}
      {overview.loading && <TableSkeleton rows={4} cols={4} />}

      {o && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <KpiCard label={tx("Avg days → notification")} value={fmt(current.notif, "d")} icon={Timer} tone="teal" />
            <KpiCard label={tx("Avg days → consultation")} value={fmt(current.consult, "d")} icon={Stethoscope} tone="blue" />
            <KpiCard label={tx("Referral completion rate")} value={fmt(current.referral, "%")} icon={Send} tone="navy" />
            <KpiCard label={tx("Lost to follow-up")} value={o.lost_to_follow_up_count} icon={AlertTriangle} tone="amber" />
          </div>

          <Card className="mt-5">
            <CardHeader>
              <CardTitle>{tx("Baseline assumptions")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-[12.5px] text-ink-muted">
                {tx("Enter the situation before OCTOLOOP (from a real clinic or a cited source). Nothing is pre-filled on purpose.")}
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                {METRICS.map((m) => (
                  <div key={m.key}>
                    <Label>{tx(m.label)}</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={baseline[m.key]}
                      onChange={(e) => setBaseline({ ...baseline, [m.key]: e.target.value })}
                      placeholder={m.unit === "%" ? "%" : tx("days")}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <Label>{tx("Baseline source")}</Label>
                <Input
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder={tx("Clinic, study or report with year")}
                />
                {!source.trim() && (
                  <p className="mt-1 text-[12px] text-amber-700">
                    {tx("A source is required before this comparison can be presented as evidence.")}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="mt-5">
            <CardHeader>
              <CardTitle>{tx("Before vs with OCTOLOOP")}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <THead>
                  <TR>
                    <TH>{tx("Metric")}</TH>
                    <TH>{tx("Baseline (assumption)")}</TH>
                    <TH>{tx("With OCTOLOOP (current data)")}</TH>
                    <TH>{tx("Change")}</TH>
                  </TR>
                </THead>
                <TBody>
                  {METRICS.map((m) => {
                    const b = baseline[m.key] === "" ? null : Number(baseline[m.key]);
                    const c = current[m.key];
                    const delta = b !== null && c !== null && !Number.isNaN(b) ? c - b : null;
                    const good = delta !== null && (m.lowerIsBetter ? delta < 0 : delta > 0);
                    const bad = delta !== null && (m.lowerIsBetter ? delta > 0 : delta < 0);
                    return (
                      <TR key={m.key}>
                        <TD>{tx(m.label)}</TD>
                        <TD>{fmt(b, m.unit)}</TD>
                        <TD>{fmt(c, m.unit)}</TD>
                        <TD>
                          <span className={good ? "font-medium text-teal-dark" : bad ? "font-medium text-red-600" : "text-ink-muted"}>
                            {delta === null ? "—" : `${delta > 0 ? "+" : ""}${Math.round(delta * 10) / 10}${m.unit === "%" ? " pt" : " d"}`}
                          </span>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
              <p className="mt-3 text-[12px] text-ink-muted">
                {tx("Current values come from synthetic demo data. This view is not clinical evidence; real results require a pilot.")}
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
