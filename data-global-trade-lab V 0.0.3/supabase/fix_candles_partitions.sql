-- Keep the partitioned candles table writable and readable for current/future dates.
-- Run this in Supabase SQL Editor after the candles table exists.
select public.create_monthly_candle_partitions(12);

-- Ensure the partition range also covers any existing rows in the DEFAULT partition.
do $$
declare
    default_min timestamptz;
    default_max timestamptz;
begin
    if to_regclass('public.candles_default') is null then
        return;
    end if;

    select min(open_time), max(open_time)
    into default_min, default_max
    from public.candles_default;

    if default_min is not null and default_max is not null then
        perform public.create_monthly_candle_partitions_between(default_min, default_max);
    end if;
end;
$$;
