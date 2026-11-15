"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ClipboardList, Loader2, Plus, Stethoscope, UserPlus } from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { useI18n } from "@/lib/i18n";
import {
  ACTIONABLE_CLASSIFICATIONS,
  RESULT_CLASSIFICATIONS,
  SCREENING_TYPES,
  humanize,
} from "@/lib/constants";
import type { Paginated, Screening } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ResultBadge } from "@/components/StatusBadge";
import { EmptyState, ErrorState, FieldError, PageHeader } from "@/components/states";
import { Pagination } from "@/components/Pagination";
import { tx } from "@/lib/tx";

const registerSchema = z.object({
  patient_id: z.coerce.number().int().positive("Patient ID is required"),
  type: z.enum(SCREENING_TYPES as [string, ...string[]]) as z.ZodType<(typeof SCREENING_TYPES)[number]>,
  screening_date: z.string().min(1, "Screening date is required"),
  facility: z.string().optional(),
  performed_by: z.string().optional(),
});
type RegisterValues = z.infer<typeof registerSchema>;

const resultSchema = z.object({
  result_classification: z.enum(RESULT_CLASSIFICATIONS as [string, ...string[]]) as z.ZodType<(typeof RESULT_CLASSIFICATIONS)[number]>,
  result_summary: z.string().min(1, "Result summary is required"),
  recorded_by: z.string().min(1, "Recorded by is required"),
});
type ResultValues = z.infer<typeof resultSchema>;

