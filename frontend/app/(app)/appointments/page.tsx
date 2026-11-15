"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarPlus, Check, Loader2, Plus, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { APPOINTMENT_STATUSES, humanize } from "@/lib/constants";
import type { Appointment, Paginated } from "@/lib/types";
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
import { AppointmentStatusBadge } from "@/components/StatusBadge";
import { EmptyState, ErrorState, FieldError, PageHeader } from "@/components/states";
import { Pagination } from "@/components/Pagination";
import { tx } from "@/lib/tx";

const scheduleSchema = z.object({
  patient_id: z.coerce.number().int().positive("Patient ID is required"),
  case_id: z.string().optional(),
  referral_id: z.string().optional(),
  department: z.string().min(1, "Department is required"),
  clinician_id: z.string().optional(),
  scheduled_at: z.string().min(1, "Date & time is required"),
  duration_min: z.string().optional(),
  notes: z.string().optional(),
});
type ScheduleValues = z.infer<typeof scheduleSchema>;

type ActionKind = "reschedule" | "cancel" | "complete" | null;

export default function AppointmentsPage() {
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [action, setAction] = useState<{ kind: ActionKind; appt: Appointment | null }>({ kind: null, appt: null });
  const [when, setWhen] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [attended, setAttended] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const params: Record<string, unknown> = { page, page_size: 15 };
  if (status) params.status = status;
  if (dateFrom) params.date_from = dateFrom;
  if (dateTo) params.date_to = dateTo;

  const { data, loading, error, refetch } = useAsync<Paginated<Appointment>>(
    () => api.get<Paginated<Appointment>>("/appointments", params),
    [status, dateFrom, dateTo, page]
  );

  const form = useForm<ScheduleValues>({ resolver: zodResolver(scheduleSchema) });

  const onSchedule = async (v: ScheduleValues) => {
    try {
      const body: Record<string, unknown> = {
        patient_id: v.patient_id,
        department: v.department,
        scheduled_at: new Date(v.scheduled_at).toISOString(),
        notes: v.notes || null,
      };
      if (v.case_id) body.case_id = Number(v.case_id);
      if (v.referral_id) body.referral_id = Number(v.referral_id);
      if (v.clinician_id) body.clinician_id = Number(v.clinician_id);
      if (v.duration_min) body.duration_min = Number(v.duration_min);
      await api.post("/appointments", body);
      setScheduleOpen(false);
      form.reset();
      refetch();
    } catch (e) {
      form.setError("root", { message: e instanceof Error ? e.message : "Failed" });
    }
  };

  const submitAction = async () => {
    if (!action.kind || !action.appt) return;
    setBusyId(action.appt.id);
    try {
      const a = action.appt;
      if (action.kind === "reschedule") {
        await api.put(`/appointments/${a.id}`, {
          scheduled_at: new Date(when).toISOString(),
          notes: notes || undefined,
        });
      } else if (action.kind === "cancel") {
        await api.post(`/appointments/${a.id}/cancel`, { reason: reason || "Cancelled" });
      } else {
        await api.post(`/appointments/${a.id}/complete`, { attended, notes: notes || undefined });
      }
      setAction({ kind: null, appt: null });
      setWhen(""); setReason(""); setNotes("");
      refetch();
    } finally {
      setBusyId(null);
    }
  };

  const openAction = (kind: ActionKind, appt: Appointment) => {
    setAction({ kind, appt });
    setWhen(""); setReason(""); setNotes("");
  };

  const active = (a: Appointment) => ["SCHEDULED", "CONFIRMED", "CHECKED_IN", "RESCHEDULED"].includes(a.status);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={tx("Appointments")}
        subtitle={tx("Schedule and track consultations. Completing an attended appointment advances the linked case.")}
        actions={<Button onClick={() => setScheduleOpen(true)}><CalendarPlus size={15} /> {tx("Schedule appointment")}</Button>}
      />

      <Card>
        <div className="flex flex-wrap items-end gap-3 border-b border-line/70 px-4 py-3">
          <div className="w-48">
            <Label>{tx("Status")}</Label>
            <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">{tx("All statuses")}</option>
              {APPOINTMENT_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
            </Select>
          </div>
          <div className="w-44">
            <Label>{tx("From date")}</Label>
            <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
          </div>
          <div className="w-44">
            <Label>{tx("To date")}</Label>
            <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setStatus(""); setDateFrom(""); setDateTo(""); setPage(1); }}>{tx("Reset")}</Button>
        </div>

        {loading && <TableSkeleton rows={8} cols={7} />}
        {error && <ErrorState message={error} onRetry={refetch} />}

        {data && !loading && (
          <>
            {data.items.length === 0 ? (
              <EmptyState title={tx("No appointments")} description={tx("Schedule a consultation for a patient or linked case.")} action={<Button size="sm" onClick={() => setScheduleOpen(true)}><Plus size={14} /> {tx("Schedule")}</Button>} />
            ) : (
              <Table>
                <THead>
                  <tr><TH>{tx("ID")}</TH><TH>{tx("Patient")}</TH><TH>{tx("Department")}</TH><TH>{tx("Scheduled")}</TH><TH>{tx("Duration")}</TH><TH>{tx("Status")}</TH><TH className="text-right">{tx("Actions")}</TH></tr>
                </THead>
                <TBody>
                  {data.items.map((a) => {
                    const busy = busyId === a.id;
                    return (
                      <TR key={a.id}>
                        <TD className="font-mono text-[12px] text-ink-muted">#{a.id}</TD>
                        <TD className="font-medium text-ink-heading">{a.patient_name || `#${a.patient_id}`}</TD>
                        <TD>{a.department}</TD>
                        <TD className="tabular text-[12.5px]">{formatDateTime(a.scheduled_at)}</TD>
                        <TD className="tabular text-[12.5px]">{a.duration_min ? `${a.duration_min} min` : "—"}</TD>
                        <TD><AppointmentStatusBadge status={a.status} /></TD>
                        <TD className="text-right">
                          <div className="inline-flex flex-wrap justify-end gap-1.5">
                            {active(a) && (
                              <>
                                <Button size="sm" variant="secondary" disabled={busy} onClick={() => openAction("reschedule", a)}>
                                  {busy ? <Loader2 size={13} className="animate-spin" /> : tx("Reschedule")}
                                </Button>
                                <Button size="sm" variant="accent" disabled={busy} onClick={() => openAction("complete", a)}>
                                  <Check size={13} /> {tx("Complete")}
                                </Button>
                                <Button size="sm" variant="danger" disabled={busy} onClick={() => openAction("cancel", a)}>
                                  <X size={13} /> {tx("Cancel")}
                                </Button>
                              </>
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
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        title={tx("Schedule appointment")}
        description={tx("Created in SCHEDULED status. If linked to a case, writes an APPOINTMENT_SCHEDULED event.")}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setScheduleOpen(false)}>{tx("Cancel")}</Button>
            <Button onClick={form.handleSubmit(onSchedule)} disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 size={15} className="animate-spin" />}
              {tx("Schedule")}
            </Button>
          </>
        }
      >
        <form onSubmit={form.handleSubmit(onSchedule)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>{tx("Patient ID *")}</Label>
            <Input type="number" {...form.register("patient_id")} />
            <FieldError message={form.formState.errors.patient_id?.message} />
          </div>
          <div>
            <Label>{tx("Department *")}</Label>
            <Input {...form.register("department")} />
            <FieldError message={form.formState.errors.department?.message} />
          </div>
          <div>
            <Label>{tx("Date & time *")}</Label>
            <Input type="datetime-local" {...form.register("scheduled_at")} />
            <FieldError message={form.formState.errors.scheduled_at?.message} />
          </div>
          <div>
            <Label>{tx("Duration (min)")}</Label>
            <Input type="number" placeholder="30" {...form.register("duration_min")} />
          </div>
          <div>
            <Label>{tx("Linked case ID")}</Label>
            <Input type="number" {...form.register("case_id")} />
          </div>
          <div>
            <Label>{tx("Referral ID")}</Label>
            <Input type="number" {...form.register("referral_id")} />
          </div>
          <div className="sm:col-span-2">
            <Label>{tx("Clinician user ID")}</Label>
            <Input type="number" {...form.register("clinician_id")} />
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
        onClose={() => setAction({ kind: null, appt: null })}
        title={
          action.kind === "reschedule" ? tx("Reschedule appointment")
          : action.kind === "cancel" ? tx("Cancel appointment")
          : tx("Complete appointment")
        }
        description={action.appt ? `Appointment #${action.appt.id} · ${action.appt.department} · ${formatDateTime(action.appt.scheduled_at)}` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAction({ kind: null, appt: null })}>{tx("Cancel")}</Button>
            <Button
              variant={action.kind === "cancel" ? "danger" : "accent"}
              onClick={submitAction}
              disabled={busyId === action.appt?.id || (action.kind === "reschedule" && !when)}
            >
              {busyId === action.appt?.id && <Loader2 size={15} className="animate-spin" />}
              {action.kind === "reschedule" ? tx("Save new time") : action.kind === "cancel" ? tx("Cancel appointment") : tx("Mark complete")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {action.kind === "reschedule" && (
            <div>
              <Label>{tx("New date & time *")}</Label>
              <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            </div>
          )}
          {action.kind === "cancel" && (
            <div>
              <Label>{tx("Cancellation reason")}</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={tx("Why is this appointment cancelled?")} />
            </div>
          )}
          {action.kind === "complete" && (
            <label className="flex items-center gap-2 rounded-lg border border-line bg-slate-50 px-3 py-2.5 text-[13.5px]">
              <input type="checkbox" checked={attended} onChange={(e) => setAttended(e.target.checked)} className="h-4 w-4 accent-teal" />
              {tx("Patient attended (unchecked = NO_SHOW; attended advances linked case)")}
            </label>
          )}
          {action.kind !== "cancel" && (
            <div>
              <Label>{tx("Notes")}</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
}
