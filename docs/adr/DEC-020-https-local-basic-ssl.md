# DEC-020 · HTTPS en desarrollo local: @vitejs/plugin-basic-ssl

- **Estado:** Aceptada
- **Fecha:** 2026-05-15
- **Decisores:** Equipo MVP IA26
- **Etiquetas:** devex, deploy

## Contexto y problema

La API `getUserMedia` con `facingMode: 'environment'` (cámara trasera) exige un contexto seguro (HTTPS o `localhost`). Al exponer el dev server en la red local con `host: true` para probar desde el celular, `localhost` ya no aplica — el celular accede por IP (ej. `192.168.x.x`), que es HTTP sin TLS. Cierra la decisión pendiente de sección 5.4 (ngrok vs. deploy continuo).

## Opciones consideradas

1. **ngrok** — tunnel HTTPS gratuito pero requiere instalar la herramienta, autenticarse, y la URL cambia en cada sesión.
2. **Usar directamente la URL de Vercel como entorno de pruebas** — implica hacer push por cada cambio, ciclo muy lento.
3. **Certificado local autofirmado con mkcert** — requiere instalar la CA en cada celular de prueba.
4. **`@vitejs/plugin-basic-ssl`** (elegida) — genera un certificado autofirmado en memoria, el navegador del celular muestra la advertencia "sitio no seguro" pero se puede ignorar una vez para desarrollo.

## Decisión

`@vitejs/plugin-basic-ssl`. No requiere instalación externa, no tiene tokens que expiren, la URL es siempre la IP local del equipo, y el certificado autofirmado es aceptable para desarrollo (el deploy de producción en Vercel tiene TLS real). La advertencia del navegador se ignora una vez y no vuelve a aparecer en la misma sesión.

## Consecuencias

### Positivas

- No requiere instalación externa ni tokens que expiren.
- La URL es siempre la IP local del equipo.
- Permite probar `getUserMedia` con `facingMode: 'environment'` desde el celular en la red local.
- La advertencia del navegador se ignora una vez y no vuelve a aparecer en la misma sesión.

### Negativas

- iOS Safari rechaza certificados autofirmados con más severidad que Android Chrome. Si se necesita probar en iOS, la alternativa es usar la URL de preview de Vercel.
- El certificado autofirmado solo es aceptable para desarrollo; el TLS real lo aporta el deploy de producción en Vercel.

## Referencias

- `DEC-019` (deploy en Vercel, cuya URL de preview es la alternativa para iOS).
- Anteproyecto, sección 5.4 (ngrok vs. deploy continuo).
- `vite.config.ts`
