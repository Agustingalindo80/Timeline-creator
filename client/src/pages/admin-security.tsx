import { Helmet } from "react-helmet-async";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppTitle } from "@/hooks/use-app-title";
import { RolesManager } from "@/features/security/roles-manager";
import { UsersRolesManager } from "@/features/security/users-manager";
import { AuditLogViewer } from "@/features/security/audit-log-viewer";
import { RoleMatrixViewer } from "@/features/security/role-matrix-viewer";

export default function AdminSecurity() {
  const appTitle = useAppTitle("Security");

  return (
    <div className="p-6">
      <Helmet>
        <title>{appTitle}</title>
      </Helmet>

      <h1 className="text-xl font-semibold mb-6">Security</h1>

      <div className="max-w-4xl">
        <Tabs defaultValue="roles" data-testid="tabs-security-main">
          <TabsList className="mb-6" data-testid="tabs-list-security-main">
            <TabsTrigger value="roles" data-testid="tab-security-roles">Roles</TabsTrigger>
            <TabsTrigger value="users" data-testid="tab-security-users">Users</TabsTrigger>
            <TabsTrigger value="audit_log" data-testid="tab-security-audit-log">Audit Log</TabsTrigger>
            <TabsTrigger value="role_matrix" data-testid="tab-security-role-matrix">Role Matrix</TabsTrigger>
          </TabsList>

          <TabsContent value="roles">
            <RolesManager />
          </TabsContent>

          <TabsContent value="users">
            <UsersRolesManager />
          </TabsContent>

          <TabsContent value="audit_log">
            <AuditLogViewer />
          </TabsContent>

          <TabsContent value="role_matrix">
            <RoleMatrixViewer />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
