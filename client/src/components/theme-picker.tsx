import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export interface TimelineTheme {
  name: string;
  color: string;
}

export const TIMELINE_THEMES: TimelineTheme[] = [
  { name: "Ocean", color: "#2563eb" },
  { name: "Violet", color: "#7c3aed" },
  { name: "Rose", color: "#db2777" },
  { name: "Sunset", color: "#ea580c" },
  { name: "Forest", color: "#16a34a" },
  { name: "Teal", color: "#0891b2" },
  { name: "Indigo", color: "#4f46e5" },
  { name: "Amber", color: "#ca8a04" },
  { name: "Slate", color: "#475569" },
  { name: "Crimson", color: "#dc2626" },
  { name: "Emerald", color: "#059669" },
  { name: "Fuchsia", color: "#c026d3" },
];

interface ThemePickerProps {
  value: string;
  onChange: (color: string) => void;
  compact?: boolean;
}

export function ThemePicker({ value, onChange, compact = false }: ThemePickerProps) {
  return (
    <div className={cn("flex gap-2 flex-wrap", compact ? "" : "")}>
      {TIMELINE_THEMES.map((theme) => {
        const isSelected = value === theme.color;
        return (
          <button
            key={theme.color}
            onClick={() => onChange(theme.color)}
            className={cn(
              "group relative flex flex-col items-center gap-1 rounded-md transition-opacity",
              compact ? "p-1" : "p-1.5",
            )}
            data-testid={`button-theme-${theme.name.toLowerCase()}`}
          >
            <div
              className={cn(
                "rounded-full flex items-center justify-center transition-all",
                compact ? "w-6 h-6" : "w-8 h-8",
                isSelected ? "ring-2 ring-offset-2 ring-offset-background" : "",
              )}
              style={{
                backgroundColor: theme.color,
                ...(isSelected ? { ["--tw-ring-color" as string]: theme.color } : {}),
              }}
            >
              {isSelected && (
                <Check className={cn("text-white", compact ? "w-3 h-3" : "w-4 h-4")} />
              )}
            </div>
            {!compact && (
              <span className={cn(
                "text-[10px] leading-tight",
                isSelected ? "font-medium text-foreground" : "text-muted-foreground",
              )}>
                {theme.name}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
