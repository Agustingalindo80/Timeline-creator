import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { AllocationWithTeamMember } from "@shared/schema";

export function ProjectTeamMembersTab({ timelineId }: { timelineId: string }) {
  const { data: allocs = [], isLoading } = useQuery<AllocationWithTeamMember[]>({
    queryKey: ["/api/timelines", timelineId, "allocations"],
    queryFn: async () => {
      const res = await fetch(`/api/timelines/${timelineId}/allocations`);
      if (!res.ok) throw new Error("Failed to fetch allocations");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (allocs.length === 0) {
    return (
      <div className="text-center py-8">
        <Users className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">No team members allocated to this project.</p>
        <p className="text-xs text-muted-foreground mt-1">
          Add allocations from the{" "}
          <Link href="/team-members" className="underline text-primary" data-testid="link-team-members-page">
            Team Members
          </Link>{" "}
          page or individual team member profiles.
        </p>
      </div>
    );
  }

  const totalWeeklyHours = allocs.reduce((sum, a) => sum + Number(a.weeklyHours || 0), 0);

  return (
    <div className="space-y-4" data-testid="project-team-members-tab">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {allocs.length} team member{allocs.length !== 1 ? "s" : ""} allocated &middot; {totalWeeklyHours} hrs/week total
        </p>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Name</th>
              <th className="text-left p-3 font-medium">Role</th>
              <th className="text-left p-3 font-medium">Department</th>
              <th className="text-right p-3 font-medium">Hours/Week</th>
              <th className="text-left p-3 font-medium">Start</th>
              <th className="text-left p-3 font-medium">End</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-left p-3 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {allocs.map((a) => (
              <tr key={a.id} className="border-b last:border-b-0 hover:bg-muted/30" data-testid={`team-member-row-${a.id}`}>
                <td className="p-3">
                  <Link
                    href={`/team-members/${a.teamMember.id}`}
                    className="text-primary hover:underline font-medium"
                    data-testid={`link-team-member-${a.teamMember.id}`}
                  >
                    {a.teamMember.name}
                  </Link>
                </td>
                <td className="p-3">
                  {a.teamMember.role ? (
                    <Badge variant="secondary" data-testid={`badge-role-${a.id}`}>
                      {a.teamMember.role.replace(/_/g, " ")}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="p-3 text-muted-foreground">{a.teamMember.department || "—"}</td>
                <td className="p-3 text-right font-mono">{a.weeklyHours}</td>
                <td className="p-3 text-muted-foreground">{a.startDate || "—"}</td>
                <td className="p-3 text-muted-foreground">{a.endDate || "—"}</td>
                <td className="p-3">
                  <Badge variant={a.status === "active" ? "default" : "secondary"} className={a.status === "active" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"} data-testid={`badge-alloc-status-${a.id}`}>
                    {a.status === "active" ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td className="p-3 text-muted-foreground text-xs">{a.notes || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
