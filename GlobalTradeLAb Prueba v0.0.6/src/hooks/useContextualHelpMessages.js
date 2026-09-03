import { useTradingContext } from "@/contexts/TradingContext";

export const useContextualHelpMessages = () => {
  const { preferencesState } = useTradingContext();
  return preferencesState?.contextualHelpMessages ?? true;
};

