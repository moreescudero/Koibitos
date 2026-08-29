-- Habilitar Realtime sobre las tres tablas: cualquier insert/update/delete se
-- empuja solo a los clientes suscriptos.
--
-- La publicación `supabase_realtime` ya existe en todo proyecto Supabase.
-- Si alguna tabla ya estaba agregada, el `add table` tira error: en ese caso
-- ignoralo o comentá la línea.

alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table itinerary_items;
alter publication supabase_realtime add table route_legs;

-- Para que los payloads de UPDATE/DELETE traigan la fila completa (no solo la PK):
alter table messages replica identity full;
alter table itinerary_items replica identity full;
alter table route_legs replica identity full;
