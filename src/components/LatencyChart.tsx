import { useMemo } from "react";

interface Props {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

const LatencyChart = ({ data, width = 120, height = 24, color = "hsl(var(--primary))" }: Props) => {
  const points = useMemo(() => {
    if (data.length < 2) return "";
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const stepX = width / (data.length - 1);

    return data
      .map((v, i) => {
        const x = i * stepX;
        const y = height - ((v - min) / range) * (height - 4) - 2;
        return `${x},${y}`;
      })
      .join(" ");
  }, [data, width, height]);

  if (data.length < 2) return null;

  const avg = Math.round(data.reduce((a, b) => a + b, 0) / data.length);

  return (
    <div className="flex items-center gap-2">
      <svg width={width} height={height} className="overflow-visible">
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-[9px] font-mono text-muted-foreground">avg {avg}ms</span>
    </div>
  );
};

export default LatencyChart;
