import { useMemo, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { Grid3X3, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SYSTEM_ROLE_PERMISSIONS } from "@shared/models/rbac";
import type { RbacPermission } from "./types";

export function RoleMatrixViewer() {
  const { data: permissions = [], isLoading: permsLoading } = useQuery<RbacPermission[]>({
    queryKey: ["/api/rbac/permissions"],
  });

  const categories = useMemo(() => {
    const cats: Record<string, RbacPermission[]> = {};
    for (const p of permissions) {
      const cat = p.category || "other";
      if (!cats[cat]) cats[cat] = [];
      cats[cat].push(p);
    }
    return cats;
  }, [permissions]);

  const systemRoleNames = Object.keys(SYSTEM_ROLE_PERMISSIONS);

  if (permsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
          <Grid3X3 className="w-4 h-4" />
          Role Permission Matrix
        </h2>
        <p className="text-sm text-muted-foreground">
          Reference view showing which permissions are granted to each system role.
        </p>
      </div>

      <Card className="card-elevated overflow-visible">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="table-role-matrix">
            <thead>
              <tr>
                <th className="table-header-cell text-left px-4 py-3 text-xs font-medium text-muted-foreground sticky left-0 bg-card dark:bg-card z-10">Permission</th>
                {systemRoleNames.map((roleName) => (
                  <th key={roleName} className="table-header-cell text-center px-3 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">
                    {roleName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(categories).map(([category, perms]) => (
                <Fragment key={category}>
                  <tr>
                    <td colSpan={systemRoleNames.length + 1} className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/50 dark:bg-muted/30">
                      {category}
                    </td>
                  </tr>
                  {perms.map((perm) => (
                    <tr key={perm.key} className="table-row-hover border-t border-border">
                      <td className="px-4 py-2 text-xs sticky left-0 bg-card dark:bg-card z-10">
                        <div>
                          <span className="font-medium">{perm.key}</span>
                          {perm.description && (
                            <span className="block text-muted-foreground text-[10px]">{perm.description}</span>
                          )}
                        </div>
                      </td>
                      {systemRoleNames.map((roleName) => {
                        const hasIt = SYSTEM_ROLE_PERMISSIONS[roleName]?.includes(perm.key);
                        return (
                          <td key={roleName} className="px-3 py-2 text-center">
                            {hasIt ? (
                              <Check className="w-4 h-4 text-green-600 dark:text-green-400 mx-auto" />
                            ) : (
                              <span className="text-muted-foreground/30">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
              {permissions.length === 0 && (
                <tr>
                  <td colSpan={systemRoleNames.length + 1} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No permissions defined.
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
