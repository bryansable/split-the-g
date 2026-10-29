-- Split The G: run this once in the Supabase SQL editor (Database > SQL).
-- Safe to re-run; everything is "if not exists" or "create or replace".

create extension if not exists pgcrypto;

-- ---------- profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique check (username ~ '^[a-z0-9_]{3,20}$'),
  created_at timestamptz not null default now()
);

-- Create a profile row automatically when a user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------- friendships ----------
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null,
  addressee_id uuid not null,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  constraint friendships_requester_id_fkey foreign key (requester_id) references public.profiles (id) on delete cascade,
  constraint friendships_addressee_id_fkey foreign key (addressee_id) references public.profiles (id) on delete cascade,
  constraint friendships_not_self check (requester_id <> addressee_id)
);

-- one row per pair regardless of direction (expression index; a table
-- constraint cannot hold expressions)
create unique index if not exists friendships_unique_pair
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create or replace function public.are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = a and f.addressee_id = b) or (f.requester_id = b and f.addressee_id = a))
  );
$$;

-- ---------- attempts ----------
create table if not exists public.attempts (
  id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  score int not null check (score between 0 and 100),
  offset_pct numeric(6, 2) not null,
  glass_type text not null default 'plain' check (glass_type in ('plain', 'official')),
  created_at timestamptz not null default now()
);

create index if not exists attempts_user_day on public.attempts (user_id, created_at desc);

-- ---------- row level security ----------
alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.attempts enable row level security;

-- profiles: anyone signed in can look up usernames; you edit only your own.
drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable" on public.profiles for select to authenticated using (true);
drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- friendships: see rows you are part of; request as yourself; accept as addressee; either side can delete.
drop policy if exists "friendships select" on public.friendships;
create policy "friendships select" on public.friendships for select to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());
drop policy if exists "friendships insert" on public.friendships;
create policy "friendships insert" on public.friendships for insert to authenticated
  with check (requester_id = auth.uid() and status = 'pending');
drop policy if exists "friendships accept" on public.friendships;
create policy "friendships accept" on public.friendships for update to authenticated
  using (addressee_id = auth.uid()) with check (addressee_id = auth.uid() and status = 'accepted');
drop policy if exists "friendships delete" on public.friendships;
create policy "friendships delete" on public.friendships for delete to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- attempts: your own, plus accepted friends' (for leaderboards).
drop policy if exists "attempts select" on public.attempts;
create policy "attempts select" on public.attempts for select to authenticated
  using (user_id = auth.uid() or public.are_friends(auth.uid(), user_id));
drop policy if exists "attempts insert own" on public.attempts;
create policy "attempts insert own" on public.attempts for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "attempts update own" on public.attempts;
create policy "attempts update own" on public.attempts for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "attempts delete own" on public.attempts;
create policy "attempts delete own" on public.attempts for delete to authenticated using (user_id = auth.uid());
