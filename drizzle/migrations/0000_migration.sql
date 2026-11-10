create table public.pots (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  admin_token text not null,
  recipient_name text not null,
  occasion text not null check (occasion in ('leaving','birthday','teacher_thank_you','wedding','new_baby','other')),
  closeness text not null check (closeness in ('close_friend','family','colleague','kids_classmate','teacher')),
  likes text[] not null default '{}',
  dislikes text[] not null default '{}',
  wishlist_url text,
  wishlist_image_path text,
  mode text not null default 'pot_first' check (mode in ('pot_first','fixed_split')),
  target_amount numeric(10,2) not null check (target_amount > 0),
  currency text not null default 'GBP',
  deadline_at timestamptz not null,
  vote_window text not null default '1d' check (vote_window in ('off','1h','1d','all_in')),
  expected_count int not null default 5 check (expected_count > 0),
  organiser_name text not null,
  organiser_paypal_email text not null,
  status text not null default 'collecting' check (status in ('collecting','voting','veto','buying','done','cancelled')),
  reminders_enabled boolean not null default true,
  demo_speed boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.contributions (
  id uuid primary key default gen_random_uuid(),
  pot_id uuid not null references public.pots(id) on delete cascade,
  display_name text not null default '',
  visibility text not null default 'named' check (visibility in ('named','anonymous','amount_hidden')),
  amount numeric(10,2) not null check (amount > 0),
  paypal_order_id text unique,
  authorization_id text,
  auth_expires_at timestamptz,
  honor_expires_at timestamptz,
  status text not null default 'created' check (status in ('created','authorized','reauthorized','captured','voided','failed')),
  captured_amount numeric(10,2),
  capture_id text,
  is_seeded boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.card_signatures (
  id uuid primary key default gen_random_uuid(),
  pot_id uuid not null references public.pots(id) on delete cascade,
  contribution_id uuid references public.contributions(id) on delete cascade,
  name text not null,
  message text not null check (char_length(message) <= 280),
  created_at timestamptz not null default now()
);
create table public.category_votes (
  id uuid primary key default gen_random_uuid(),
  pot_id uuid not null references public.pots(id) on delete cascade,
  contribution_id uuid references public.contributions(id) on delete cascade,
  category text not null,
  created_at timestamptz not null default now()
);
create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  pot_id uuid not null references public.pots(id) on delete cascade,
  channel3_product_id text, title text not null, image_url text, offer_url text, retailer text,
  price numeric(10,2), currency text, category text, fit_score numeric, reason text,
  total_score numeric, rank int, band text, fetched_at timestamptz not null default now()
);
create table public.final_votes (
  id uuid primary key default gen_random_uuid(),
  pot_id uuid not null references public.pots(id) on delete cascade,
  contribution_id uuid references public.contributions(id) on delete cascade,
  candidate_id uuid references public.candidates(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  pot_id uuid not null references public.pots(id) on delete cascade,
  candidate_id uuid references public.candidates(id),
  buy_at timestamptz, vetoed_at timestamptz,
  swapped_to uuid references public.candidates(id),
  decided_by text check (decided_by in ('votes','agent','organiser')),
  created_at timestamptz not null default now()
);
create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  pot_id uuid not null references public.pots(id) on delete cascade,
  payout_batch_id text, item_id text, amount numeric(10,2), status text, buy_url text,
  created_at timestamptz not null default now()
);
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  pot_id uuid not null references public.pots(id) on delete cascade,
  draft_text text, approved_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.agent_events (
  id uuid primary key default gen_random_uuid(),
  pot_id uuid not null references public.pots(id) on delete cascade,
  at timestamptz not null default now(),
  kind text not null, message text not null, payload jsonb not null default '{}'
);

grant all on public.pots, public.contributions, public.card_signatures, public.category_votes, public.candidates, public.final_votes, public.decisions, public.payouts, public.reminders, public.agent_events to service_role;

alter table public.pots enable row level security;
alter table public.contributions enable row level security;
alter table public.card_signatures enable row level security;
alter table public.category_votes enable row level security;
alter table public.candidates enable row level security;
alter table public.final_votes enable row level security;
alter table public.decisions enable row level security;
alter table public.payouts enable row level security;
alter table public.reminders enable row level security;
alter table public.agent_events enable row level security;
-- No anon/authenticated policies: every read and write goes through server functions keyed on slug or admin token.

create index on public.contributions(pot_id);
create index on public.card_signatures(pot_id);
create index on public.agent_events(pot_id, at);
create index on public.candidates(pot_id);

-- Realtime doorbell: data-free public broadcast on topic pot-<id>; clients refetch through server functions.
create or replace function public.kitty_doorbell()
returns trigger language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  pid := coalesce(new.pot_id, old.pot_id);
  perform realtime.send(jsonb_build_object('table', tg_table_name), 'changed', 'pot-' || pid::text, false);
  return null;
end $$;

create or replace function public.kitty_pot_doorbell()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform realtime.send(jsonb_build_object('table', 'pots'), 'changed', 'pot-' || new.id::text, false);
  return null;
end $$;

create trigger contributions_bell after insert or update or delete on public.contributions for each row execute function public.kitty_doorbell();
create trigger votes_bell after insert or update or delete on public.category_votes for each row execute function public.kitty_doorbell();
create trigger final_votes_bell after insert or update or delete on public.final_votes for each row execute function public.kitty_doorbell();
create trigger candidates_bell after insert or update or delete on public.candidates for each row execute function public.kitty_doorbell();
create trigger signatures_bell after insert or update or delete on public.card_signatures for each row execute function public.kitty_doorbell();
create trigger events_bell after insert on public.agent_events for each row execute function public.kitty_doorbell();
create trigger pots_bell after update on public.pots for each row execute function public.kitty_pot_doorbell();