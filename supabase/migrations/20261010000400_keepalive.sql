-- Función de ping para el workflow semanal que evita la pausa del plan Free (DEC-029,
-- DEC-035). anon no tiene acceso a ninguna tabla (0100), así que el ping no puede leer
-- datos; llama a esta función, que solo devuelve la hora del servidor y toca la base.
create function public.keepalive() returns timestamptz
language sql stable set search_path = '' as $$ select now() $$;

revoke all on function public.keepalive() from public;
grant execute on function public.keepalive() to anon, authenticated;
