alter table public.pots add column if not exists agent_lock_at timestamptz;
alter table public.pots add column if not exists agent_pending boolean not null default false;
alter table public.pots add column if not exists agent_working text;
alter table public.pots add column if not exists last_search_band numeric not null default 0;
alter table public.pots add column if not exists last_top_categories text[] not null default '{}';
alter table public.candidates add column if not exists signals jsonb not null default '{}';
create index if not exists candidates_pot_rank_idx on public.candidates(pot_id, rank);