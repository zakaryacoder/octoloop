"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus, Save, ShieldCheck, UserPlus } from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { NOTIFICATION_CHANNELS, ROLES, humanize } from "@/lib/constants";
import type {
  AuditLog,
  EscalationRule,
  Paginated,
  Role,
  RoleDef,
  SettingsMap,
  User,
} from "@/lib/types";
import { formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, ErrorState, FieldError, PageHeader } from "@/components/states";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useI18n } from "@/lib/i18n";
import { Pagination } from "@/components/Pagination";
import { TabPanel, Tabs } from "@/components/ui/tabs";
import { tx } from "@/lib/tx";

const userSchema = z.object({
  username: z.string().min(3, "At least 3 chars"),
  full_name: z.string().min(1, "Full name is required"),
  email: z.string().email("Invalid email").or(z.literal("")).optional(),
  role: z.enum(ROLES as [string, ...string[]]),
  password: z.string().min(6, "At least 6 chars").or(z.literal("")).optional(),
});
type UserValues = z.infer<typeof userSchema>;

const ruleSchema = z.object({
  name: z.string().min(1, "Name is required"),
  trigger_overdue_days: z.coerce.number().int().min(1, "Must be ≥ 1"),
  escalate_to_role: z.enum(ROLES as [string, ...string[]]),
  notify_channel: z.enum(NOTIFICATION_CHANNELS as [string, ...string[]]),
  enabled: z.boolean().default(true),
});
type RuleValues = z.infer<typeof ruleSchema>;

export default function AdminPage() {
  const [tab, setTab] = useState("users");

  const tabs = [
    { id: "users", label: "Users" },
    { id: "roles", label: "Roles & permissions" },
    { id: "audit", label: tx("Audit logs") },
    { id: "escalation", label: tx("Escalation rules") },
    { id: "settings", label: "Settings" },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={tx("Administration")}
        subtitle={tx("Admin-only area: user management, roles, audit trail, escalation rules and system settings.")}
      />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      <div className="mt-4">
        <TabPanel active={tab} id="users"><UsersTab /></TabPanel>
        <TabPanel active={tab} id="roles"><RolesTab /></TabPanel>
        <TabPanel active={tab} id="audit"><AuditTab /></TabPanel>
        <TabPanel active={tab} id="escalation"><EscalationTab /></TabPanel>
        <TabPanel active={tab} id="settings"><SettingsTab /></TabPanel>
      </div>
    </div>
  );
}

