# DEC-029 · Supabase (región `us-east-1`) como backend de producto

- **Estado:** Aceptada
- **Fecha:** 2026-09-19
- **Decisores:** Lead del workstream D (Backend de producto), con B y E
- **Etiquetas:** backend, infraestructura, datos

## Contexto y problema

`DEC-026` levanta la restricción "sin backend". El alcance exige autenticación, perfiles, sincronización de sesiones, rutinas, relación entrenador-cliente con chat 1:1, rankings, suscripciones y una función servidor que guarde la API key del `CoachAssistant`. La regla vigente es "cero costo mientras no haya ingresos": se necesita un proveedor con free tier utilizable comercialmente, sin tarjeta, y que el equipo (sin DevOps dedicado) pueda operar.

## Opciones consideradas

1. **Firebase** — Descartada: Cloud Functions y Storage exigen plan Blaze con tarjeta; modelo documental poco apto para consultas relacionales (rankings, relaciones entrenador-cliente).
2. **Appwrite Cloud** — Descartada: límite de 2 funciones por proyecto en el plan gratuito.
3. **Convex** — Segundo lugar: excelente DX, pero base documental y topes duros en el plan gratuito.
4. **PocketBase o Neon + servidor propio** — Descartados: carga de operación (hosting, backups, actualizaciones) que el equipo no tiene capacidad de asumir.
5. **Supabase** (elegida) — Postgres con RLS, Auth, Storage, Edge Functions, Realtime y `pg_cron` en un solo proyecto.

## Decisión

Adoptar **Supabase** en la región `us-east-1`. Plan Free mientras no haya ingresos: 500 MB de Postgres, 50 000 MAU, 1 GB de Storage, 500 000 invocaciones de Edge Functions, sin tarjeta y con uso comercial permitido. Pasar a Pro (25 USD/mes) cuando haya revenue.

### Patrones de esquema y seguridad

- **RLS en todas las tablas.** `subscriptions` se escribe únicamente desde el webhook de pagos con la clave `service-role`; una función SQL `is_premium(uid)` se usa dentro de las políticas RLS para gobernar el acceso premium.
- `coaching_relationships` gobierna qué entrenador ve qué datos de qué cliente; todas las políticas de coaching derivan de esa tabla.
- **Chat 1:1** en canales privados de Realtime con **Broadcast disparado desde trigger** (no desde el cliente).
- `set_logs` particionada por rango mensual con `pg_partman` (TimescaleDB está deprecado en PG17).
- **Rankings** como vistas materializadas refrescadas por `pg_cron` cada 5–15 min; la UI muestra "ranking a las HH:MM" en lugar de fingir tiempo real.
- `daily_user_stats` agregada de noche para no agotar los 500 MB con series crudas.
- El proyecto Free se pausa tras 7 días de inactividad: mitigar con un ping semanal (`pg_cron` o GitHub Action).

### Acceso desde el código

Solo `@fitnet/api-client` importa el SDK de Supabase y las definiciones bajo `supabase/`. `@fitnet/domain` define los puertos (repositorios) y no conoce al proveedor. Las Edge Functions validan entrada y salida con esquemas zod y tienen tests.

### Hosting de la PWA

Se mantiene Vercel (`DEC-019`) mientras no haya cobro. Vercel Hobby prohíbe uso comercial: al lanzar planes de pago se migra a Cloudflare Pages (gratis, comercial permitido) o a Vercel Pro. Requiere DEC propia en ese momento.

## Consecuencias

### Positivas

- Un solo proveedor cubre auth, datos, archivos, funciones y realtime; menos integraciones que mantener.
- Postgres relacional encaja con el modelo de dominio (`docs/DOMAIN.md`) y con rankings/agregados vía SQL.
- RLS + `is_premium(uid)` centralizan la autorización en la base de datos; el cliente no decide permisos.

### Negativas

- Residencia de datos en EE. UU. (`us-east-1`): datos de salud/actividad de usuarios guatemaltecos alojados fuera del país. **Pendiente:** aviso de privacidad explícito (ver `docs/DATA-GOVERNANCE.md`).
- Free tier con topes duros (500 MB, pausa por inactividad) que obligan a agregar y particionar desde el inicio.
- Dependencia de un proveedor; se mitiga con puertos en `domain` y adaptadores en `api-client`, pero una migración no sería gratuita.

## Referencias

- Supabase pricing y límites del plan Free: https://supabase.com/pricing
- `docs/DOMAIN.md`, `docs/DATA-GOVERNANCE.md`, `ARCHITECTURE.md`.
- `DEC-019` (Vercel), `DEC-026`, `DEC-030` (webhook de pagos), `DEC-033` (Edge Function `coach`).
