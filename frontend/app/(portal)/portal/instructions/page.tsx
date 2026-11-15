"use client";
import { FileText } from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { useI18n } from "@/lib/i18n";
import type { PortalInstruction } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, PageHeader } from "@/components/states";

export default function PortalInstructionsPage() {
  const { t } = useI18n();
  const { data, loading, error, refetch } = useAsync<PortalInstruction[] | { items: PortalInstruction[] }>(
    () => api.get("/portal/instructions"),
    []
  );
  const list = Array.isArray(data) ? data : data?.items ?? [];
  return (
    <div>
      <PageHeader title={t("portal.instructions")} subtitle={t("portal.instructionsDesc")} />
      {loading && <Card><TableSkeleton rows={4} cols={1} /></Card>}
      {error && <Card><ErrorState message={error} onRetry={refetch} /></Card>}
      {data && !loading && (
        list.length === 0 ? (
          <Card><EmptyState icon="inbox" title={t("portal.noRecords")} description={t("portal.instructions")} /></Card>
        ) : (
          <div className="space-y-3">
            {list.map((ins) => (
              <Card key={ins.id}>
                <CardContent className="flex items-start gap-3 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-light text-teal-dark">
                    <FileText size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    {ins.title && <p className="text-[14px] font-semibold text-ink-heading">{ins.title}</p>}
                    <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-body">{ins.content}</p>
                    <p className="mt-2 text-[11.5px] text-ink-muted">
                      {t("portal.enteredBy")}: {ins.entered_by || "—"} · {formatDate(ins.created_at)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  );
}
