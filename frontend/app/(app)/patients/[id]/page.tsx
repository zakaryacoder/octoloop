"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, CalendarDays, ClipboardList, Loader2, Mail, MapPin, Pencil, Phone, Send, Stethoscope, UserRound } from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { useI18n } from "@/lib/i18n";
import type { PatientDetail } from "@/lib/types";
import { ageFromDob, formatDate, formatDateTime } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/skeleton";
import { TabPanel, Tabs } from "@/components/ui/tabs";
import {
  AppointmentStatusBadge,
  CaseStatusBadge,
  ReferralStatusBadge,
  ResultBadge,
} from "@/components/StatusBadge";
import { EmptyState, ErrorState, FieldError } from "@/components/states";
import { tx } from "@/lib/tx";

const editSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  date_of_birth: z.string().min(1, "Date of birth is required"),
  gender: z.string().min(1, "Gender is required"),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  primary_clinician_id: z.string().optional(),
  medical_history_summary: z.string().optional(),
  allergies: z.string().optional(),
});
type EditValues = z.infer<typeof editSchema>;

export default function PatientDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ? Number(params.id) : NaN;
  const [tab, setTab] = useState("details");
  const { t } = useI18n();
  const [editOpen, setEditOpen] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);
  const editForm = useForm<EditValues>({ resolver: zodResolver(editSchema) });

  const openEdit = () => {
    if (!data) return;
    editForm.reset({
      first_name: data.first_name || "",
      last_name: data.last_name || "",
      date_of_birth: (data.date_of_birth || "").slice(0, 10),
      gender: data.gender || "",
      phone: data.phone || "",
      email: data.email || "",
      address: data.address || "",
      primary_clinician_id: data.primary_clinician_id ? String(data.primary_clinician_id) : "",
      medical_history_summary: data.medical_history_summary || "",
      allergies: data.allergies || "",
    });
    setEditErr(null);
    setEditOpen(true);
  };

  const onEditSubmit = async (v: EditValues) => {
    try {
      const body: Record<string, unknown> = { ...v };
      body.primary_clinician_id = v.primary_clinician_id ? Number(v.primary_clinician_id) : null;
      await api.put(`/patients/${id}`, body);
      setEditOpen(false);
      refetch();
    } catch (e) {
      setEditErr(e instanceof Error ? e.message : tx("Update failed"));
    }
  };

  const { data, loading, error, refetch } = useAsync<PatientDetail>(
    Number.isFinite(id) ? () => api.get<PatientDetail>(`/patients/${id}`) : null,
    [id]
  );

  if (loading) {
    return (
      <Card>
        <TableSkeleton rows={8} cols={4} />
      </Card>
    );
  }
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  const fullName = `${data.first_name} ${data.last_name}`;
  const age = ageFromDob(data.date_of_birth);

  const tabs = [
    { id: "details", label: "Details" },
    { id: "screenings", label: "Screenings", count: data.screenings?.length },
    { id: "cases", label: "Follow-up cases", count: data.follow_up_cases?.length },
    { id: "referrals", label: "Referrals", count: data.referrals?.length },
    { id: "appointments", label: "Appointments", count: data.appointments?.length },
  ];

  return (
    <div className="animate-fade-in">
      <Link href="/patients" className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-navy">
        <ArrowLeft size={13} /> {tx("Back to patients")}
      </Link>

      <Card className="mb-5">
        <div className="flex flex-wrap items-center gap-4 p-5">
          <Avatar name={fullName} size={56} className="bg-teal" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-ink-heading">{fullName}</h1>
            <p className="mt-0.5 text-sm text-ink-muted">
              <span className="font-mono">{data.mrn}</span>
              {age !== null && <> · {age} {tx("years")}</>}
              <span className="capitalize"> · {(data.gender || "").toLowerCase()}</span>
              {" · "}{tx("Born")} {formatDate(data.date_of_birth)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-ink-muted">
              {data.phone && (
                <span className="inline-flex items-center gap-1.5"><Phone size={13} /> {data.phone}</span>
              )}
              {data.email && (
                <span className="inline-flex items-center gap-1.5"><Mail size={13} /> {data.email}</span>
              )}
              {data.address && (
                <span className="inline-flex items-center gap-1.5"><MapPin size={13} /> {data.address}</span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="accent" size="sm" onClick={openEdit}>
              <Pencil size={14} /> {t("patients.edit")}
            </Button>
            <Link href="/screenings">
              <Button variant="secondary" size="sm"><Stethoscope size={14} /> {tx("New screening")}</Button>
            </Link>
            <Link href="/cases">
              <Button variant="secondary" size="sm"><ClipboardList size={14} /> {tx("Open case")}</Button>
            </Link>
          </div>
        </div>
      </Card>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      <div className="mt-4">
        <TabPanel active={tab} id="details">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>{tx("Demographics")}</CardTitle></CardHeader>
              <CardContent className="space-y-2.5 text-sm">
                <DetailRow label={tx("MRN")} value={data.mrn} mono />
                <DetailRow label={tx("Full name")} value={fullName} />
                <DetailRow label={tx("Date of birth")} value={formatDate(data.date_of_birth)} />
                <DetailRow label={tx("Gender")} value={data.gender} />
                <DetailRow label={tx("Phone")} value={data.phone || "—"} />
                <DetailRow label={tx("Email")} value={data.email || "—"} />
                <DetailRow label={tx("Address")} value={data.address || "—"} />
                <DetailRow label={tx("Registered")} value={formatDate(data.created_at)} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>{tx("Clinical summary")}</CardTitle></CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <p className="mb-1 text-[12.5px] font-semibold uppercase tracking-wide text-ink-muted">{tx("Medical history")}</p>
                  <p className="text-ink-body">{data.medical_history_summary || tx("No summary recorded.")}</p>
                </div>
                <div>
                  <p className="mb-1 text-[12.5px] font-semibold uppercase tracking-wide text-ink-muted">{tx("Allergies")}</p>
                  <p className="text-ink-body">{data.allergies || "None recorded (NKDA unknown)."}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-[12.5px] text-ink-muted">
                  <UserRound size={13} className="mr-1 inline" />
                  {tx("Primary clinician ID:")} {data.primary_clinician_id ?? "unassigned"}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabPanel>

        <TabPanel active={tab} id="screenings">
          <Card>
            {(!data.screenings || data.screenings.length === 0) ? (
              <EmptyState title={tx("No screenings")} description={tx("No screening records for this patient yet.")} />
            ) : (
              <Table>
                <THead><tr><TH>{tx("Date")}</TH><TH>{tx("Type")}</TH><TH>{tx("Facility")}</TH><TH>{tx("Result")}</TH><TH>{tx("Summary")}</TH></tr></THead>
                <TBody>
                  {data.screenings.map((s) => (
                    <TR key={s.id}>
                      <TD className="tabular">{formatDate(s.screening_date)}</TD>
                      <TD className="font-medium capitalize">{s.type.toLowerCase()}</TD>
                      <TD>{s.facility || "—"}</TD>
                      <TD><ResultBadge classification={s.result_classification} actionable={s.actionable} /></TD>
                      <TD className="max-w-xs truncate text-[12.5px] text-ink-muted">{s.result_summary || "—"}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        </TabPanel>

        <TabPanel active={tab} id="cases">
          <Card>
            {(!data.follow_up_cases || data.follow_up_cases.length === 0) ? (
              <EmptyState title={tx("No follow-up cases")} description={tx("Actionable results automatically open a follow-up case.")} />
            ) : (
              <Table>
                <THead><tr><TH>{tx("Case ref")}</TH><TH>{tx("Status")}</TH><TH>{tx("Priority")}</TH><TH>{tx("Due date")}</TH><TH>{tx("Next action")}</TH><TH /></tr></THead>
                <TBody>
                  {data.follow_up_cases.map((c) => (
                    <TR key={c.id}>
                      <TD className="font-mono text-[12.5px]">{c.case_ref}</TD>
                      <TD><CaseStatusBadge status={c.status} overdue={c.overdue} /></TD>
                      <TD className="capitalize text-[12.5px]">{c.priority.toLowerCase()}</TD>
                      <TD className="tabular">{formatDate(c.due_date)}</TD>
                      <TD className="max-w-xs truncate text-[12.5px] text-ink-muted">{c.next_action || "—"}</TD>
                      <TD className="text-right">
                        <Link href={`/cases/${c.id}`} className="text-xs font-medium text-teal-dark hover:underline">{tx("Open →")}</Link>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        </TabPanel>

        <TabPanel active={tab} id="referrals">
          <Card>
            {(!data.referrals || data.referrals.length === 0) ? (
              <EmptyState title={tx("No referrals")} description={tx("Referrals created for this patient appear here.")} icon="inbox" />
            ) : (
              <Table>
                <THead><tr><TH>{tx("To department")}</TH><TH>{tx("Reason")}</TH><TH>{tx("Status")}</TH><TH>{tx("Sent")}</TH><TH /></tr></THead>
                <TBody>
                  {data.referrals.map((r) => (
                    <TR key={r.id}>
                      <TD className="font-medium">{r.to_department}</TD>
                      <TD className="max-w-xs truncate text-[12.5px] text-ink-muted">{r.reason}</TD>
                      <TD><ReferralStatusBadge status={r.status} /></TD>
                      <TD className="tabular text-[12.5px]">{formatDate(r.sent_at)}</TD>
                      <TD className="text-right">
                        <Link href="/referrals" className="text-xs font-medium text-teal-dark hover:underline"><Send size={12} className="inline" /> {tx("Referrals")}</Link>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        </TabPanel>

        <TabPanel active={tab} id="appointments">
          <Card>
            {(!data.appointments || data.appointments.length === 0) ? (
              <EmptyState title={tx("No appointments")} description={tx("Scheduled appointments for this patient appear here.")} icon="inbox" />
            ) : (
              <Table>
                <THead><tr><TH>{tx("Scheduled")}</TH><TH>{tx("Department")}</TH><TH>{tx("Status")}</TH><TH>{tx("Notes")}</TH></tr></THead>
                <TBody>
                  {data.appointments.map((a) => (
                    <TR key={a.id}>
                      <TD className="tabular"><CalendarDays size={13} className="mr-1 inline text-ink-muted" />{formatDateTime(a.scheduled_at)}</TD>
                      <TD>{a.department}</TD>
                      <TD><AppointmentStatusBadge status={a.status} /></TD>
                      <TD className="max-w-xs truncate text-[12.5px] text-ink-muted">{a.notes || "—"}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        </TabPanel>
      </div>
      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={t("patients.editTitle")}
        description={t("patients.editDesc")}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={editForm.handleSubmit(onEditSubmit)} disabled={editForm.formState.isSubmitting}>
              {editForm.formState.isSubmitting && <Loader2 size={15} className="animate-spin" />}
              {t("common.save")}
            </Button>
          </>
        }
      >
        <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><Label>{t("patients.firstName")} *</Label><Input {...editForm.register("first_name")} /><FieldError message={editForm.formState.errors.first_name?.message} /></div>
          <div><Label>{t("patients.lastName")} *</Label><Input {...editForm.register("last_name")} /><FieldError message={editForm.formState.errors.last_name?.message} /></div>
          <div><Label>{t("patients.dob")} *</Label><Input type="date" {...editForm.register("date_of_birth")} /><FieldError message={editForm.formState.errors.date_of_birth?.message} /></div>
          <div><Label>{t("patients.gender")} *</Label><Input placeholder={tx("e.g. Female / Male / Other")} {...editForm.register("gender")} /><FieldError message={editForm.formState.errors.gender?.message} /></div>
          <div><Label>{t("patients.phone")}</Label><Input {...editForm.register("phone")} /></div>
          <div><Label>{t("patients.email")}</Label><Input type="email" {...editForm.register("email")} /></div>
          <div className="sm:col-span-2"><Label>{t("patients.address")}</Label><Input {...editForm.register("address")} /></div>
          <div><Label>{t("patients.primaryClinicianId")}</Label><Input type="number" {...editForm.register("primary_clinician_id")} /></div>
          <div />
          <div className="sm:col-span-2"><Label>{t("patients.medicalHistory")}</Label><Textarea {...editForm.register("medical_history_summary")} /></div>
          <div className="sm:col-span-2"><Label>{t("patients.allergies")}</Label><Input {...editForm.register("allergies")} placeholder={tx("e.g. NKDA, or list allergies")} /></div>
          {editErr && (
            <p className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{editErr}</p>
          )}
        </form>
      </Dialog>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line/50 pb-2 last:border-0 last:pb-0">
      <span className="text-ink-muted">{label}</span>
      <span className={`text-right text-ink-body ${mono ? "font-mono text-[12.5px]" : ""}`}>{value || "—"}</span>
    </div>
  );
}
