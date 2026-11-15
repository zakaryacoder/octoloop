"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle, Loader2, Plus, Search } from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { CASE_STATUS_ORDER, PRIORITIES, humanize } from "@/lib/constants";
import type { FollowUpCase, Paginated, Priority } from "@/lib/types";
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
import { CaseStatusBadge, PriorityBadge } from "@/components/StatusBadge";
import { EmptyState, ErrorState, FieldError, PageHeader } from "@/components/states";
import { Pagination } from "@/components/Pagination";
import { tx } from "@/lib/tx";

const createSchema = z.object({
  patient_id: z.coerce.number().int().positive("Patient ID is required"),
  screening_id: z.string().optional(),
  priority: z.enum(PRIORITIES as [string, ...string[]]) as z.ZodType<Priority>,
  responsible_id: z.string().optional(),
  due_date: z.string().min(1, "Due date is required"),
  next_action: z.string().optional(),
});
type CreateValues = z.infer<typeof createSchema>;

export default function CasesPage() {
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const params: Record<string, unknown> = { page, page_size: 15 };
  if (status) params.status = status;
  if (priority) params.priority = priority;
  if (overdueOnly) params.overdue_only = "true";
  if (search) params.search = search;

  const { data, loading, error, refetch } = useAsync<Paginated<FollowUpCase>>(
    () => api.get<Paginated<FollowUpCase>>("/cases", params),
    [status, priority, overdueOnly, search, page]
  );

  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { priority: "MEDIUM" },
  });

  const onCreate = async (v: CreateValues) => {
    try {
      const body: Record<string, unknown> = {
        patient_id: v.patient_id,
        priority: v.priority,
        due_date: v.due_date,
        next_action: v.next_action || null,
      };
      if (v.screening_id) body.screening_id = Number(v.screening_id);
      if (v.responsible_id) body.responsible_id = Number(v.responsible_id);
      await api.post("/cases", body);
      setCreateOpen(false);
      form.reset();
      refetch();
    } catch (e) {
      form.setError("root", { message: e instanceof Error ? e.message : "Failed" });
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={tx("Follow-up Cases")}
        subtitle={tx("Core workflow queue. Overdue cases are highlighted in red and trigger escalations.")}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={15} /> {tx("Manual case")}
          </Button>
        }
      />

      <Card>
        <div className="flex flex-wrap items-end gap-3 border-b border-line/70 px-4 py-3">
          <div className="w-52">
            <Label>{tx("Status")}</Label>
            <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">{tx("All statuses")}</option>
              {CASE_STATUS_ORDER.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
            </Select>
          </div>
          <div className="w-36">
            <Label>{tx("Priority")}</Label>
            <Select value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }}>
              <option value="">{tx("All priorities")}</option>
              {PRIORITIES.map((p) => <option key={p} value={p}>{humanize(p)}</option>)}
            </Select>
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); setSearch(searchInput.trim()); setPage(1); }}
            className="relative w-56"
          >
            <Label>{tx("Search (patient / ref)")}</Label>
            <Search size={14} className="pointer-events-none absolute left-3 top-[34px] text-ink-muted" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={tx("Search…")}
              className="pl-8"
            />
          </form>
          <label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-line px-3 text-[13px] font-medium text-ink-body">
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(e) => { setOverdueOnly(e.target.checked); setPage(1); }}
              className="h-4 w-4 accent-red-600"
            />
            <AlertTriangle size={14} className="text-red-600" />
            {tx("Overdue only")}
          </label>
          <Button variant="ghost" size="sm" onClick={() => { setStatus(""); setPriority(""); setOverdueOnly(false); setSearch(""); setSearchInput(""); setPage(1); }}>
            {tx("Reset")}
          </Button>
        </div>

        {loading && <TableSkeleton rows={8} cols={8} />}
        {error && <ErrorState message={error} onRetry={refetch} />}

        {data && !loading && (
          <>
            {data.items.length === 0 ? (
              <EmptyState
                title={tx("No cases match")}
                description={tx("Adjust filters, or create a manual follow-up case.")}
                action={<Button size="sm" onClick={() => setCreateOpen(true)}><Plus size={14} /> {tx("Manual case")}</Button>}
              />
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>{tx("Case ref")}</TH><TH>{tx("Patient")}</TH><TH>{tx("Screening")}</TH><TH>{tx("Result")}</TH>
                    <TH>{tx("Priority")}</TH><TH>{tx("Responsible")}</TH><TH>{tx("Due date")}</TH><TH>{tx("Status")}</TH><TH />
                  </tr>
                </THead>
                <TBody>
                  {data.items.map((c) => (
                    <TR key={c.id} className={c.overdue ? "bg-red-50/40" : undefined}>
                      <TD className="font-mono text-[12px] text-ink-muted">{c.case_ref}</TD>
                      <TD className="font-medium text-ink-heading">{c.patient_name || `#${c.patient_id}`}</TD>
                      <TD className="capitalize text-[12.5px]">{(c.screening_type || "—").toLowerCase()}</TD>
                      <TD className="text-[12.5px] capitalize">{(c.result_classification || "—").toLowerCase()}</TD>
                      <TD><PriorityBadge priority={c.priority} /></TD>
                      <TD className="text-[12.5px]">{c.responsible_name || "Unassigned"}</TD>
                      <TD className={c.overdue ? "font-semibold text-red-600 tabular" : "tabular"}>
                        {formatDate(c.due_date)}
                        {c.overdue && <span className="ml-1 text-[10px] uppercase">{tx("overdue")}</span>}
                      </TD>
                      <TD><CaseStatusBadge status={c.status} overdue={c.overdue} /></TD>
                      <TD className="text-right">
                        <Link href={`/cases/${c.id}`} className="text-xs font-medium text-teal-dark hover:underline">
                          {tx("Open →")}
                        </Link>
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
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={tx("Open manual follow-up case")}
        description={tx("Use when a case must be tracked outside of an actionable screening result.")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>{tx("Cancel")}</Button>
            <Button onClick={form.handleSubmit(onCreate)} disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 size={15} className="animate-spin" />}
              {tx("Create case")}
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
            <Label>{tx("Screening ID (optional)")}</Label>
            <Input type="number" {...form.register("screening_id")} />
          </div>
          <div>
            <Label>{tx("Priority *")}</Label>
            <Select {...form.register("priority")}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{humanize(p)}</option>)}
            </Select>
          </div>
          <div>
            <Label>{tx("Responsible user ID")}</Label>
            <Input type="number" {...form.register("responsible_id")} />
          </div>
          <div>
            <Label>{tx("Due date *")}</Label>
            <Input type="date" {...form.register("due_date")} />
            <FieldError message={form.formState.errors.due_date?.message} />
          </div>
          <div className="sm:col-span-2">
            <Label>{tx("Next action")}</Label>
            <Textarea {...form.register("next_action")} />
          </div>
          {form.formState.errors.root && (
            <p className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
              {tx(form.formState.errors.root.message)}
            </p>
          )}
        </form>
      </Dialog>
    </div>
  );
}
