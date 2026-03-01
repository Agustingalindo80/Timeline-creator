import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useMemo, useCallback } from "react";

export type ObjectAssignment = {
  id: string;
  objectType: string;
  objectId: string;
  objectRole: string;
};

type PermissionsResponse = {
  permissions: string[];
};

export function usePermissions() {
  const { isAuthenticated } = useAuth();

  const { data: permissionsData, isLoading: permissionsLoading } = useQuery<PermissionsResponse>({
    queryKey: ["/api/rbac/my-permissions"],
    enabled: isAuthenticated,
  });

  const { data: assignmentsData, isLoading: assignmentsLoading } = useQuery<ObjectAssignment[]>({
    queryKey: ["/api/rbac/my-assignments"],
    enabled: isAuthenticated,
  });

  const permissions = useMemo(
    () => new Set<string>(permissionsData?.permissions ?? []),
    [permissionsData],
  );

  const assignments = assignmentsData ?? [];
  const isLoading = permissionsLoading || assignmentsLoading;

  const hasPermission = useCallback(
    (key: string): boolean => permissions.has(key),
    [permissions],
  );

  const hasAnyPermission = useCallback(
    (keys: string[]): boolean => keys.some((k) => permissions.has(k)),
    [permissions],
  );

  const isAssignedTo = useCallback(
    (objectType: string, objectId: string): boolean =>
      assignments.some((a) => a.objectType === objectType && a.objectId === objectId),
    [assignments],
  );

  return {
    permissions,
    assignments,
    hasPermission,
    hasAnyPermission,
    isAssignedTo,
    isLoading,
  };
}
