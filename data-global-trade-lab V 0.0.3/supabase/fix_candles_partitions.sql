-- Diagnostic only. Do not create partitions while public.candles_default may contain rows.
-- Creating a partition forces PostgreSQL to scan/lock the DEFAULT partition and can wait
-- for a long time on a large table.
select
		pid,
		usename,
		state,
		wait_event_type,
		wait_event,
		now() - query_start as duration,
		left(query, 300) as query
from pg_stat_activity
where datname = current_database()
order by query_start nulls last;

select
		c.relname as child_table,
		pg_get_expr(c.relpartbound, c.oid) as partition_bound,
		pg_size_pretty(pg_total_relation_size(c.oid)) as total_size
from pg_inherits i
join pg_class c on c.oid = i.inhrelid
join pg_class p on p.oid = i.inhparent
join pg_namespace n on n.oid = p.relnamespace
where n.nspname = 'public'
	and p.relname = 'candles'
order by c.relname;

-- Required by the Data API reads used by the chart.
create index if not exists candles_instrument_timeframe_open_time_idx
	on public.candles (instrument_id, timeframe, open_time desc);

-- Recovery is intentionally manual and targeted. From a second SQL connection,
-- terminate only a stuck partition command if it appears in pg_stat_activity:
-- select pg_terminate_backend(pid)
-- from pg_stat_activity
-- where pid <> pg_backend_pid()
--   and query ~* '(create_monthly_candle_partitions|partition of public\.candles)';
