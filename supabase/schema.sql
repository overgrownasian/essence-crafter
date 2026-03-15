create table if not exists public.alchemy_combinations (
  pair_key text primary key,
  first_element text not null,
  second_element text not null,
  element text not null,
  emoji text not null,
  flavor_text text,
  source text not null default 'openai',
  model text,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.alchemy_combinations
  add column if not exists flavor_text text;

create unique index if not exists alchemy_combinations_pair_key_idx
  on public.alchemy_combinations (pair_key);

alter table public.alchemy_combinations enable row level security;

drop policy if exists "Public can read combinations" on public.alchemy_combinations;
create policy "Public can read combinations"
  on public.alchemy_combinations
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Public can insert new combinations" on public.alchemy_combinations;
create policy "Public can insert new combinations"
  on public.alchemy_combinations
  for insert
  to anon, authenticated
  with check (true);

create table if not exists public.player_states (
  user_id uuid primary key references auth.users (id) on delete cascade,
  discovered_elements jsonb not null default '[]'::jsonb,
  display_name text,
  role text not null default 'player',
  theme text not null default 'default',
  revealed_recipe_results jsonb not null default '[]'::jsonb,
  saved_classes jsonb not null default '[]'::jsonb,
  achievements jsonb not null default '[]'::jsonb,
  world_first_discovery_count integer not null default 0,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.player_states
  add column if not exists discovered_elements jsonb not null default '[]'::jsonb,
  add column if not exists display_name text,
  add column if not exists role text not null default 'player',
  add column if not exists theme text not null default 'default',
  add column if not exists revealed_recipe_results jsonb not null default '[]'::jsonb,
  add column if not exists saved_classes jsonb not null default '[]'::jsonb,
  add column if not exists achievements jsonb not null default '[]'::jsonb,
  add column if not exists world_first_discovery_count integer not null default 0,
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

do $$
begin
  if not exists (
    select 1
    from information_schema.constraint_column_usage
    where table_schema = 'public'
      and table_name = 'player_states'
      and constraint_name = 'player_states_role_check'
  ) then
    alter table public.player_states
      add constraint player_states_role_check
      check (role in ('player', 'admin'));
  end if;
end
$$;

create table if not exists public.class_combinations (
  trio_key text primary key,
  first_essence text not null,
  second_essence text not null,
  third_essence text not null,
  class_name text not null,
  emoji text not null,
  class_title text not null,
  flavor_text text,
  profile_json jsonb,
  source text not null default 'openai',
  model text,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.class_combinations
  add column if not exists first_essence text,
  add column if not exists second_essence text,
  add column if not exists third_essence text,
  add column if not exists class_name text,
  add column if not exists emoji text,
  add column if not exists class_title text,
  add column if not exists flavor_text text,
  add column if not exists profile_json jsonb,
  add column if not exists source text not null default 'openai',
  add column if not exists model text,
  add column if not exists created_at timestamptz not null default timezone('utc', now());

create unique index if not exists class_combinations_trio_key_idx
  on public.class_combinations (trio_key);

alter table public.class_combinations enable row level security;

drop policy if exists "Public can read class combinations" on public.class_combinations;
create policy "Public can read class combinations"
  on public.class_combinations
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Public can insert new class combinations" on public.class_combinations;
create policy "Public can insert new class combinations"
  on public.class_combinations
  for insert
  to anon, authenticated
  with check (true);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'player_states'
      and column_name = 'elements'
  ) then
    execute $migration$
      update public.player_states
      set discovered_elements = coalesce(discovered_elements, elements, '[]'::jsonb)
    $migration$;
  end if;
end
$$;

alter table public.player_states enable row level security;

drop policy if exists "Users can read their own player state" on public.player_states;
create policy "Users can read their own player state"
  on public.player_states
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own player state" on public.player_states;
create policy "Users can insert their own player state"
  on public.player_states
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own player state" on public.player_states;
create policy "Users can update their own player state"
  on public.player_states
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
