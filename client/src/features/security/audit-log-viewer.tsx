import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AuditEntry } from "./types";

export function AuditLogViewer() {
  const { data: entries = [], isLoading } = useQuery<AuditEntry[]>({
    queryKey: ["/api/audit-log"],
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
          <ScrollText className="w-4 h-4" />
          Audit Log
        </h2>
        <p className="text-sm text-muted-foreground">
          A chronological record of significant actions performed in the system.
        </p>
      </div>

      <Card className="card-elevated overflow-visible">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="table-audit-log">
            <thead>
              <tr>
                <th className="table-header-cell text-left px-4 py-3 text-xs font-medium text-muted-foreground">Timestamp</th>
                <th className="table-header-cell text-left px-4 py-3 text-xs font-medium text-muted-foreground">Actor</th>
                <th className="table-header-cell text-left px-4 py-3 text-xs font-medium text-muted-foreground">Action</th>
                <th className="table-header-cell text-left px-4 py-3 text-xs font-medium text-muted-foreground">Object</th>
                <th className="table-header-cell text-left px-4 py-3 text-xs font-medium text-muted-foreground">Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="table-row-hover border-t border-border" data-testid={`row-audit-${entry.id}`}>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {entry.actorUserId || "System"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs">{entry.action}</Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {entry.objectType ? `${entry.objectType}${entry.objectId ? `:${entry.objectId}` : ""}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">
                    {entry.metadata ? JSON.stringify(entry.metadata) : "—"}
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No audit log entries found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
