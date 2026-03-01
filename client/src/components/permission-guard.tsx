import { type ReactNode } from "react";
import { usePermissions } from "@/hooks/use-permissions";

type PermissionGuardProps = {
  permission?: string;
  permissions?: string[];
  fallback?: ReactNode;
  children: ReactNode;
};

export function PermissionGuard({ permission, permissions, fallback = null, children }: PermissionGuardProps) {
  const { hasPermission, hasAnyPermission, isLoading } = usePermissions();

  if (isLoading) {
    return <>{fallback}</>;
  }

  const allowed = permission
    ? hasPermission(permission)
    : permissions
      ? hasAnyPermission(permissions)
      : true;

  if (!allowed) {
    return <>{fallback}</>;
  }

  return <div data-testid="permission-guard-allowed">{children}</div>;
}
