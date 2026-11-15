"use client";
import { Bell } from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { useI18n } from "@/lib/i18n";
import { humanize } from "@/lib/constants";
import type { PortalNotification } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, PageHeader } from "@/components/states";

export default function PortalNotificationsPage() {
  const { t } = useI18n();
  const { data, loading, error, refetch } = useAsync<PortalNotification[] | { items: PortalNotification[] }>(
    () => api.get("/portal/notifications"),
    []
  );
  const list = Array.isArray(data) ? data : data?.items ?? [];
  return (
    <div>
      <PageHeader title={t("portal.notifications")} subtitle={t("portal.title")} />
      {loading && <Card><TableSkeleton rows={6} cols={1} /></Card>}
      {error && <Card><ErrorState message={error} onRetry={refetch} /></Card>}
      {data && !loading && (
        list.length === 0 ? (
          <Card><EmptyState icon="inbox" title={t("portal.noRecords")} description={t("portal.notifications")} /></Card>
        ) : (
          <ul className="space-y-3">
            {list.map((n) => (
              <li key={n.id} className="rounded-xl border border-line bg-white p-4 shadow-card">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-light text-teal-dark">
                    <Bell size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[14px] font-semibold text-ink-heading">{n.subject}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wide text-ink-muted">
                        {humanize(n.channel)}
                      </span>
                    </div>
                    <p className="mt-1 text-[13px] text-ink-body">{n.message}</p>
                    <p className="mt-1.5 text-[11.5px] text-ink-muted tabular">{formatDateTime(n.sent_at)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
