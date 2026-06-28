import { cn } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Props {
  health: number; // 0-100
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const getColor = (h: number) => {
  if (h < 20) return "hsl(var(--destructive))";
  if (h < 50) return "hsl(var(--warning))";
  return "hsl(var(--success))";
};

const getTextColor = (h: number) => {
  if (h < 20) return "text-destructive";
  if (h < 50) return "text-warning";
  return "text-success";
};

export const HealthMeter = ({ health, size = "md", showLabel = true, className }: Props) => {
  // Generate chart data - simulate health trend
  const data = Array.from({ length: 12 }, (_, i) => ({
    day: i,
    health: Math.max(10, health - Math.random() * 15),
  }));

  const heights = { sm: "h-32", md: "h-40", lg: "h-48" };

  return (
    <div className={cn("w-full", className)}>
      {showLabel && (
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-muted-foreground font-medium">Junior health</span>
          <span className={cn("text-sm tabular font-semibold", getTextColor(health))}>{Math.round(health)}%</span>
        </div>
      )}
      <div className={cn("w-full", heights[size])}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 11 }}
              stroke="hsl(var(--muted-foreground))"
              opacity={0.6}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11 }}
              stroke="hsl(var(--muted-foreground))"
              opacity={0.6}
              width={30}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
              }}
              formatter={(value) => `${Math.round(value as number)}%`}
            />
            <Line
              type="monotone"
              dataKey="health"
              stroke={getColor(health)}
              dot={false}
              strokeWidth={2}
              isAnimationActive={false}
            />
            {/* Threshold lines */}
            <Line
              type="monotone"
              dataKey={() => 50}
              stroke="hsl(var(--success))"
              strokeWidth={1}
              strokeDasharray="5 5"
              dot={false}
              isAnimationActive={false}
              name="Threshold 50%"
            />
            <Line
              type="monotone"
              dataKey={() => 20}
              stroke="hsl(var(--destructive))"
              strokeWidth={1}
              strokeDasharray="5 5"
              dot={false}
              isAnimationActive={false}
              name="Threshold 20%"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
