"use client";
import { api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { useI18n } from "@/lib/i18n";
import { humanize } from "@/lib/constants";
import type { PortalFollowUp } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, PageHeader } from "@/components/states";
import { CaseStatusBadge } from "@/components/StatusBadge";

export default function PortalFollowUpsPage() {
  const { t } = useI18n();
  const { data, loading, error, refetch } = useAsync<PortalFollowUp[] | { items: PortalFollowUp[] }>(
    () => api.get("/portal/follow-ups"),
    []
  );
  const list = Array.isArray(data) ? data : data?.items ?? [];
  return (
    <div>
      <PageHeader title={t("portal.followUps")} subtitle={t("portal.title")} />
      <Card>
        {loading && <TableSkeleton rows={6} cols={5} />}
        {error && <ErrorState message={error} onRetry={refetch} />}
        {data && !loading && (
          list.length === 0 ? (
            <EmptyState icon="inbox" title={t("portal.noRecords")} description={t("portal.followUps")} />
          ) : (
            <Table>
              <THead>
                <tr><TH>{t("portal.caseRef")}</TH><TH>{t("portal.screeningType")}</TH><TH>{t("common.status")}</TH><TH>{t("portal.nextAction")}</TH><TH>{t("cases.dueDate")}</TH></tr>
              </THead>
              <TBody>
                {list.map((f) => (
                  <TR key={f.id}>
                    <TD className="font-mono text-[12.5px]">{f.case_ref}</TD>
                    <TD className="capitalize text-[12.5px]">{f.screening_type ? humanize(f.screening_type) : "—"}</TD>
                    <TD><CaseStatusBadge status={f.status} overdue={f.overdue} /></TD>
                    <TD className="max-w-xs truncate text-[12.5px] text-ink-muted">{f.next_action || "—"}</TD>
                    <TD className="tabular text-[12.5px]">{formatDate(f.due_date)}</TD>
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
