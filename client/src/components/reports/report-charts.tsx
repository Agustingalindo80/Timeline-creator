import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import type { ReactNode } from "react";

const HEALTH_COLORS: Record<string, string> = {
  green: "#16a34a",
  amber: "#f59e0b",
  red: "#ef4444",
  Grey: "#9ca3af",
};

interface HealthPieChartProps {
  data: { name: string; value: number; color?: string }[];
  height?: number;
}

export function HealthPieChart({ data, height = 220 }: HealthPieChartProps) {
  const chartData = data.filter((d) => d.value > 0);
  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
        data-testid="chart-health-empty"
      >
        No data available
      </div>
    );
  }

  return (
    <div data-testid="chart-health-pie" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color || HEALTH_COLORS[entry.name.toLowerCase()] || "#9ca3af"}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, name: string) => [value, name]}
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid hsl(var(--border))",
              backgroundColor: "hsl(var(--popover))",
              color: "hsl(var(--popover-foreground))",
              fontSize: "12px",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-4 -mt-2">
        {chartData.map((entry) => (
          <div key={entry.name} className="flex items-center gap-1.5 text-xs">
            <div
              className="w-2.5 h-2.5 rounded-sm"
              style={{
                backgroundColor:
                  entry.color || HEALTH_COLORS[entry.name.toLowerCase()] || "#9ca3af",
              }}
            />
            <span className="text-muted-foreground">
              {entry.name}: {entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ReportBarChartProps {
  data: { name: string; value: number; fill?: string }[];
  height?: number;
  xAxisKey?: string;
  barKey?: string;
  barColor?: string;
}

export function ReportBarChart({
  data,
  height = 220,
  xAxisKey = "name",
  barKey = "value",
  barColor = "hsl(var(--primary))",
}: ReportBarChartProps) {
  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
        data-testid="chart-bar-empty"
      >
        No data available
      </div>
    );
  }

  return (
    <div data-testid="chart-bar" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey={xAxisKey}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={{ stroke: "hsl(var(--border))" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={{ stroke: "hsl(var(--border))" }}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid hsl(var(--border))",
              backgroundColor: "hsl(var(--popover))",
              color: "hsl(var(--popover-foreground))",
              fontSize: "12px",
            }}
          />
          <Bar dataKey={barKey} fill={barColor} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  subtitle?: string;
  className?: string;
  valueClassName?: string;
  testId?: string;
}

export function ReportStatCard({
  title,
  value,
  icon,
  subtitle,
  className,
  valueClassName,
  testId,
}: StatCardProps) {
  return (
    <Card className={className} data-testid={testId || `stat-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider truncate">
              {title}
            </p>
            <p className={`text-2xl font-semibold tabular-nums mt-1 ${valueClassName || ""}`}>
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
          {icon && (
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface HealthDotProps {
  health: string | null | undefined;
  size?: "sm" | "md";
}

export function HealthDot({ health, size = "sm" }: HealthDotProps) {
  const color = HEALTH_COLORS[(health || "").toLowerCase()] || HEALTH_COLORS.Grey;
  const sizeClass = size === "sm" ? "w-2.5 h-2.5" : "w-3.5 h-3.5";

  return (
    <div
      className={`${sizeClass} rounded-full shrink-0`}
      style={{ backgroundColor: color }}
      title={health || "Not set"}
      data-testid={`health-dot-${(health || "none").toLowerCase()}`}
    />
  );
}
