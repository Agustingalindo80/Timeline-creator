import { RAG_COLOR, RAG_LABEL, type Rag } from "./theme";

interface HealthScoreGaugeProps {
  score: number | null;
  rag: Rag;
  size?: number;
}

export function HealthScoreGauge({ score, rag, size = 120 }: HealthScoreGaugeProps) {
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = score === null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  const dash = circumference * pct;
  const color = RAG_COLOR[rag];

  return (
    <div
      className="relative flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
      data-testid="gauge-health-score"
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tabular-nums text-white" data-testid="text-health-score">
          {score === null ? "\u2014" : score}
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-white/70">
          {RAG_LABEL[rag]}
        </span>
      </div>
    </div>
  );
}
