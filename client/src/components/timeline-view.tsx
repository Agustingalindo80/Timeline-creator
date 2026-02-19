import type { Milestone } from "@shared/schema";
import { cn } from "@/lib/utils";

interface TimelineViewProps {
  milestones: Milestone[];
  timelineColor: string;
}

export function TimelineView({ milestones, timelineColor }: TimelineViewProps) {
  const sorted = [...milestones].sort((a, b) => a.sortOrder - b.sortOrder);

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
          <div className="w-3 h-3 rounded-full bg-muted-foreground/40" />
        </div>
        <p className="text-sm text-muted-foreground">No milestones to display</p>
      </div>
    );
  }

  return (
    <div className="relative py-8">
      <div className="relative">
        {sorted.map((milestone, index) => {
          const isLeft = index % 2 === 0;
          const dotColor = milestone.color || timelineColor;

          return (
            <div key={milestone.id} className="relative" data-testid={`milestone-${milestone.id}`}>
              {/* Connector line */}
              {index < sorted.length - 1 && (
                <div
                  className="absolute left-1/2 -translate-x-1/2 top-6 w-0.5 z-0"
                  style={{
                    backgroundColor: `${timelineColor}20`,
                    height: "calc(100% + 1rem)",
                  }}
                />
              )}

              <div
                className={cn(
                  "flex items-start gap-6 mb-10 relative z-10",
                  isLeft ? "flex-row" : "flex-row-reverse"
                )}
              >
                {/* Content side */}
                <div className={cn("flex-1", isLeft ? "text-right" : "text-left")}>
                  <div
                    className={cn(
                      "inline-block rounded-md border border-border bg-card p-4 max-w-sm transition-all",
                      isLeft ? "mr-0 ml-auto" : "ml-0 mr-auto"
                    )}
                  >
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {milestone.date}
                    </p>
                    <h3 className="font-semibold text-sm mb-1">{milestone.title}</h3>
                    {milestone.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {milestone.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Center dot */}
                <div className="relative flex items-center justify-center shrink-0 w-3">
                  <div
                    className="w-3 h-3 rounded-full ring-4 ring-background z-10"
                    style={{ backgroundColor: dotColor }}
                  />
                </div>

                {/* Empty side */}
                <div className="flex-1" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TimelineViewHorizontal({ milestones, timelineColor }: TimelineViewProps) {
  const sorted = [...milestones].sort((a, b) => a.sortOrder - b.sortOrder);

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
          <div className="w-3 h-3 rounded-full bg-muted-foreground/40" />
        </div>
        <p className="text-sm text-muted-foreground">No milestones to display</p>
      </div>
    );
  }

  return (
    <div className="relative overflow-x-auto py-8 px-4">
      <div className="relative flex items-center min-w-max">
        {/* Horizontal line */}
        <div
          className="absolute top-1/2 left-4 right-4 h-0.5 -translate-y-1/2"
          style={{ backgroundColor: `${timelineColor}30` }}
        />

        {sorted.map((milestone, index) => {
          const isAbove = index % 2 === 0;
          const dotColor = milestone.color || timelineColor;

          return (
            <div
              key={milestone.id}
              className="relative flex flex-col items-center px-6"
              style={{ minWidth: "180px" }}
              data-testid={`milestone-h-${milestone.id}`}
            >
              {isAbove ? (
                <>
                  <div className="mb-3 text-center max-w-[160px]">
                    <p className="text-xs font-medium text-muted-foreground mb-0.5">
                      {milestone.date}
                    </p>
                    <h3 className="font-semibold text-xs mb-0.5">{milestone.title}</h3>
                    {milestone.description && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2">
                        {milestone.description}
                      </p>
                    )}
                  </div>
                  <div
                    className="w-3 h-3 rounded-full ring-4 ring-background z-10 shrink-0"
                    style={{ backgroundColor: dotColor }}
                  />
                  <div className="h-12" />
                </>
              ) : (
                <>
                  <div className="h-12" />
                  <div
                    className="w-3 h-3 rounded-full ring-4 ring-background z-10 shrink-0"
                    style={{ backgroundColor: dotColor }}
                  />
                  <div className="mt-3 text-center max-w-[160px]">
                    <p className="text-xs font-medium text-muted-foreground mb-0.5">
                      {milestone.date}
                    </p>
                    <h3 className="font-semibold text-xs mb-0.5">{milestone.title}</h3>
                    {milestone.description && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2">
                        {milestone.description}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
