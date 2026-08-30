-- Esquema base del viaje. Correr en el SQL Editor de Supabase (o `supabase db push`).

create extension if not exists "pgcrypto";

create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date,
  end_date date,
  created_at timestamptz default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade,
  sender text not null check (sender in ('morena', 'novio', 'gemini')),
  content text not null,
  created_at timestamptz default now()
);

create table if not exists itinerary_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade,
  city text not null,
  category text not null check (category in ('must_visit', 'shopping', 'food', 'note')),
  title text not null,
  description text,
  day_index int,
  created_at timestamptz default now()
);

create table if not exists route_legs (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade,
  order_index int not null,
  city text not null,
  days_allocated int,
  notes text
);

create index if not exists messages_trip_created_idx on messages (trip_id, created_at);
create index if not exists itinerary_items_trip_idx on itinerary_items (trip_id, created_at);
create index if not exists route_legs_trip_order_idx on route_legs (trip_id, order_index);

-- Permisos de tabla para los roles de Supabase. RLS (0003) filtra las FILAS, pero
-- el rol necesita primero el GRANT sobre la tabla. Si las tablas se crean fuera del
-- dashboard (ej. `supabase db query --linked`), este GRANT no se aplica solo.
grant select, insert, update, delete
  on table trips, messages, itinerary_items, route_legs
  to authenticated, service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;
