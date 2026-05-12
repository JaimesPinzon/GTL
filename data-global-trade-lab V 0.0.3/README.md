## Global Trade Lab

Base de backend/frontend en Next.js para conectar:

- Supabase para autenticacion y base de datos.
- TwelveData para datos de mercado desde el backend.

## Configuracion

1. Crea o actualiza `data-global-trade-lab/.env.local` usando `data-global-trade-lab/.env.example`.
2. Usa estas variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
TWELVEDATA_API_KEY=...
```

Notas:

- Las variables `NEXT_PUBLIC_*` son necesarias para el cliente y el servidor de Supabase.
- `TWELVEDATA_API_KEY` debe quedarse solo en backend. No la expongas en componentes cliente.

## Supabase Schema

Antes de probar perfiles, posiciones y transacciones persistentes, ejecuta el script:

```bash
data-global-trade-lab/supabase/schema.sql
```

Hazlo desde el SQL Editor de Supabase Studio sobre tu proyecto.

## Desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en el navegador.

## Endpoints disponibles

- `GET /api/market/quote?symbol=AAPL`
  Consulta una cotizacion en TwelveData desde el backend.

## Archivos clave

- `src/app/utils/supabase/client.ts`
- `src/app/utils/supabase/server.ts`
- `src/app/utils/supabase/middleware.ts`
- `src/app/utils/twelvedata/server.ts`
- `src/app/api/market/quote/route.ts`
- `src/middleware.ts`

## Siguiente paso recomendado

- Crear tablas y politicas RLS en Supabase.
- Agregar endpoints propios para guardar quotes, señales o historial en Supabase.

## Backfill automatico de velas Yahoo (cada 5 minutos)

Para que la tabla activa de velas (por ejemplo, particion mensual como `candles 2026 05`) se siga rellenando sola, programa un cron cada 5 minutos que llame:

- `GET /api/market/backfill/base-candles`
- Si `CRON_SECRET` esta configurado, envia header: `Authorization: Bearer <CRON_SECRET>`

Ejemplo:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/market/backfill/base-candles"
```
