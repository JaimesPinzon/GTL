import { warmTrackedMarketData } from "@/app/utils/market/warmup";

export async function register() {
    if (process.env.NEXT_RUNTIME === "edge") {
        return;
    }

    void warmTrackedMarketData().catch((error) => {
        console.error("market warmup startup error", error);
    });
}
