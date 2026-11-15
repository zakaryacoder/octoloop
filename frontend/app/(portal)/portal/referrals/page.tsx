"use client";
import { api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { useI18n } from "@/lib/i18n";
import type { PortalReferral } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, PageHeader } from "@/components/states";
import { ReferralStatusBadge } from "@/components/StatusBadge";

export default function PortalReferralsPage() {
  const { t } = useI18n();
  const { data, loading, error, refetch } = useAsync<PortalReferral[] | { items: PortalReferral[] }>(
    () => api.get("/portal/referrals"),
    []
  );
  const list = Array.isArray(data) ? data : data?.items ?? [];
  return (
    <div>
      <PageHeader title={t("portal.referrals")} subtitle={t("portal.title")} />
      <Card>
        {loading && <TableSkeleton rows={6} cols={4} />}
        {error && <ErrorState message={error} onRetry={refetch} />}
        {data && !loading && (
          list.length === 0 ? (
            <EmptyState icon="inbox" title={t("portal.noRecords")} description={t("portal.referrals")} />
          ) : (
            <Table>
              <THead>
                <tr><TH>{t("portal.toDepartment")}</TH><TH>{t("portal.reason")}</TH><TH>{t("common.status")}</TH><TH>{t("portal.sentAt")}</TH></tr>
              </THead>
              <TBody>
                {list.map((r) => (
                  <TR key={r.id}>
                    <TD className="font-medium">{r.to_department}</TD>
                    <TD className="max-w-xs truncate text-[12.5px] text-ink-muted">{r.reason || "—"}</TD>
                    <TD><ReferralStatusBadge status={r.status} /></TD>
                    <TD className="tabular text-[12.5px]">{formatDate(r.sent_at)}</TD>
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
