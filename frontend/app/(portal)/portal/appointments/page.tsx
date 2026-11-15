"use client";
import { CalendarDays } from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { useI18n } from "@/lib/i18n";
import type { PortalAppointment } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, PageHeader } from "@/components/states";
import { AppointmentStatusBadge } from "@/components/StatusBadge";
import { tx } from "@/lib/tx";

export default function PortalAppointmentsPage() {
  const { t } = useI18n();
  const { data, loading, error, refetch } = useAsync<PortalAppointment[] | { items: PortalAppointment[] }>(
    () => api.get("/portal/appointments"),
    []
  );
  const list = Array.isArray(data) ? data : data?.items ?? [];
  return (
    <div>
      <PageHeader title={t("portal.appointments")} subtitle={t("portal.title")} />
      <Card>
        {loading && <TableSkeleton rows={6} cols={5} />}
        {error && <ErrorState message={error} onRetry={refetch} />}
        {data && !loading && (
          list.length === 0 ? (
            <EmptyState icon="inbox" title={t("portal.noRecords")} description={t("portal.appointments")} />
          ) : (
            <Table>
              <THead>
                <tr><TH>{t("portal.scheduledAt")}</TH><TH>{t("portal.department")}</TH><TH>{t("portal.clinician")}</TH><TH>{t("common.status")}</TH><TH>{tx("Notes")}</TH></tr>
              </THead>
              <TBody>
                {list.map((a) => (
                  <TR key={a.id}>
                    <TD className="tabular text-[12.5px]"><CalendarDays size={13} className="mr-1 inline text-ink-muted" />{formatDateTime(a.scheduled_at)}</TD>
                    <TD>{a.department || "—"}</TD>
                    <TD>{a.clinician || "—"}</TD>
                    <TD><AppointmentStatusBadge status={a.status} /></TD>
                    <TD className="max-w-xs truncate text-[12.5px] text-ink-muted">{a.notes || "—"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )
        )}
      </Card>
    </div>
  );
}