export default function ScreeningsPage() {
  const [type, setType] = useState("");
  const [classification, setClassification] = useState("");
  const [patientId, setPatientId] = useState("");
  const [page, setPage] = useState(1);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [resultFor, setResultFor] = useState<Screening | null>(null);
  const [createdCase, setCreatedCase] = useState<{ case_ref?: string; id?: number } | null>(null);
  const { t } = useI18n();
  const [assignFor, setAssignFor] = useState<Screening | null>(null);
  const [assignClinicianId, setAssignClinicianId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignErr, setAssignErr] = useState<string | null>(null);

  const params: Record<string, unknown> = { page, page_size: 15 };
  if (type) params.type = type;
  if (classification) params.classification = classification;
  if (patientId) params.patient_id = patientId;

  const { data, loading, error, refetch } = useAsync<Paginated<Screening>>(
    () => api.get<Paginated<Screening>>("/screenings", params),
    [type, classification, patientId, page]
  );

  const regForm = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { type: "BREAST" },
  });
  const resForm = useForm<ResultValues>({
    resolver: zodResolver(resultSchema),
    defaultValues: { result_classification: "NORMAL" },
  });

  const onRegister = async (v: RegisterValues) => {
    try {
      await api.post("/screenings", {
        ...v,
        facility: v.facility || null,
        performed_by: v.performed_by || null,
      });
      setRegisterOpen(false);
      regForm.reset();
      refetch();
    } catch (e) {
      regForm.setError("root", { message: e instanceof Error ? e.message : "Failed" });
    }
  };

  const onRecordResult = async (v: ResultValues) => {
    if (!resultFor) return;
    try {
      const resp = await api.post<{ screening: Screening; created_case?: { id: number; case_ref: string } }>(
        `/screenings/${resultFor.id}/result`,
        v
      );
      setCreatedCase(resp.created_case ?? null);
      if (!resp.created_case) {
        setResultFor(null);
        resForm.reset();
      }
      refetch();
    } catch (e) {
      resForm.setError("root", { message: e instanceof Error ? e.message : "Failed" });
    }
  };

  const closeResult = () => {
    setResultFor(null);
    setCreatedCase(null);
    resForm.reset();
  };
  const openAssign = (s: Screening) => {
    setAssignFor(s);
    setAssignClinicianId(s.assigned_clinician_id ? String(s.assigned_clinician_id) : "");
    setAssignErr(null);
  };
  const onAssign = async () => {
    if (!assignFor || !assignClinicianId.trim()) return;
    setAssigning(true);
    setAssignErr(null);
    try {
      await api.post(`/screenings/${assignFor.id}/assign`, {
        clinician_id: Number(assignClinicianId),
      });
      setAssignFor(null);
      setAssignClinicianId("");
      refetch();
    } catch (e) {
      setAssignErr(e instanceof Error ? e.message : tx("Assign failed"));
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={tx("Screenings")}
        subtitle={tx("Register screening encounters and record results. Actionable results (ABNORMAL / BORDERLINE) auto-open a follow-up case.")}
        actions={
          <Button onClick={() => setRegisterOpen(true)}>
            <Plus size={15} /> {tx("Register screening")}
          </Button>
        }
      />

      <Card>
        <div className="flex flex-wrap items-end gap-3 border-b border-line/70 px-4 py-3">
          <div className="w-40">
            <Label>{tx("Type")}</Label>
            <Select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
              <option value="">{tx("All types")}</option>
              {SCREENING_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
            </Select>
          </div>
          <div className="w-44">
            <Label>{tx("Result classification")}</Label>
            <Select value={classification} onChange={(e) => { setClassification(e.target.value); setPage(1); }}>
              <option value="">{tx("All results")}</option>
              {RESULT_CLASSIFICATIONS.map((r) => <option key={r} value={r}>{humanize(r)}</option>)}
            </Select>
          </div>
          <div className="w-36">
            <Label>{tx("Patient ID")}</Label>
            <Input
              inputMode="numeric"
              placeholder="e.g. 12"
              value={patientId}
              onChange={(e) => { setPatientId(e.target.value); setPage(1); }}
            />
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setType(""); setClassification(""); setPatientId(""); setPage(1); }}>
            {tx("Reset filters")}
          </Button>
        </div>

        {loading && <TableSkeleton rows={8} cols={7} />}
        {error && <ErrorState message={error} onRetry={refetch} />}

        {data && !loading && (
          <>
            {data.items.length === 0 ? (
              <EmptyState
                title={tx("No screenings found")}
                description={tx("Adjust filters or register a new screening encounter.")}
                action={<Button size="sm" onClick={() => setRegisterOpen(true)}><Plus size={14} /> {tx("Register screening")}</Button>}
              />
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>{tx("ID")}</TH><TH>{tx("Patient")}</TH><TH>{tx("Type")}</TH><TH>{tx("Date")}</TH><TH>{tx("Facility")}</TH>
                    <TH>{tx("Performed by")}</TH><TH>{tx("Result")}</TH><TH className="text-right">{tx("Action")}</TH>
                  </tr>
                </THead>
                <TBody>
                  {data.items.map((s) => (
                    <TR key={s.id}>
                      <TD className="font-mono text-[12px] text-ink-muted">#{s.id}</TD>
                      <TD className="font-medium text-ink-heading">{s.patient_name || `Patient #${s.patient_id}`}</TD>
                      <TD className="capitalize">{s.type.toLowerCase()}</TD>
                      <TD className="tabular">{formatDate(s.screening_date)}</TD>
                      <TD>{s.facility || "—"}</TD>
                      <TD>{s.performed_by || "—"}</TD>
                      <TD><ResultBadge classification={s.result_classification} actionable={s.actionable} /></TD>
                      <TD className="text-right">
                        <div className="inline-flex flex-wrap justify-end gap-1.5">
                          <Button size="sm" variant="secondary" onClick={() => openAssign(s)}>
                            <UserPlus size={13} /> {t("screenings.assign")}
                          </Button>
                          {!s.result_classification ? (
                            <Button size="sm" variant="accent" onClick={() => setResultFor(s)}>
                              {tx("Record result")}
                            </Button>
                          ) : (
                            <span className="self-center text-[11.5px] text-ink-muted">{tx("Recorded")}</span>
                          )}
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
            <Pagination page={data.page} pageSize={data.page_size} total={data.total} onPage={setPage} />
          </>
        )}
      </Card>

      <Dialog
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        title={tx("Register screening")}
        description={tx("Creates a screening encounter with no result yet. Record the result separately once available.")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRegisterOpen(false)}>{tx("Cancel")}</Button>
            <Button onClick={regForm.handleSubmit(onRegister)} disabled={regForm.formState.isSubmitting}>
              {regForm.formState.isSubmitting && <Loader2 size={15} className="animate-spin" />}
              {tx("Register")}
            </Button>
          </>
        }
      >
        <form onSubmit={regForm.handleSubmit(onRegister)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>{tx("Patient ID *")}</Label>
            <Input type="number" placeholder={tx("Numeric patient id")} {...regForm.register("patient_id")} />
            <FieldError message={regForm.formState.errors.patient_id?.message} />
          </div>
          <div>
            <Label>{tx("Screening type *")}</Label>
            <Select {...regForm.register("type")}>
              {SCREENING_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
            </Select>
          </div>
          <div>
            <Label>{tx("Screening date *")}</Label>
            <Input type="date" {...regForm.register("screening_date")} />
            <FieldError message={regForm.formState.errors.screening_date?.message} />
          </div>
          <div>
            <Label>{tx("Facility")}</Label>
            <Input {...regForm.register("facility")} />
          </div>
          <div className="sm:col-span-2">
            <Label>{tx("Performed by")}</Label>
            <Input {...regForm.register("performed_by")} />
          </div>
          {regForm.formState.errors.root && (
            <p className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
              {tx(regForm.formState.errors.root.message)}
            </p>
          )}
        </form>
      </Dialog>

      <Dialog
        open={!!resultFor}
        onClose={closeResult}
        title={createdCase ? "Follow-up case created" : tx("Record screening result")}
        description={
          createdCase
            ? undefined
            : `Screening #${resultFor?.id} — ${resultFor?.patient_name || `Patient #${resultFor?.patient_id}`}. ${ACTIONABLE_CLASSIFICATIONS.join(" / ")} are actionable and will auto-open a case.`
        }
        footer={
          createdCase ? (
            <>
              <Button variant="secondary" onClick={closeResult}>{tx("Close")}</Button>
              {createdCase.id && (
                <Link href={`/cases/${createdCase.id}`}>
                  <Button><ClipboardList size={15} /> {tx("Open follow-up case")}</Button>
                </Link>
              )}
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={closeResult}>{tx("Cancel")}</Button>
              <Button onClick={resForm.handleSubmit(onRecordResult)} disabled={resForm.formState.isSubmitting}>
                {resForm.formState.isSubmitting && <Loader2 size={15} className="animate-spin" />}
                {tx("Save result")}
              </Button>
            </>
          )
        }
      >
        {createdCase ? (
          <div className="rounded-lg border border-teal/30 bg-teal-light p-4 text-sm text-teal-dark">
            <Stethoscope size={16} className="mb-2" />
            <p className="font-semibold">{tx("Actionable result — follow-up case opened.")}</p>
            <p className="mt-1">
              {tx("Case reference:")} <span className="font-mono font-semibold">{createdCase.case_ref ?? `#${createdCase.id}`}</span>{tx(". Assign a responsible clinician and due date from the case page.")}
            </p>
          </div>
        ) : (
          <form onSubmit={resForm.handleSubmit(onRecordResult)} className="space-y-4">
            <div>
              <Label>{tx("Result classification *")}</Label>
              <Select {...resForm.register("result_classification")}>
                {RESULT_CLASSIFICATIONS.map((r) => (
                  <option key={r} value={r}>
                    {humanize(r)}{ACTIONABLE_CLASSIFICATIONS.includes(r as never) ? tx(" — actionable") : ""}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>{tx("Result summary *")}</Label>
              <Textarea placeholder={tx("e.g. BI-RADS 4 lesion, right breast upper outer quadrant…")} {...resForm.register("result_summary")} />
              <FieldError message={resForm.formState.errors.result_summary?.message} />
            </div>
            <div>
              <Label>{tx("Recorded by *")}</Label>
              <Input placeholder={tx("Clinician name or staff id")} {...resForm.register("recorded_by")} />
              <FieldError message={resForm.formState.errors.recorded_by?.message} />
            </div>
            {resForm.formState.errors.root && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
                {tx(resForm.formState.errors.root.message)}
              </p>
            )}
          </form>
        )}
      </Dialog>
      <Dialog
        open={!!assignFor}
        onClose={() => setAssignFor(null)}
        title={t("screenings.assignTitle")}
        description={assignFor ? `Screening #${assignFor.id} — ${assignFor.patient_name || `Patient #${assignFor.patient_id}`}. ${t("screenings.assignDesc")}` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAssignFor(null)}>{t("common.cancel")}</Button>
            <Button onClick={onAssign} disabled={assigning || !assignClinicianId.trim()}>
              {assigning && <Loader2 size={15} className="animate-spin" />}
              {t("screenings.assign")}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <Label>{t("screenings.clinicianId")} *</Label>
            <Input
              type="number"
              value={assignClinicianId}
              onChange={(e) => setAssignClinicianId(e.target.value)}
              placeholder="e.g. 2"
              autoFocus
            />
          </div>
          {assignErr && <FieldError message={assignErr} />}
        </div>
      </Dialog>
    </div>
  );
}
