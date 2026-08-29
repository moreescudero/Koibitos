-- Habilitar Realtime sobre las tres tablas: cualquier insert/update/delete se
-- empuja solo a los clientes suscriptos.
--
-- La publicación `supabase_realtime` ya existe en todo proyecto Supabase.
-- Este bloque es idempotente: si una tabla ya estaba agregada, no falla.

do $$
declare
  t text;
begin
  foreach t in array array['messages', 'itinerary_items', 'route_legs']
  loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception
      when duplicate_object then null; -- ya estaba en la publicación
    end;
  end loop;
end $$;

-- Para que los payloads de UPDATE/DELETE traigan la fila completa (no solo la PK):
alter table messages         replica identity full;
alter table itinerary_items  replica identity full;
alter table route_legs       replica identity full;
