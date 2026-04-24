import { fmtUSD } from "@/lib/format";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

interface Props {
  junior: number;
  senior: number;
  health: number;
}

export const CapitalStack = ({ junior, senior, health }: Props) => {
  const total = junior + senior;
  const juniorPct = total > 0 ? (junior / total) * 100 : 0;
  const seniorPct = 100 - juniorPct;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Capital stack</h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info className="w-3.5 h-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              Losses are absorbed by junior capital first. Senior (investor) capital is protected as long as the junior buffer holds.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="surface-elevated rounded-lg p-4 space-y-3">
        {/* Senior layer */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-sm bg-gradient-senior" />
              <span className="text-xs font-medium">Senior (investors)</span>
            </div>
            <span className="text-xs tabular text-muted-foreground">${fmtUSD(senior, { compact: true })}</span>
          </div>
          <div className="h-3 rounded-md bg-gradient-senior opacity-90" style={{ width: `${seniorPct}%` }} />
        </div>

        {/* Junior layer */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-sm bg-gradient-ember" />
              <span className="text-xs font-medium">Junior (trader skin)</span>
            </div>
            <span className="text-xs tabular text-muted-foreground">${fmtUSD(junior, { compact: true })}</span>
          </div>
          <div className="h-3 rounded-md bg-secondary overflow-hidden relative" style={{ width: `${juniorPct}%`, minWidth: "8%" }}>
            <div className="h-full bg-gradient-ember" style={{ width: `${health}%` }} />
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground pt-2 border-t border-border">
          Losses hit the junior layer first. Trader capital absorbs drawdowns before any investor funds are touched.
        </p>
      </div>
    </div>
  );
};
