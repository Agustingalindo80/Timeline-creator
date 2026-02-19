import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Helmet } from "react-helmet-async";
import { Plus, Clock, FileSpreadsheet, Trash2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { TimelineWithMilestones } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: timelines, isLoading } = useQuery<TimelineWithMilestones[]>({
    queryKey: ["/api/timelines"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/timelines/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines"] });
      toast({ title: "Timeline deleted" });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Timeline Studio - Create Beautiful Timelines</title>
        <meta name="description" content="Create visually appealing timelines from Excel spreadsheets or by manually adding milestones and stages." />
        <meta property="og:title" content="Timeline Studio" />
        <meta property="og:description" content="Create beautiful timelines from spreadsheets or manual input." />
      </Helmet>
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-primary flex items-center justify-center">
              <Clock className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Timeline Studio</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => navigate("/create?mode=upload")}
              data-testid="button-import-excel"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Import Excel
            </Button>
            <Button onClick={() => navigate("/create")} data-testid="button-create-timeline">
              <Plus className="w-4 h-4 mr-2" />
              New Timeline
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-5">
                <Skeleton className="h-5 w-3/4 mb-3" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </Card>
            ))}
          </div>
        ) : !timelines || timelines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-6">
              <Clock className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">No timelines yet</h2>
            <p className="text-muted-foreground mb-6 max-w-md">
              Create your first timeline by adding milestones manually or importing from an Excel spreadsheet.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => navigate("/create?mode=upload")}
                data-testid="button-empty-import"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Import Excel
              </Button>
              <Button onClick={() => navigate("/create")} data-testid="button-empty-create">
                <Plus className="w-4 h-4 mr-2" />
                Create Manually
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {timelines.map((timeline) => (
              <Card
                key={timeline.id}
                className="group relative overflow-visible hover-elevate active-elevate-2 cursor-pointer"
                data-testid={`card-timeline-${timeline.id}`}
              >
                <Link href={`/timeline/${timeline.id}`} className="block p-5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div
                      className="w-3 h-3 rounded-full mt-1.5 shrink-0"
                      style={{ backgroundColor: timeline.color }}
                    />
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {timeline.milestones.length} milestone{timeline.milestones.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                  <h3 className="font-semibold text-base mb-1 line-clamp-1">{timeline.title}</h3>
                  {timeline.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {timeline.description}
                    </p>
                  )}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span>View timeline</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </Link>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                      data-testid={`button-delete-${timeline.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete timeline?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete "{timeline.title}" and all its milestones.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate(timeline.id)}
                        data-testid="button-confirm-delete"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
