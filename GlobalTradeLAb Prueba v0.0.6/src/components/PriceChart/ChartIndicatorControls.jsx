import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LineChart, BarChart2 } from "lucide-react";

const ChartIndicatorControls = ({
  showPanel,
  showEMA,
  setShowEMA,
  emaPeriod,
  setEmaPeriod,
  showMACD,
  setShowMACD,
  dark = false,
}) => {
  if (!showPanel) return null;

  return (
    <div
      className={`flex flex-wrap items-end gap-4 text-xs ${
        dark
          ? "rounded-2xl border border-white/10 bg-white/5 p-4 text-zinc-200"
          : "my-2 border-y border-border p-2"
      }`}
    >
      <div className="flex items-center space-x-2">
        <Button variant={showEMA ? "secondary" : "outline"} size="sm" onClick={() => setShowEMA(!showEMA)}>
          <LineChart className="mr-1 h-4 w-4" /> EMA
        </Button>
        {showEMA ? (
          <div className="flex items-center space-x-1">
            <Label htmlFor="emaPeriod" className="mb-0">
              Periodo:
            </Label>
            <Input
              type="number"
              id="emaPeriod"
              value={emaPeriod}
              onChange={(event) => setEmaPeriod(parseInt(event.target.value, 10) || 1)}
              className="h-8 w-16 text-xs"
              min="1"
            />
          </div>
        ) : null}
      </div>

      <div className="flex items-center space-x-2">
        <Button variant={showMACD ? "secondary" : "outline"} size="sm" onClick={() => setShowMACD(!showMACD)}>
          <BarChart2 className="mr-1 h-4 w-4" /> MACD
        </Button>
      </div>
    </div>
  );
};

export default ChartIndicatorControls;
