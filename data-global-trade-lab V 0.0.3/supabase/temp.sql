-- Legacy cleanup: remove deprecated simulation accounts table.
drop table if exists public.student_sim_accounts cascade;
