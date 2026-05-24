import "server-only";

import { supabaseAdmin } from "@/app/utils/supabase/admin";

const DEFAULT_CONTROL_ID = "twelvedata_quotes_batch";
const DEFAULT_MIN_INTERVAL_MS = 108000;
const DEFAULT_LOCK_WINDOW_MS = 30000;

const toPositiveInteger = (value: number, fallback: number) => {
    if (!Number.isFinite(value)) {
        return fallback;
    }

    const normalized = Math.trunc(value);
    return normalized > 0 ? normalized : fallback;
};

export async function acquireMarketQuotesRefreshLock({
    controlId = DEFAULT_CONTROL_ID,
    minIntervalMs = DEFAULT_MIN_INTERVAL_MS,
    lockWindowMs = DEFAULT_LOCK_WINDOW_MS,
}: {
    controlId?: string;
    minIntervalMs?: number;
    lockWindowMs?: number;
} = {}) {
    const { data, error } = await supabaseAdmin.rpc(
        "acquire_market_quotes_refresh_lock",
        {
            p_control_id: controlId,
            p_min_interval_ms: toPositiveInteger(
                minIntervalMs,
                DEFAULT_MIN_INTERVAL_MS
            ),
            p_lock_window_ms: toPositiveInteger(
                lockWindowMs,
                DEFAULT_LOCK_WINDOW_MS
            ),
        }
    );

    if (error) {
        throw error;
    }

    return data === true;
}

export async function markMarketQuotesRefreshComplete(
    controlId = DEFAULT_CONTROL_ID
) {
    const { error } = await supabaseAdmin.rpc(
        "mark_market_quotes_refresh_complete",
        {
            p_control_id: controlId,
        }
    );

    if (error) {
        throw error;
    }
}

export async function releaseMarketQuotesRefreshLock(
    controlId = DEFAULT_CONTROL_ID
) {
    const { error } = await supabaseAdmin.rpc(
        "release_market_quotes_refresh_lock",
        {
            p_control_id: controlId,
        }
    );

    if (error) {
        throw error;
    }
}
