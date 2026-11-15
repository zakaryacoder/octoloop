"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BellRing, CheckCheck, Loader2, Send, Settings2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { useI18n } from "@/lib/i18n";
import {
  NOTIFICATION_AUDIENCES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_STATUSES,
  humanize,
} from "@/lib/constants";
import type { NotificationAudience, NotificationItem, NotificationPreferences, Paginated } from "@/lib/types";
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
import { NotificationStatusBadge } from "@/components/StatusBadge";
import { EmptyState, ErrorState, FieldError, PageHeader } from "@/components/states";
import { Pagination } from "@/components/Pagination";
import { TabPanel, Tabs } from "@/components/ui/tabs";
import { tx } from "@/lib/tx";

const sendSchema = z.object({
  audience: z.enum(["PATIENT", "STAFF"]),
  patient_id: z.string().optional(),
  staff_user_id: z.string().optional(),
  case_id: z.string().optional(),
  channel: z.enum(NOTIFICATION_CHANNELS as [string, ...string[]]),
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(1, "Message is required"),
});
type SendValues = z.infer<typeof sendSchema>;

export default function NotificationsPage() {
  const { t } = useI18n();
  const [audience, setAudience] = useState<NotificationAudience>("PATIENT");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [sendOpen, setSendOpen] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsMsg, setPrefsMsg] = useState<string | null>(null);

  const params: Record<string, unknown> = { audience, page, page_size: 15 };
  if (status) params.status = status;

  const { data, loading, error, refetch } = useAsync<Paginated<NotificationItem>>(
    () => api.get<Paginated<NotificationItem>>("/notifications", params),
    [audience, status, page]
  );

  const form = useForm<SendValues>({
    resolver: zodResolver(sendSchema),
    defaultValues: { audience: "PATIENT", channel: "SMS" },
  });
  const watchedAudience = form.watch("audience");

  const onSend = async (v: SendValues) => {
    try {
      const body: Record<string, unknown> = {
        audience: v.audience,
        channel: v.channel,
        subject: v.subject,
        message: v.message,
      };
      if (v.patient_id) body.patient_id = Number(v.patient_id);
      if (v.staff_user_id) body.staff_user_id = Number(v.staff_user_id);
      if (v.case_id) body.case_id = Number(v.case_id);
      await api.post("/notifications/send", body);
      setSendOpen(false);
      form.reset();
      refetch();
    } catch (e) {
      form.setError("root", { message: e instanceof Error ? e.message : "Failed" });
    }
  };

  const acknowledge = async (n: NotificationItem) => {
    setBusyId(n.id);
    try {
      await api.post(`/notifications/${n.id}/acknowledge`, {});
      refetch();
    } finally {
      setBusyId(null);
    }
  };

  const openPrefs = async () => {
    setPrefsOpen(true);
    setPrefsLoading(true);
    setPrefsMsg(null);
    try {
      const res = await api.get<NotificationPreferences>("/notifications/preferences");
      const enabled: Record<string, boolean> = {};
      NOTIFICATION_CHANNELS.forEach((c) => {
        enabled[c] = res.channel_enabled?.[c] !== false;
      });
      setPrefs(enabled);
    } catch {
      // Backend may not have prefs yet — default all on.
      const enabled: Record<string, boolean> = {};
      NOTIFICATION_CHANNELS.forEach((c) => { enabled[c] = true; });
      setPrefs(enabled);
    } finally {
      setPrefsLoading(false);
    }
  };

  const savePrefs = async () => {
    setPrefsSaving(true);
    setPrefsMsg(null);
    try {
      await api.put("/notifications/preferences", { channel_enabled: prefs });
      setPrefsMsg(t("notif.saved"));
    } catch (e) {
      setPrefsMsg(e instanceof Error ? e.message : tx("Save failed"));
    } finally {
      setPrefsSaving(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={tx("Notifications")}
        subtitle={tx("Patient engagement and staff alerts. Sending a notification on a case writes an event and updates last contact.")}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={openPrefs}>
              <Settings2 size={15} /> {t("notif.preferences")}
            </Button>
            <Button onClick={() => setSendOpen(true)}><Send size={15} /> {tx("Send notification")}</Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          tabs={NOTIFICATION_AUDIENCES.map((a) => ({ id: a, label: `${humanize(a)} notifications` }))}
          active={audience}
          onChange={(id) => { setAudience(id as NotificationAudience); setPage(1); }}
        />
        <div className="w-48">
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">{tx("All delivery statuses")}</option>
            {NOTIFICATION_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
          </Select>
        </div>
      </div>

      <TabPanel active={audience} id="PATIENT">
        <Card>
          {loading && <TableSkeleton rows={8} cols={6} />}
          {error && <ErrorState message={error} onRetry={refetch} />}
          {data && !loading && <NotificationTable data={data} busyId={busyId} onAck={acknowledge} audience="PATIENT" onPage={setPage} />}
        </Card>
      </TabPanel>
      <TabPanel active={audience} id="STAFF">
        <Card>
          {loading && <TableSkeleton rows={8} cols={6} />}
          {error && <ErrorState message={error} onRetry={refetch} />}
          {data && !loading && <NotificationTable data={data} busyId={busyId} onAck={acknowledge} audience="STAFF" onPage={setPage} />}
        </Card>
      </TabPanel>

      <Dialog
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        title={tx("Send notification")}
        description={tx("Queued for delivery; the status updates once a provider confirms. If linked to a case, a notification event is written.")}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSendOpen(false)}>{tx("Cancel")}</Button>
            <Button onClick={form.handleSubmit(onSend)} disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 size={15} className="animate-spin" />}
              <Send size={15} /> {tx("Send")}
            </Button>
          </>
        }
      >
        <form onSubmit={form.handleSubmit(onSend)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>{tx("Audience *")}</Label>
            <Select {...form.register("audience")}>
              {NOTIFICATION_AUDIENCES.map((a) => <option key={a} value={a}>{humanize(a)}</option>)}
            </Select>
          </div>
          <div>
            <Label>{tx("Channel *")}</Label>
            <Select {...form.register("channel")}>
              {NOTIFICATION_CHANNELS.map((c) => <option key={c} value={c}>{humanize(c)}</option>)}
            </Select>
          </div>
          {watchedAudience === "PATIENT" ? (
            <div>
              <Label>{tx("Patient ID")}</Label>
              <Input type="number" {...form.register("patient_id")} />
            </div>
          ) : (
            <div>
              <Label>{tx("Staff user ID")}</Label>
              <Input type="number" {...form.register("staff_user_id")} />
            </div>
          )}
          <div>
            <Label>{tx("Linked case ID (optional)")}</Label>
            <Input type="number" {...form.register("case_id")} />
          </div>
          <div className="sm:col-span-2">
            <Label>{tx("Subject *")}</Label>
            <Input {...form.register("subject")} />
            <FieldError message={form.formState.errors.subject?.message} />
          </div>
          <div className="sm:col-span-2">
            <Label>{tx("Message *")}</Label>
            <Textarea {...form.register("message")} />
            <FieldError message={form.formState.errors.message?.message} />
          </div>
          {form.formState.errors.root && (
            <p className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{tx(form.formState.errors.root.message)}</p>
          )}
        </form>
      </Dialog>
      <Dialog
        open={prefsOpen}
        onClose={() => setPrefsOpen(false)}
        title={t("notif.preferences")}
        description={t("notif.preferencesDesc")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPrefsOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={savePrefs} disabled={prefsSaving || prefsLoading}>
              {prefsSaving ? <Loader2 size={15} className="animate-spin" /> : <Settings2 size={15} />}
              {t("notif.save")}
            </Button>
          </>
        }
      >
        {prefsLoading ? (
          <div className="py-6 text-center text-sm text-ink-muted"><Loader2 size={18} className="mx-auto mb-2 animate-spin text-teal" />{t("common.loading")}</div>
        ) : (
          <div className="space-y-2.5">
            {NOTIFICATION_CHANNELS.map((c) => (
              <label key={c} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5 text-[13.5px] hover:bg-slate-50 transition-colors">
                <span className="capitalize font-medium text-ink-body">{humanize(c)}</span>
                <input
                  type="checkbox"
                  checked={!!prefs[c]}
                  onChange={(e) => setPrefs((p) => ({ ...p, [c]: e.target.checked }))}
                  className="h-4 w-4 accent-teal"
                />
              </label>
            ))}
            {prefsMsg && (
              <p className={`rounded-lg px-3 py-2 text-[13px] ${prefsMsg === t("notif.saved") ? "bg-teal-light text-teal-dark" : "bg-red-50 text-red-700"}`}>
                {prefsMsg}
              </p>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}

function NotificationTable({
  data,
  busyId,
  onAck,
  audience,
  onPage,
}: {
  data: Paginated<NotificationItem>;
  busyId: number | null;
  onAck: (n: NotificationItem) => void;
  audience: NotificationAudience;
  onPage: (p: number) => void;
}) {
  if (data.items.length === 0) {
    return <EmptyState icon="inbox" title={`No ${humanize(audience).toLowerCase()} notifications`} description={tx("Notifications will appear once sent.")} />;
  }
  return (
    <>
      <Table>
        <THead>
          <tr>
            <TH>{tx("ID")}</TH><TH>{tx("Channel")}</TH><TH>{tx("Subject")}</TH><TH>{audience === "PATIENT" ? tx("Patient") : tx("Staff")}</TH>
            <TH>{tx("Case")}</TH><th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wide text-ink-muted">{tx("Sent")}</th>
            <TH>{tx("Status")}</TH><TH className="text-right">{tx("Action")}</TH>
          </tr>
        </THead>
        <TBody>
          {data.items.map((n) => (
            <TR key={n.id}>
              <TD className="font-mono text-[12px] text-ink-muted">#{n.id}</TD>
              <TD className="capitalize text-[12.5px]">{n.channel.toLowerCase()}</TD>
              <TD>
                <p className="font-medium text-ink-heading">{n.subject}</p>
                <p className="max-w-xs truncate text-[12px] text-ink-muted">{n.message}</p>
              </TD>
              <TD className="text-[12.5px]">{audience === "PATIENT" ? (n.patient_id ? `#${n.patient_id}` : "—") : (n.staff_user_id ? `#${n.staff_user_id}` : "—")}</TD>
              <TD className="font-mono text-[12px] text-ink-muted">{n.case_id ? `#${n.case_id}` : "—"}</TD>
              <TD className="text-[12px] text-ink-muted tabular">{formatDateTime(n.sent_at)}</TD>
              <TD><NotificationStatusBadge status={n.status} /></TD>
              <TD className="text-right">
                {n.status !== "ACKNOWLEDGED" && (
                  <Button size="sm" variant="ghost" disabled={busyId === n.id} onClick={() => onAck(n)}>
                    {busyId === n.id ? <Loader2 size={13} className="animate-spin" /> : <><CheckCheck size={13} /> {tx("Acknowledge")}</>}
                  </Button>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <Pagination page={data.page} pageSize={data.page_size} total={data.total} onPage={onPage} />
    </>
  );
}
