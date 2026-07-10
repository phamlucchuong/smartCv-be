import { SCORE_COLOR } from "@/lib/mock-data";

interface Props {
  score: number;
  size?: number;
  thickness?: number;
  label?: string;
}

export function AIScoreRing({ score, size = 80, thickness = 8, label }: Props) {
  const radius = (size - thickness) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;
  const colorVar =
    SCORE_COLOR(score) === "success"
      ? "var(--color-success)"
      : SCORE_COLOR(score) === "warning"
        ? "var(--color-warning)"
        : "var(--color-danger)";

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="var(--color-border)"
            strokeWidth={thickness}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colorVar}
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            fill="none"
            style={{ transition: "stroke-dashoffset 600ms ease" }}
          />
        </svg>
        <div
          className="absolute inset-0 flex flex-col items-center justify-center font-bold leading-none"
          style={{ color: colorVar, fontSize: `${Math.max(9, Math.round(size * 0.28))}px` }}
        >
          <span>{score}%</span>
        </div>
      </div>
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
    </div>
  );
}
