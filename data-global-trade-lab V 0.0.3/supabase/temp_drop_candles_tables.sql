-- Temporal script: pre-create monthly partitions from year 2000.
-- Requirement: public.create_monthly_candle_partitions_between(...) must exist in schema.sql
-- and public.candles must already be created as partitioned table.

select public.create_monthly_candle_partitions_between(
    '2000-01-01 00:00:00+00'::timestamptz,
    date_trunc('month', timezone('utc', now())) + interval '6 months'
);

-- Quick validation
select
    min(tablename) as first_partition,
    max(tablename) as last_partition,
    count(*) as total_monthly_partitions
from pg_tables
where schemaname = 'public'
  and tablename like 'candles_20__%';
