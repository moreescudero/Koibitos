# Koibitos — chat + itinerario colaborativo (viaje a Japón)

Morena y Augusto chatean en un espacio compartido y un panel de itinerario se
arma y actualiza solo, en tiempo real, para los dos. El chat pasa por Gemini
(`gemini-flash-latest`) con **function calling**: cuando aparece un lugar / comida /
compra / idea, el modelo lo guarda en la base y el panel se actualiza por Realtime.

Todo el stack corre en free tier: **Vercel + Supabase + Gemini API** (esta última
sin tarjeta). Nota: en el free tier de Gemini, Google puede usar los mensajes para
mejorar sus modelos.

## Stack

- **Next.js 16** (App Router) + React + TypeScript + Tailwind v4
- **Supabase** (Postgres): base, Realtime, auth con magic link
- **Gemini API** (`gemini-flash-latest`) con function calling
- Deploy: **Vercel** (frontend + API routes) + Supabase hosteado

## Cómo corre el flujo

1. Alguien escribe en el chat → `POST /api/chat`.
2. La API route inserta el mensaje en `messages` (Realtime lo muestra en ambas pantallas).
3. Arma contexto (historial + itinerario + ruta actual) y llama a Gemini con 3 funciones.
4. Si Gemini devuelve una `functionCall`, la API route ejecuta el insert/update/delete
   en Supabase (loop de hasta 5 iteraciones) y le devuelve el resultado.
5. La respuesta final de Gemini se guarda como `sender: 'gemini'`.
6. Todos los cambios llegan solos a los dos clientes por Realtime.

Los tiempos de viaje entre ciudades salen de una tabla estática
([lib/routes.ts](lib/routes.ts)), no del modelo. **Todos los valores están
marcados como `TODO: verificar`** — revisalos en Google Maps / Navitime antes de
usarlos para armar horarios reales.

---

## Setup paso a paso

### 1. Dependencias

```bash
npm install
```

### 2. Proyecto Supabase

1. Crear un proyecto en [supabase.com](https://supabase.com).
2. **Project Settings → API**: copiar `URL`, `anon public` key y `service_role` key.
3. Editar los dos mails en
   [supabase/migrations/0003_rls.sql](supabase/migrations/0003_rls.sql)
   (función `is_trip_member`). Tienen que ser los mails reales de ustedes dos.
4. En **SQL Editor**, correr las 4 migraciones en orden:
   - `supabase/migrations/0001_schema.sql`
   - `supabase/migrations/0002_realtime.sql`
   - `supabase/migrations/0003_rls.sql`
   - `supabase/migrations/0004_seed.sql`

   > Alternativa con la CLI: `supabase link` + `supabase db push`.
5. **Database → Replication → `supabase_realtime`**: verificar que `messages`,
   `itinerary_items` y `route_legs` figuran como habilitadas.

### 3. Auth (magic link)

En **Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3000` (y después la de Vercel).
- **Redirect URLs**: agregar `http://localhost:3000/**` y `https://TU-APP.vercel.app/**`.

No hace falta configurar SMTP para probar: Supabase manda el mail con su
remitente por defecto (con rate limit).

### 4. Gemini

Sacar una API key gratis en [aistudio.google.com](https://aistudio.google.com)
(botón "Get API key", sin tarjeta).

### 5. Variables de entorno

Copiar `.env.example` a `.env.local` y completar:

```
GEMINI_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_TRIP_ID=11111111-1111-1111-1111-111111111111
NEXT_PUBLIC_ALLOWED_EMAILS=mail-morena@ejemplo.com,mail-novio@ejemplo.com
```

- `NEXT_PUBLIC_ALLOWED_EMAILS`: los dos mails que pueden entrar, separados por
  coma. **El primero es "morena", el segundo "novio".** Tienen que coincidir con
  los de `0003_rls.sql`.
- `NEXT_PUBLIC_TRIP_ID`: el id del trip sembrado en `0004_seed.sql`.

### 6. Correr en local

```bash
npm run dev
```

Abrir <http://localhost:3000>, ingresar cada mail, abrir el link mágico del mail.

### 7. Deploy en Vercel

1. Subir el repo a GitHub e importarlo en Vercel.
2. Cargar las mismas variables de entorno (Project Settings → Environment Variables).
3. Deploy. Agregar la URL final a las Redirect URLs de Supabase (paso 3).

> El plan Hobby de Vercel permite funciones de hasta 60 s
> ([app/api/chat/route.ts](app/api/chat/route.ts) ya setea `maxDuration = 60`).

---

## Estructura

```
app/
  api/chat/route.ts        API route: mensaje -> Gemini -> funciones -> Supabase
  auth/callback/route.ts   callback del magic link
  login/page.tsx           form de magic link
  trip/[tripId]/page.tsx   carga inicial (server) + render de TripView
components/
  TripView.tsx             estado + suscripciones Realtime, layout 2 columnas
  ChatPanel.tsx            mensajes + input
  ItineraryPanel.tsx       agrupado por ciudad segun el orden de la ruta
lib/
  supabase/{client,server,service}.ts
  gemini.ts                cliente + declaración de las 3 funciones + system prompt
  tools.ts                 ejecutores de las funciones contra Supabase
  routes.ts                tabla estática de tiempos de viaje (TODO: verificar)
  context.ts               serializa el estado del viaje para el system prompt
  allowed.ts               mails permitidos + mapeo mail -> remitente
supabase/migrations/       0001 schema, 0002 realtime, 0003 rls, 0004 seed
proxy.ts                   refresca sesión + protege todo salvo /login y /auth
```

## Tests

```bash
npm test
```

Cubren la tabla de rutas (`lib/routes.test.ts`) y la validación de inputs de los
funciones (`lib/tools.test.ts`). El flujo Realtime + Gemini se prueba a mano una
vez que Supabase y la API key están configurados.
