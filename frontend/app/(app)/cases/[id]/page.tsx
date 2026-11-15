"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRightLeft,
  CalendarDays,
  Loader2,
  Lock,
  MessageSquarePlus,
  Send,
  Sparkles,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import {
  CASE_STATUS_ORDER,
  CLOSURE_REASONS,
  PRIORITIES,
  humanize,
} from "@/lib/constants";
import type { AiCaseSummary, CaseDetail, CaseStatus } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  AppointmentStatusBadge,
  CaseStatusBadge,
  PriorityBadge,
  ReferralStatusBadge,
} from "@/components/StatusBadge";
import { CaseTimeline } from "@/components/CaseTimeline";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState, ErrorState, FieldError } from "@/components/states";
import { useI18n } from "@/lib/i18n";
import { tx } from "@/lib/tx";

export default function CaseDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ? Number(params.id) : NaN;

  const { data: c, loading, error, refetch } = useAsync<CaseDetail>(
    Number.isFinite(id) ? () => api.get<CaseDetail>(`/cases/${id}`) : null,
    [id]
  );

  const [advanceTo, setAdvanceTo] = useState<CaseStatus | "">("");
  const [advanceNote, setAdvanceNote] = useState("");
  const [advancing, setAdvancing] = useState(false);
  const [advanceErr, setAdvanceErr] = useState<string | null>(null);

  const [noteText, setNoteText] = useState("");
  const [contactOutcome, setContactOutcome] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const [closureReason, setClosureReason] = useState("RESOLVED");
  const [closureNote, setClosureNote] = useState("");
  const [closing, setClosing] = useState(false);
  const [closeErr, setCloseErr] = useState<string | null>(null);

  const [dueDate, setDueDate] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [updating, setUpdating] = useState(false);
  const { t } = useI18n();
  const [priority, setPriority] = useState("");
  const [responsibleId, setResponsibleId] = useState("");
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);

  const [ai, setAi] = useState<AiCaseSummary | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiErr, setAiErr] = useState<string | null>(null);

  if (loading) return <Card><TableSkeleton rows={8} cols={4} /></Card>;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!c) return null;

  const isClosed = c.status === "CLOSED";

  const onAdvance = async () => {
    if (!advanceTo) return;
    setAdvancing(true);
    setAdvanceErr(null);
    try {
      await api.post(`/cases/${id}/advance`, {
        to_status: advanceTo,
        note: advanceNote || undefined,
      });
      setAdvanceTo("");
      setAdvanceNote("");
      refetch();
    } catch (e) {
      setAdvanceErr(e instanceof Error ? e.message : tx("Advance failed"));
    } finally {
      setAdvancing(false);
    }
  };

  const onAddNote = async () => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      await api.post(`/cases/${id}/events`, {
        event_type: "NOTE",
        note: noteText.trim(),
        contact_outcome: contactOutcome || undefined,
      });
      setNoteText("");
      setContactOutcome("");
      refetch();
    } finally {
      setSavingNote(false);
    }
  };

  const onClose = async () => {
    if (!closureNote.trim()) {
      setCloseErr("A closure note is required.");
      return;
    }
    setClosing(true);
    setCloseErr(null);
    try {
      await api.post(`/cases/${id}/close`, {
        closure_reason: closureReason,
        note: closureNote.trim(),
      });
      setClosureNote("");
      refetch();
    } catch (e) {
      setCloseErr(e instanceof Error ? e.message : tx("Close failed"));
    } finally {
      setClosing(false);
    }
  };

  const onUpdate = async () => {
    if (!dueDate && !nextAction.trim() && !priority && !responsibleId.trim()) return;
    setUpdating(true);
    try {
      const body: Record<string, unknown> = {};
      if (priority) body.priority = priority;
      if (responsibleId.trim()) body.responsible_id = Number(responsibleId);
      if (dueDate) body.due_date = dueDate;
      if (nextAction.trim()) body.next_action = nextAction.trim();
      await api.put(`/cases/${id}`, body);
      setDueDate("");
      setNextAction("");
      setPriority("");
      setResponsibleId("");
      refetch();
    } finally {
      setUpdating(false);
    }
  };

  const onAi = async () => {
    setAiLoading(true);
    setAiErr(null);
    try {
      const res = await api.post<AiCaseSummary>("/ai/summarize-case", { case_id: id });
      setAi(res);
    } catch (e) {
      setAiErr(e instanceof Error ? e.message : "AI summary unavailable");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <Link href="/cases" className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-navy">
        <ArrowLeft size={13} /> {tx("Back to cases")}
      </Link>

      {/* Header card */}
      <Card className={`mb-5 ${c.overdue ? "border-red-300" : ""}`}>
        <div className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-sm text-ink-muted">{c.case_ref}</span>
              <CaseStatusBadge status={c.status} overdue={c.overdue} />
              <PriorityBadge priority={c.priority} />
              {c.overdue && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                  <AlertTriangle size={11} /> {tx("Overdue")}
                </span>
              )}
            </div>
            <h1 className="mt-2 text-xl font-bold text-ink-heading">
              {c.patient?.first_name ? `${c.patient.first_name} ${c.patient.last_name}` : c.patient_name || `Patient #${c.patient_id}`}
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              {c.screening_type ? humanize(c.screening_type) : tx("Manual case")}
              {c.result_classification && <> {tx("· Result:")} <span className="font-medium">{humanize(c.result_classification)}</span></>}
              {" · "}{tx("Opened")} {formatDate(c.created_at)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
            <HeaderStat label={tx("Responsible")} value={c.responsible_name || "Unassigned"} />
            <HeaderStat label={tx("Due date")} value={formatDate(c.due_date)} danger={c.overdue} />
            <HeaderStat label={tx("Last contact")} value={formatDateTime(c.last_contact_at)} />
            <HeaderStat label={tx("Screening ID")} value={c.screening_id ? `#${c.screening_id}` : "—"} mono />
            <HeaderStat label={tx("Patient ID")} value={`#${c.patient_id}`} mono />
            <HeaderStat label={tx("Updated")} value={formatDate(c.updated_at)} />
          </div>
        </div>
        {c.next_action && (
          <div className="border-t border-line/70 bg-teal-light/40 px-5 py-3 text-[13.5px]">
            <span className="font-semibold text-teal-dark">{tx("Next action:")} </span>
            <span className="text-ink-body">{c.next_action}</span>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Left column: workflow + timeline */}
        <div className="space-y-5 xl:col-span-2">
          {!isClosed && (
            <Card>
              <CardHeader>
                <CardTitle>{tx("Advance status")}</CardTitle>
                <span className="text-[11px] text-ink-muted">
                  {tx("Current:")} {humanize(c.status)} {tx("· skipping stages requires admin role or a note")}
                </span>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-64">
                    <Label>{tx("Move to status")}</Label>
                    <Select value={advanceTo} onChange={(e) => setAdvanceTo(e.target.value as CaseStatus)}>
                      <option value="">{tx("Select next status…")}</option>
                      {CASE_STATUS_ORDER.filter((s) => s !== c.status).map((s) => (
                        <option key={s} value={s}>{humanize(s)}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="min-w-[220px] flex-1">
                    <Label>{tx("Note (required if skipping)")}</Label>
                    <Input value={advanceNote} onChange={(e) => setAdvanceNote(e.target.value)} placeholder={tx("Optional context…")} />
                  </div>
                  <Button onClick={onAdvance} disabled={!advanceTo || advancing} variant="accent">
                    {advancing ? <Loader2 size={15} className="animate-spin" /> : <ArrowRightLeft size={15} />}
                    {tx("Advance")}
                  </Button>
                </div>
                {advanceErr && <p className="mt-2 text-xs text-red-600">{advanceErr}</p>}

                {/* Stage progress strip */}
                <div className="mt-5 flex flex-wrap items-center gap-1">
                  {CASE_STATUS_ORDER.map((s, i) => {
                    const reached = CASE_STATUS_ORDER.indexOf(c.status) >= i;
                    return (
                      <div key={s} className="flex items-center gap-1">
                        <span
                          title={humanize(s)}
                          className={`h-2 w-6 rounded-full ${reached ? "bg-teal" : "bg-slate-200"} ${s === c.status ? "ring-2 ring-teal/40" : ""}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>{tx("Case journey")}</CardTitle>
              <span className="text-[11px] text-ink-muted">{c.events?.length ?? 0} {tx("events")}</span>
            </CardHeader>
            <CardContent>
              <CaseTimeline events={c.events ?? []} />
            </CardContent>
          </Card>

          {!isClosed && (
            <Card>
              <CardHeader><CardTitle>{tx("Add note / patient contact")}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder={tx("Record a note or patient contact outcome…")}
                />
                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-56">
                    <Label>{tx("Contact outcome (optional)")}</Label>
                    <Input
                      value={contactOutcome}
                      onChange={(e) => setContactOutcome(e.target.value)}
                      placeholder={tx("e.g. Reached, left voicemail…")}
                    />
                  </div>
                  <Button onClick={onAddNote} disabled={!noteText.trim() || savingNote} variant="secondary">
                    {savingNote ? <Loader2 size={15} className="animate-spin" /> : <MessageSquarePlus size={15} />}
                    {tx("Add note")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {!isClosed && (
            <Card>
              <CardHeader><CardTitle>{t("cases.updateCase")}</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-40">
                    <Label>{t("cases.priority")}</Label>
                    <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
                      <option value="">{c.priority}</option>
                      {PRIORITIES.filter((p) => p !== c.priority).map((p) => (
                        <option key={p} value={p}>{humanize(p)}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="w-44">
                    <Label>{t("cases.responsible")}</Label>
                    <Input
                      type="number"
                      value={responsibleId}
                      onChange={(e) => setResponsibleId(e.target.value)}
                      placeholder={c.responsible_id ? `#${c.responsible_id}` : "user ID"}
                    />
                  </div>
                  <div className="w-44">
                    <Label>{t("cases.dueDate")}</Label>
                    <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                  </div>
                  <div className="min-w-[200px] flex-1">
                    <Label>{t("cases.nextAction")}</Label>
                    <Input value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder={c.next_action || tx("Set next action…")} />
                  </div>
                  <Button
                    onClick={onUpdate}
                    disabled={updating || (!dueDate && !nextAction.trim() && !priority && !responsibleId.trim())}
                    variant="secondary"
                  >
                    {updating && <Loader2 size={15} className="animate-spin" />} {t("common.save")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {!isClosed ? (
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="text-red-700">{tx("Close case")}</CardTitle>
                <span className="inline-flex items-center gap-1 text-[11px] text-ink-muted"><Lock size={11} /> {tx("Human-only action")}</span>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-56">
                    <Label>{tx("Closure reason")}</Label>
                    <Select value={closureReason} onChange={(e) => setClosureReason(e.target.value)}>
                      {CLOSURE_REASONS.map((r) => <option key={r} value={r}>{humanize(r)}</option>)}
                    </Select>
                  </div>
                  <div className="min-w-[220px] flex-1">
                    <Label>{tx("Closure note *")}</Label>
                    <Input value={closureNote} onChange={(e) => setClosureNote(e.target.value)} placeholder={tx("Required — why is this case closing?")} />
                  </div>
                  <Button variant="danger" onClick={() => setCloseConfirmOpen(true)} disabled={closing || !closureNote.trim()}>
                    {closing ? <Loader2 size={15} className="animate-spin" /> : <XCircle size={15} />}
                    {t("cases.closeCase")}
                  </Button>
                </div>
                {closeErr && <FieldError message={closeErr} />}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-teal/40 bg-teal-light/30">
              <CardContent className="py-4 text-sm text-teal-dark">
                <XCircle size={15} className="mr-1.5 inline" />
                {tx("This case is closed. No further workflow actions are available.")}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: AI + linked */}
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2"><Sparkles size={16} className="text-violet-600" /> {tx("AI operational summary")}</CardTitle>
            </CardHeader>
            <CardContent>
              {!ai && !aiLoading && (
                <Button variant="outline" className="w-full" onClick={onAi}>
                  <Sparkles size={15} /> {tx("Generate summary")}
                </Button>
              )}
              {aiLoading && <div className="py-6 text-center text-sm text-ink-muted"><Loader2 size={18} className="mx-auto mb-2 animate-spin text-teal" />{tx("Analysing case events…")}</div>}
              {aiErr && <p className="text-xs text-red-600">{aiErr}</p>}
              {ai && (
                <div className="space-y-3 text-[13px]">
                  <p className="rounded-lg bg-violet-50 p-3 text-ink-body">{ai.summary}</p>
                  {ai.overdue && (
                    <p className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-[11.5px] font-semibold text-red-700">
                      <AlertTriangle size={12} /> {tx("Flagged overdue")}
                    </p>
                  )}
                  <AiList title={tx("Missing steps")} items={ai.missing_steps} empty={tx("None identified.")} />
                  <AiList title={tx("Suggested next actions")} items={ai.suggested_next_actions} empty="None." />
                  <AiList title={tx("Risk flags")} items={ai.risk_flags} empty={tx("No risk flags.")} danger />
                  <Button variant="ghost" size="sm" className="w-full" onClick={onAi}><Sparkles size={13} /> {tx("Regenerate")}</Button>
                  <p className="border-t border-line pt-2 text-[11px] leading-relaxed text-ink-muted">
                    {ai.disclaimer || "AI-assisted operational intelligence only — deterministic, offline, never clinical advice. Verify before acting."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2"><Send size={15} /> {tx("Linked referrals")}</CardTitle>
              <Link href="/referrals" className="text-xs text-teal-dark hover:underline">{tx("All →")}</Link>
            </CardHeader>
            <CardContent>
              {(!c.referrals || c.referrals.length === 0) ? (
                <EmptyState title={tx("No referrals")} description={tx("Create a referral from the referrals module.")} />
              ) : (
                <ul className="space-y-2.5">
                  {c.referrals.map((r) => (
                    <li key={r.id} className="rounded-lg border border-line p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-semibold text-ink-heading">→ {r.to_department}</span>
                        <ReferralStatusBadge status={r.status} />
                      </div>
                      <p className="mt-1 text-[12px] text-ink-muted line-clamp-2">{r.reason}</p>
                      <p className="mt-1 text-[11px] text-ink-muted tabular">{tx("Sent")} {formatDateTime(r.sent_at)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2"><CalendarDays size={15} /> {tx("Linked appointments")}</CardTitle>
              <Link href="/appointments" className="text-xs text-teal-dark hover:underline">{tx("All →")}</Link>
            </CardHeader>
            <CardContent>
              {(!c.appointments || c.appointments.length === 0) ? (
                <EmptyState title={tx("No appointments")} description={tx("Schedule from the appointments module.")} />
              ) : (
                <Table>
                  <THead><tr><TH>{tx("When")}</TH><TH>{tx("Dept")}</TH><TH>{tx("Status")}</TH></tr></THead>
                  <TBody>
                    {c.appointments.map((a) => (
                      <TR key={a.id}>
                        <TD className="tabular text-[12px]">{formatDateTime(a.scheduled_at)}</TD>
                        <TD className="text-[12.5px]">{a.department}</TD>
                        <TD><AppointmentStatusBadge status={a.status} /></TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <ConfirmDialog
        open={closeConfirmOpen}
        onClose={() => setCloseConfirmOpen(false)}
        onConfirm={() => { setCloseConfirmOpen(false); void onClose(); }}
        title={t("cases.closeConfirmTitle")}
        description={`${t("cases.closeConfirmDesc")} ${t("cases.closureReason")}: ${humanize(closureReason)}.`}
        confirmLabel={t("cases.closeCase")}
        busy={closing}
      />
      {closeErr && <p className="mt-2 text-xs text-red-600">{closeErr}</p>}
    </div>
  );
}

function HeaderStat({ label, value, mono, danger }: { label: string; value: string; mono?: boolean; danger?: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</p>
      <p className={`mt-0.5 text-[13.5px] font-medium ${mono ? "font-mono" : ""} ${danger ? "text-red-600" : "text-ink-heading"}`}>{value}</p>
    </div>
  );
}

function AiList({ title, items, empty, danger }: { title: string; items?: string[]; empty: string; danger?: boolean }) {
  return (
    <div>
      <p className={`mb-1 text-[11.5px] font-semibold uppercase tracking-wide ${danger ? "text-red-600" : "text-ink-muted"}`}>{title}</p>
      {!items || items.length === 0 ? (
        <p className="text-[12.5px] text-ink-muted">{empty}</p>
      ) : (
        <ul className="space-y-1">
          {items.map((it, i) => (
            <li key={i} className={`flex gap-2 text-[12.5px] ${danger ? "text-red-700" : "text-ink-body"}`}>
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-current opacity-60" />
              {it}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
