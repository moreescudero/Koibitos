-- Datos iniciales. El id del trip es fijo para poder ponerlo en
-- NEXT_PUBLIC_TRIP_ID. Cambialo si querés, pero que coincida con el .env.

insert into trips (id, name)
values ('11111111-1111-1111-1111-111111111111', 'Japón — Morena & Novio')
on conflict (id) do nothing;

-- Recorrido base (Tokio -> Fujiyoshida -> Hakone -> Takayama -> Shirakawa-go -> Kioto -> Osaka).
-- days_allocated son placeholders: ajustar.
insert into route_legs (trip_id, order_index, city, days_allocated, notes) values
  ('11111111-1111-1111-1111-111111111111', 0, 'Tokio',        4, 'Llegada. TODO: ajustar días.'),
  ('11111111-1111-1111-1111-111111111111', 1, 'Fujiyoshida',  1, 'Vistas del Fuji. Viaje Tokio -> Fujiyoshida: ~1 h 50 min (aprox., verificar).'),
  ('11111111-1111-1111-1111-111111111111', 2, 'Hakone',       1, 'Onsen. Viaje Fujiyoshida -> Hakone: ~1 h 40 min (aprox., verificar).'),
  ('11111111-1111-1111-1111-111111111111', 3, 'Takayama',     2, 'Casco histórico. Viaje Hakone -> Takayama: ~5 h (aprox., verificar).'),
  ('11111111-1111-1111-1111-111111111111', 4, 'Shirakawa-go', 1, 'Aldea gassho-zukuri. Viaje Takayama -> Shirakawa-go: ~50 min en bus (aprox., verificar).'),
  ('11111111-1111-1111-1111-111111111111', 5, 'Kioto',        3, 'Templos. Viaje Shirakawa-go -> Kioto: ~3 h 40 min (aprox., verificar).'),
  ('11111111-1111-1111-1111-111111111111', 6, 'Osaka',        2, 'Comida + salida. Viaje Kioto -> Osaka: ~30 min (aprox., verificar).')
on conflict do nothing;

-- Items que ya tienen definidos.
insert into itinerary_items (trip_id, city, category, title, description) values
  ('11111111-1111-1111-1111-111111111111', 'Tokio', 'must_visit', 'Snoopy Museum', 'Museo de Snoopy en Machida / Minami-machida. Sacar entradas online.'),
  ('11111111-1111-1111-1111-111111111111', 'Kioto', 'must_visit', 'Fushimi Inari', 'Ir temprano para evitar la multitud de los toriis.'),
  ('11111111-1111-1111-1111-111111111111', 'Osaka', 'food', 'Takoyaki en Dotonbori', 'Probar takoyaki y okonomiyaki en la zona de Dotonbori.')
on conflict do nothing;
