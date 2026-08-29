-- Row Level Security: solo los dos mails del viaje pueden leer/escribir.
--
-- >>> EDITAR estos dos mails antes de correr la migración <<<
-- Tienen que ser los mismos que pongas en NEXT_PUBLIC_ALLOWED_EMAILS.
--
-- El cliente con SERVICE ROLE KEY (usado por /api/chat) bypassa RLS, así que
-- estas policies no lo afectan.

alter table trips            enable row level security;
alter table messages         enable row level security;
alter table itinerary_items  enable row level security;
alter table route_legs       enable row level security;

-- Helper: mails autorizados. Cambiá los valores.
create or replace function public.is_trip_member()
returns boolean
language sql
stable
as $$
  select auth.email() in (
    'escuderomore1@gmail.com',
    'augusto.f2012@gmail.com'
  );
$$;

do $$
declare
  t text;
begin
  foreach t in array array['trips', 'messages', 'itinerary_items', 'route_legs']
  loop
    execute format('drop policy if exists "trip_members_all" on %I', t);
    execute format(
      'create policy "trip_members_all" on %I
         for all
         to authenticated
         using (public.is_trip_member())
         with check (public.is_trip_member())',
      t
    );
  end loop;
end $$;
