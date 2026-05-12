import { useTradingContext } from "@/contexts/TradingContext";
import { useClassContext } from "@/features/classes/context/ClassContext";
import { useClassMarketContext } from "@/features/classes/context/ClassMarketContext";

export const useTradingWorkspace = () => {
  const trading = useTradingContext();
  const classState = useClassContext() || {};
  const classMarketState = useClassMarketContext() || {};

  return {
    ...trading,
    ...classState,
    ...classMarketState,
  };
};
