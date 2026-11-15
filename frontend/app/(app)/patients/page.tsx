"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus, Search, UserPlus } from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import type { Paginated, Patient } from "@/lib/types";
import { ageFromDob, formatDate, patientFullName } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, ErrorState, FieldError, PageHeader } from "@/components/states";
import { Pagination } from "@/components/Pagination";
import { tx } from "@/lib/tx";

const PAGE_SIZE = 15;

const schema = z.object({
  mrn: z.string().min(1, "MRN is required"),
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  date_of_birth: z.string().min(1, "Date of birth is required"),
  gender: z.string().min(1, "Gender is required"),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").or(z.literal("")).optional(),
  address: z.string().optional(),
  medical_history_summary: z.string().optional(),
  allergies: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function PatientsPage() {
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  // Seed search from URL (?search=) on mount (avoids useSearchParams build constraints).
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const q = sp.get("search");
    if (q) {
      setSearch(q);
      setSearchInput(q);
    }
  }, []);

  const { data, loading, error, refetch } = useAsync<Paginated<Patient>>(
    () =>
      api.get<Paginated<Patient>>("/patients", {
        search,
        page,
        page_size: PAGE_SIZE,
      }),
    [search, page]
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { gender: "FEMALE" },
  });

  const onCreate = async (v: FormValues) => {
    try {
      await api.post("/patients", {
        ...v,
        phone: v.phone || null,
        email: v.email || null,
        address: v.address || null,
        medical_history_summary: v.medical_history_summary || null,
        allergies: v.allergies || null,
      });
      setCreateOpen(false);
      reset();
      refetch();
    } catch (e) {
      setError("root", { message: e instanceof Error ? e.message : tx("Create failed") });
    }
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={tx("Patients")}
        subtitle={tx("Patient registry — search, view and register patients.")}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <UserPlus size={15} /> {tx("Register patient")}
          </Button>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line/70 px-4 py-3">
          <form onSubmit={submitSearch} className="relative w-full max-w-sm">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={tx("Search by name or MRN…")}
              className="pl-9"
            />
          </form>
          {search && (
            <button
              onClick={() => {
                setSearch("");
                setSearchInput("");
                setPage(1);
              }}
              className="text-xs text-teal-dark hover:underline"
            >
              {tx("Clear search “")}{search}”
            </button>
          )}
        </div>

        {loading && <TableSkeleton rows={8} cols={6} />}
        {error && <ErrorState message={error} onRetry={refetch} />}

        {data && !loading && (
          <>
            {data.items.length === 0 ? (
              <EmptyState
                icon="search"
                title={search ? tx("No patients match your search") : tx("No patients registered yet")}
                description={search ? tx("Try a different name or MRN.") : tx("Register the first patient to begin tracking follow-up.")}
                action={
                  <Button size="sm" onClick={() => setCreateOpen(true)}>
                    <Plus size={14} /> {tx("Register patient")}
                  </Button>
                }
              />
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>{tx("MRN")}</TH>
                    <TH>{tx("Patient")}</TH>
                    <TH>{tx("DOB / Age")}</TH>
                    <TH>{tx("Gender")}</TH>
                    <TH>{tx("Contact")}</TH>
                    <TH>{tx("Registered")}</TH>
                    <TH className="text-right">{tx("Actions")}</TH>
                  </tr>
                </THead>
                <TBody>
                  {data.items.map((p) => {
                    const age = ageFromDob(p.date_of_birth);
                    return (
                      <TR key={p.id}>
                        <TD className="font-mono text-[12.5px] text-ink-muted">{p.mrn}</TD>
                        <TD>
                          <Link href={`/patients/${p.id}`} className="font-semibold text-navy hover:underline">
                            {patientFullName(p)}
                          </Link>
                        </TD>
                        <TD className="tabular">
                          {formatDate(p.date_of_birth)}
                          {age !== null && <span className="text-ink-muted"> · {age}y</span>}
                        </TD>
                        <TD className="capitalize">{(p.gender || "").toLowerCase()}</TD>
                        <TD className="text-[12.5px]">
                          {p.phone || "—"}
                          {p.email && <div className="text-ink-muted">{p.email}</div>}
                        </TD>
                        <TD className="text-[12.5px] text-ink-muted tabular">{formatDate(p.created_at)}</TD>
                        <TD className="text-right">
                          <Link
                            href={`/patients/${p.id}`}
                            className="text-xs font-medium text-teal-dark hover:underline"
                          >
                            {tx("View profile →")}
                          </Link>
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
        title={tx("Register new patient")}
        description={tx("Fields marked * are required. MRN must be unique.")}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              {tx("Cancel")}
            </Button>
            <Button onClick={handleSubmit(onCreate)} disabled={isSubmitting}>
              {isSubmitting && <Loader2 size={15} className="animate-spin" />}
              {tx("Register patient")}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit(onCreate)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>{tx("MRN *")}</Label>
            <Input placeholder={tx("e.g. MRN-10042")} {...register("mrn")} />
            <FieldError message={errors.mrn?.message} />
          </div>
          <div>
            <Label>{tx("Gender *")}</Label>
            <Select {...register("gender")}>
              <option value="FEMALE">{tx("Female")}</option>
              <option value="MALE">{tx("Male")}</option>
              <option value="OTHER">{tx("Other")}</option>
            </Select>
            <FieldError message={errors.gender?.message} />
          </div>
          <div>
            <Label>{tx("First name *")}</Label>
            <Input {...register("first_name")} />
            <FieldError message={errors.first_name?.message} />
          </div>
          <div>
            <Label>{tx("Last name *")}</Label>
            <Input {...register("last_name")} />
            <FieldError message={errors.last_name?.message} />
          </div>
          <div>
            <Label>{tx("Date of birth *")}</Label>
            <Input type="date" {...register("date_of_birth")} />
            <FieldError message={errors.date_of_birth?.message} />
          </div>
          <div>
            <Label>{tx("Phone")}</Label>
            <Input {...register("phone")} />
            <FieldError message={errors.phone?.message} />
          </div>
          <div className="sm:col-span-2">
            <Label>{tx("Email")}</Label>
            <Input type="email" {...register("email")} />
            <FieldError message={errors.email?.message} />
          </div>
          <div className="sm:col-span-2">
            <Label>{tx("Address")}</Label>
            <Input {...register("address")} />
          </div>
          <div className="sm:col-span-2">
            <Label>{tx("Medical history summary")}</Label>
            <Textarea {...register("medical_history_summary")} />
          </div>
          <div className="sm:col-span-2">
            <Label>{tx("Allergies")}</Label>
            <Input placeholder={tx("e.g. Penicillin, NKDA")} {...register("allergies")} />
          </div>
          {errors.root && (
            <p className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
              {errors.root.message}
            </p>
          )}
        </form>
      </Dialog>
    </div>
  );
}