/* ---------------- Users ---------------- */
function UsersTab() {
  const [page, setPage] = useState(1);
  const { data, loading, error, refetch } = useAsync<Paginated<User>>(
    () => api.get<Paginated<User>>("/users", { page, page_size: 15 }),
    [page]
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const { t } = useI18n();
  const [confirmUser, setConfirmUser] = useState<User | null>(null);
  const form = useForm<UserValues>({ resolver: zodResolver(userSchema), defaultValues: { role: "viewer" } });

  const openCreate = () => {
    setEditing(null);
    form.reset({ username: "", full_name: "", email: "", role: "viewer", password: "" });
    setCreateOpen(true);
  };
  const openEdit = (u: User) => {
    setEditing(u);
    form.reset({ username: u.username, full_name: u.full_name, email: u.email || "", role: u.role, password: "" });
    setCreateOpen(true);
  };

  const onSubmit = async (v: UserValues) => {
    try {
      const body: Record<string, unknown> = {
        username: v.username,
        full_name: v.full_name,
        email: v.email || null,
        role: v.role,
      };
      if (v.password) body.password = v.password;
      if (editing) {
        await api.put(`/users/${editing.id}`, body);
      } else {
        await api.post("/users", body);
      }
      setCreateOpen(false);
      refetch();
    } catch (e) {
      form.setError("root", { message: e instanceof Error ? e.message : "Failed" });
    }
  };

  const doToggleActive = async (u: User) => {
    try {
      await api.put(`/users/${u.id}`, { is_active: !u.is_active });
      refetch();
    } catch {
      refetch();
    }
  };
  const toggleActive = (u: User) => {
    if (u.is_active !== false) {
      setConfirmUser(u); // deactivate requires confirmation
    } else {
      void doToggleActive(u);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tx("User accounts")}</CardTitle>
        <Button size="sm" onClick={openCreate}><UserPlus size={14} /> {tx("New user")}</Button>
      </CardHeader>
      {loading && <TableSkeleton rows={6} cols={6} />}
      {error && <ErrorState message={error} onRetry={refetch} />}
      {data && !loading && (
        <>
          {data.items.length === 0 ? (
            <EmptyState title={tx("No users")} description={tx("Create the first staff account.")} />
          ) : (
            <Table>
              <THead><tr><TH>{tx("ID")}</TH><TH>{tx("Username")}</TH><TH>{tx("Full name")}</TH><TH>{tx("Role")}</TH><TH>{tx("Email")}</TH><TH>{tx("Active")}</TH><TH>{tx("Last login")}</TH><TH className="text-right">{tx("Actions")}</TH></tr></THead>
              <TBody>
                {data.items.map((u) => (
                  <TR key={u.id}>
                    <TD className="font-mono text-[12px] text-ink-muted">#{u.id}</TD>
                    <TD className="font-medium">@{u.username}</TD>
                    <TD>{u.full_name}</TD>
                    <TD><span className="rounded-full bg-navy/10 px-2 py-0.5 text-[11.5px] font-medium capitalize text-navy">{u.role}</span></TD>
                    <TD className="text-[12.5px] text-ink-muted">{u.email || "—"}</TD>
                    <TD>
                      <span className={`inline-flex items-center gap-1.5 text-[12px] ${u.is_active !== false ? "text-teal-dark" : "text-ink-muted"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${u.is_active !== false ? "bg-teal" : "bg-slate-300"}`} />
                        {u.is_active !== false ? tx("Active") : tx("Inactive")}
                      </span>
                    </TD>
                    <TD className="text-[12px] text-ink-muted tabular">{formatDateTime(u.last_login_at)}</TD>
                    <TD className="text-right">
                      <div className="inline-flex gap-1.5">
                        <Button size="sm" variant="secondary" onClick={() => openEdit(u)}>{tx("Edit")}</Button>
                        <Button size="sm" variant="ghost" onClick={() => toggleActive(u)}>
                          {u.is_active !== false ? tx("Deactivate") : tx("Activate")}
                        </Button>
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

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={editing ? `Edit user @${editing.username}` : tx("Create user")}
        description={editing ? tx("Leave password blank to keep current.") : tx("Password required on creation.")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>{tx("Cancel")}</Button>
            <Button onClick={form.handleSubmit(onSubmit)} disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 size={15} className="animate-spin" />}
              {editing ? tx("Save changes") : tx("Create user")}
            </Button>
          </>
        }
      >
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><Label>{tx("Username *")}</Label><Input {...form.register("username")} disabled={!!editing} /><FieldError message={form.formState.errors.username?.message} /></div>
          <div><Label>{tx("Full name *")}</Label><Input {...form.register("full_name")} /><FieldError message={form.formState.errors.full_name?.message} /></div>
          <div><Label>{tx("Email")}</Label><Input type="email" {...form.register("email")} /><FieldError message={form.formState.errors.email?.message} /></div>
          <div><Label>{tx("Role *")}</Label>
            <Select {...form.register("role")}>{ROLES.map((r) => <option key={r} value={r}>{humanize(r)}</option>)}</Select>
          </div>
          <div className="sm:col-span-2"><Label>{tx("Password")} {editing ? tx("(optional)") : "*"}</Label><Input type="password" {...form.register("password")} /><FieldError message={form.formState.errors.password?.message} /></div>
          {form.formState.errors.root && (
            <p className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{tx(form.formState.errors.root.message)}</p>
          )}
        </form>
      </Dialog>
      <ConfirmDialog
        open={!!confirmUser}
        onClose={() => setConfirmUser(null)}
        onConfirm={() => { if (confirmUser) void doToggleActive(confirmUser); setConfirmUser(null); }}
        title={t("admin.deactivateConfirmTitle")}
        description={`${confirmUser?.full_name || confirmUser?.username || "User"} (@${confirmUser?.username}). ${t("admin.deactivateConfirmDesc")}`}
        confirmLabel="Deactivate"
        danger
      />
    </Card>
  );
}

/* ---------------- Roles ---------------- */
function RolesTab() {
  const { data, loading, error, refetch } = useAsync<RoleDef[]>(() => api.get<RoleDef[]>("/roles"), []);
  if (loading) return <Card><TableSkeleton rows={5} cols={2} /></Card>;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data || data.length === 0) return <Card><EmptyState title={tx("No roles defined")} /></Card>;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {data.map((r) => (
        <Card key={r.name}>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2 capitalize"><ShieldCheck size={16} className="text-teal" />{r.name}</CardTitle>
            <span className="text-[11px] text-ink-muted tabular">{r.permissions?.length ?? 0} {tx("permissions")}</span>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {(r.permissions || []).map((p) => (
                <span key={p} className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] text-ink-body">{p}</span>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ---------------- Audit ---------------- */
function AuditTab() {
  const [page, setPage] = useState(1);
  const { data, loading, error, refetch } = useAsync<Paginated<AuditLog>>(
    () => api.get<Paginated<AuditLog>>("/audit-logs", { page, page_size: 15 }),
    [page]
  );
  return (
    <Card>
      <CardHeader><CardTitle>{tx("Audit log")}</CardTitle><span className="text-[11px] text-ink-muted">{tx("Immutable trail of administrative & auth events")}</span></CardHeader>
      {loading && <TableSkeleton rows={8} cols={6} />}
      {error && <ErrorState message={error} onRetry={refetch} />}
      {data && !loading && (
        <>
          {data.items.length === 0 ? <EmptyState title={tx("No audit entries")} /> : (
            <Table>
              <THead><tr><TH>{tx("Time")}</TH><TH>{tx("User")}</TH><TH>{tx("Action")}</TH><TH>{tx("Entity")}</TH><TH>{tx("IP")}</TH><TH>{tx("Details")}</TH></tr></THead>
              <TBody>
                {data.items.map((l) => (
                  <TR key={l.id}>
                    <TD className="tabular text-[12px] text-ink-muted">{formatDateTime(l.timestamp)}</TD>
                    <TD className="text-[12.5px]">{l.username || `#${l.user_id}`}</TD>
                    <TD className="font-medium text-ink-heading">{l.action}</TD>
                    <TD className="font-mono text-[11.5px] text-ink-muted">{l.entity_type}{l.entity_id ? ` #${l.entity_id}` : ""}</TD>
                    <TD className="font-mono text-[11.5px] text-ink-muted">{l.ip_address || "—"}</TD>
                    <TD className="max-w-xs truncate text-[12px] text-ink-muted">{l.details || "—"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
          <Pagination page={data.page} pageSize={data.page_size} total={data.total} onPage={setPage} />
        </>
      )}
    </Card>
  );
}

/* ---------------- Escalation rules ---------------- */
function EscalationTab() {
  const { data, loading, error, refetch } = useAsync<EscalationRule[]>(() => api.get<EscalationRule[]>("/escalation-rules"), []);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EscalationRule | null>(null);
  const form = useForm<RuleValues>({ resolver: zodResolver(ruleSchema), defaultValues: { trigger_overdue_days: 3, escalate_to_role: "coordinator", notify_channel: "EMAIL", enabled: true } });

  const openCreate = () => { setEditing(null); form.reset({ name: "", trigger_overdue_days: 3, escalate_to_role: "coordinator", notify_channel: "EMAIL", enabled: true }); setOpen(true); };
  const openEdit = (r: EscalationRule) => {
    setEditing(r);
    form.reset({ name: r.name, trigger_overdue_days: r.trigger_overdue_days, escalate_to_role: r.escalate_to_role, notify_channel: r.notify_channel, enabled: r.enabled });
    setOpen(true);
  };

  const onSubmit = async (v: RuleValues) => {
    try {
      if (editing) {
        await api.put(`/escalation-rules/${editing.id}`, v);
      } else {
        await api.post("/escalation-rules", v);
      }
      setOpen(false);
      refetch();
    } catch (e) {
      form.setError("root", { message: e instanceof Error ? e.message : "Failed" });
    }
  };

  const toggle = async (r: EscalationRule) => {
    try {
      await api.put(`/escalation-rules/${r.id}`, { ...r, enabled: !r.enabled });
      refetch();
    } catch { refetch(); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tx("Escalation rules")}</CardTitle>
        <Button size="sm" onClick={openCreate}><Plus size={14} /> {tx("New rule")}</Button>
      </CardHeader>
      {loading && <TableSkeleton rows={5} cols={6} />}
      {error && <ErrorState message={error} onRetry={refetch} />}
      {data && !loading && (
        data.length === 0 ? <EmptyState title={tx("No escalation rules")} description={tx("Rules auto-notify staff when a case is overdue.")} /> : (
          <Table>
            <THead><tr><TH>{tx("Name")}</TH><TH>{tx("Trigger (days overdue)")}</TH><TH>{tx("Escalate to role")}</TH><TH>{tx("Channel")}</TH><TH>{tx("Enabled")}</TH><TH className="text-right">{tx("Actions")}</TH></tr></THead>
            <TBody>
              {data.map((r) => (
                <TR key={r.id}>
                  <TD className="font-medium">{r.name}</TD>
                  <TD className="tabular">≥ {r.trigger_overdue_days}d</TD>
                  <TD className="capitalize">{humanize(r.escalate_to_role)}</TD>
                  <TD className="capitalize">{humanize(r.notify_channel)}</TD>
                  <TD>
                    <button onClick={() => toggle(r)} className={`relative h-5 w-9 rounded-full transition-colors ${r.enabled ? "bg-teal" : "bg-slate-300"}`}>
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${r.enabled ? "left-[18px]" : "left-0.5"}`} />
                    </button>
                  </TD>
                  <TD className="text-right"><Button size="sm" variant="secondary" onClick={() => openEdit(r)}>{tx("Edit")}</Button></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? tx("Edit escalation rule") : tx("New escalation rule")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>{tx("Cancel")}</Button>
            <Button onClick={form.handleSubmit(onSubmit)} disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 size={15} className="animate-spin" />}
              {editing ? tx("Save") : tx("Create rule")}
            </Button>
          </>
        }
      >
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label>{tx("Name *")}</Label><Input {...form.register("name")} /><FieldError message={form.formState.errors.name?.message} /></div>
          <div><Label>{tx("Trigger after days overdue *")}</Label><Input type="number" {...form.register("trigger_overdue_days")} /><FieldError message={form.formState.errors.trigger_overdue_days?.message} /></div>
          <div><Label>{tx("Notify channel *")}</Label>
            <Select {...form.register("notify_channel")}>{NOTIFICATION_CHANNELS.map((c) => <option key={c} value={c}>{humanize(c)}</option>)}</Select>
          </div>
          <div><Label>{tx("Escalate to role *")}</Label>
            <Select {...form.register("escalate_to_role")}>{ROLES.map((r) => <option key={r} value={r}>{humanize(r)}</option>)}</Select>
          </div>
          <label className="flex h-9 items-center gap-2 self-end text-[13px] text-ink-body">
            <input type="checkbox" {...form.register("enabled")} className="h-4 w-4 accent-teal" /> {tx("Enabled")}
          </label>
          {form.formState.errors.root && (
            <p className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{tx(form.formState.errors.root.message)}</p>
          )}
        </form>
      </Dialog>
    </Card>
  );
}

/* ---------------- Settings ---------------- */
function SettingsTab() {
  const { data, loading, error, refetch } = useAsync<SettingsMap>(() => api.get<SettingsMap>("/settings"), []);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const merged = { ...(data || {}), ...draft };
  const keys = Object.keys(merged);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await api.put("/settings", merged);
      setMsg(tx("Settings saved."));
      setDraft({});
      refetch();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : tx("Save failed"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Card><TableSkeleton rows={4} cols={2} /></Card>;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tx("System settings")}</CardTitle>
        <Button size="sm" onClick={save} disabled={saving || keys.length === 0}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {tx("Save settings")}
        </Button>
      </CardHeader>
      <CardContent>
        {keys.length === 0 ? (
          <EmptyState title={tx("No settings keys returned")} description={tx("The /settings endpoint returned an empty object.")} />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {keys.map((k) => (
              <div key={k}>
                <Label className="font-mono text-[12px]">{k}</Label>
                {String(merged[k] ?? "").length > 60 ? (
                  <Textarea value={merged[k] ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))} />
                ) : (
                  <Input value={merged[k] ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))} />
                )}
              </div>
            ))}
          </div>
        )}
        {msg && <p className="mt-3 text-sm text-teal-dark">{msg}</p>}
      </CardContent>
    </Card>
  );
}
