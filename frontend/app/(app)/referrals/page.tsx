"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, Loader2, Plus, Send, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { REFERRAL_STATUSES, humanize } from "@/lib/constants";
import type { Paginated, Referral } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ReferralStatusBadge } from "@/components/StatusBadge";
import { EmptyState, ErrorState, FieldError, PageHeader } from "@/components/states";
import { Pagination } from "@/components/Pagination";
import { tx } from "@/lib/tx";

const createSchema = z.object({
  patient_id: z.coerce.number().int().positive("Patient ID is required"),
  case_id: z.string().optional(),
  to_department: z.string().min(1, "Target department is required"),
  reason: z.string().min(1, "Reason is required"),
  notes: z.string().optional(),
});
type CreateValues = z.infer<typeof createSchema>;

type ActionKind = "reject" | "complete" | null;

export default function ReferralsPage() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [action, setAction] = useState<{ kind: ActionKind; ref: Referral | null }>({ kind: null, ref: null });
  const [actionText, setActionText] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const params: Record<string, unknown> = { page, page_size: 15 };
  if (status) params.status = status;

  const { data, loading, error, refetch } = useAsync<Paginated<Referral>>(
    () => api.get<Paginated<Referral>>("/referrals", params),
    [status, page]
  );

  const form = useForm<CreateValues>({ resolver: zodResolver(createSchema) });

  const onCreate = async (v: CreateValues) => {
    try {
      const body: Record<string, unknown> = {
        patient_id: v.patient_id,
        to_department: v.to_department,
        reason: v.reason,
        notes: v.notes || null,
      };
      if (v.case_id) body.case_id = Number(v.case_id);
      await api.post("/referrals", body);
      setCreateOpen(false);
      form.reset();
      refetch();
    } catch (e) {
      form.setError("root", { message: e instanceof Error ? e.message : "Failed" });
    }
  };

  const runSimple = async (r: Referral, path: string, body?: unknown) => {
    setBusyId(r.id);
    try {
      await api.post(`/referrals/${r.id}/${path}`, body ?? {});
      refetch();
    } finally {
      setBusyId(null);
    }
  };

  const submitAction = async () => {
    if (!action.kind || !action.ref) return;
    setBusyId(action.ref.id);
    try {
      if (action.kind === "reject") {
        await api.post(`/referrals/${action.ref.id}/reject`, { reason: actionText || tx("No reason given") });
      } else {
        await api.post(`/referrals/${action.ref.id}/complete`, { outcome: actionText || "Completed" });
      }
      setAction({ kind: null, ref: null });
      setActionText("");
      refetch();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={tx("Referrals")}
        subtitle={tx("Outbound and inbound referrals. Accepting a referral advances the linked case toward appointment scheduling.")}
        actions={<Button onClick={() => setCreateOpen(true)}><Plus size={15} /> {tx("New referral")}</Button>}
      />

      <Card>
        <div className="flex flex-wrap items-end gap-3 border-b border-line/70 px-4 py-3">
          <div className="w-52">
            <Label>{tx("Status")}</Label>
            <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">{tx("All statuses")}</option>
              {REFERRAL_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
            </Select>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setStatus(""); setPage(1); }}>{tx("Reset")}</Button>
        </div>

        {loading && <TableSkeleton rows={8} cols={7} />}
        {error && <ErrorState message={error} onRetry={refetch} />}

        {data && !loading && (
          <>
            {data.items.length === 0 ? (
              <EmptyState title={tx("No referrals")} description={tx("Create a referral to route a patient to another department.")} action={<Button size="sm" onClick={() => setCreateOpen(true)}><Plus size={14} /> {tx("New referral")}</Button>} />
            ) : (
              <Table>
                <THead>
                  <tr><TH>{tx("ID")}</TH><TH>{tx("Patient")}</TH><TH>{tx("To department")}</TH><TH>{tx("Reason")}</TH><TH>{tx("Status")}</TH><TH>{tx("Sent / Responded")}</TH><TH className="text-right">{tx("Actions")}</TH></tr>
                </THead>
                <TBody>
                  {data.items.map((r) => {
                    const busy = busyId === r.id;
                    return (
                      <TR key={r.id}>
                        <TD className="font-mono text-[12px] text-ink-muted">#{r.id}</TD>
                        <TD className="font-medium text-ink-heading">{r.patient_name || `#${r.patient_id}`}</TD>
                        <TD>{r.to_department}</TD>
                        <TD className="max-w-[220px] truncate text-[12.5px] text-ink-muted">{r.reason}</TD>
                        <TD><ReferralStatusBadge status={r.status} /></TD>
                        <TD className="text-[12px] text-ink-muted tabular">
                          {formatDateTime(r.sent_at)}
                          {r.responded_at && <div>→ {formatDateTime(r.responded_at)}</div>}
                        </TD>
                        <TD className="text-right">
                          <div className="inline-flex flex-wrap justify-end gap-1.5">
                            {r.status === "DRAFT" && (
                              <Button size="sm" variant="accent" disabled={busy} onClick={() => runSimple(r, "send")}>
                                {busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} {tx("Send")}
                              </Button>
                            )}
                            {r.status === "SENT" && (
                              <>
                                <Button size="sm" variant="accent" disabled={busy} onClick={() => runSimple(r, "accept", { notes: undefined })}>
                                  {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} {tx("Accept")}
                                </Button>
                                <Button size="sm" variant="danger" disabled={busy} onClick={() => { setAction({ kind: "reject", ref: r }); setActionText(""); }}>
                                  <X size={13} /> {tx("Reject")}
                                </Button>
                              </>
                            )}
                            {r.status === "ACCEPTED" && (
                              <Button size="sm" variant="secondary" disabled={busy} onClick={() => { setAction({ kind: "complete", ref: r }); setActionText(""); }}>
                                {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} {tx("Complete")}
                              </Button>
                            )}
                          </div>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            )}
            <Pagination page={data.page} pageSize={data.page_size} total={data.total} onPage={setPage} />
          </>
        )}
      </Card>

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={tx("New referral")}
        description={tx("Created in DRAFT status — send it when ready.")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>{tx("Cancel")}</Button>
            <Button onClick={form.handleSubmit(onCreate)} disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 size={15} className="animate-spin" />}
              {tx("Create draft")}
            </Button>
          </>
        }
      >
        <form onSubmit={form.handleSubmit(onCreate)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>{tx("Patient ID *")}</Label>
            <Input type="number" {...form.register("patient_id")} />
            <FieldError message={form.formState.errors.patient_id?.message} />
          </div>
          <div>
            <Label>{tx("Linked case ID (optional)")}</Label>
            <Input type="number" {...form.register("case_id")} />
          </div>
          <div className="sm:col-span-2">
            <Label>{tx("To department *")}</Label>
            <Input placeholder={tx("e.g. General Surgery")} {...form.register("to_department")} />
            <FieldError message={form.formState.errors.to_department?.message} />
          </div>
          <div className="sm:col-span-2">
            <Label>{tx("Reason *")}</Label>
            <Textarea {...form.register("reason")} />
            <FieldError message={form.formState.errors.reason?.message} />
          </div>
          <div className="sm:col-span-2">
            <Label>{tx("Notes")}</Label>
            <Textarea {...form.register("notes")} />
          </div>
          {form.formState.errors.root && (
            <p className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{tx(form.formState.errors.root.message)}</p>
          )}
        </form>
      </Dialog>

      <Dialog
        open={!!action.kind}
        onClose={() => setAction({ kind: null, ref: null })}
        title={action.kind === "reject" ? tx("Reject referral") : tx("Complete referral")}
        description={action.ref ? `Referral #${action.ref.id} → ${action.ref.to_department}` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAction({ kind: null, ref: null })}>{tx("Cancel")}</Button>
            <Button
              variant={action.kind === "reject" ? "danger" : "accent"}
              onClick={submitAction}
              disabled={busyId === action.ref?.id}
            >
              {busyId === action.ref?.id && <Loader2 size={15} className="animate-spin" />}
              {action.kind === "reject" ? tx("Reject referral") : tx("Mark completed")}
            </Button>
          </>
        }
      >
        <Label>{action.kind === "reject" ? tx("Rejection reason *") : tx("Outcome *")}</Label>
        <Textarea
          value={actionText}
          onChange={(e) => setActionText(e.target.value)}
          placeholder={action.kind === "reject" ? tx("Why is this referral being rejected?") : tx("What was the outcome?")}
          className="mt-1.5"
        />
      </Dialog>
    </div>
  );
}
