# Dominio de autenticacion en produccion

La arquitectura objetivo es:

- Frontend: `https://globaltradelab.site`
- Backend: `https://api.globaltradelab.site`
- Origen fisico del backend: `https://gtl-e6j4.onrender.com`

## Orden de activacion

1. En Render, agregar `api.globaltradelab.site` como dominio personalizado del servicio `gtl-e6j4` y copiar el destino DNS que Render indique.
2. En Cloudflare, crear el registro CNAME `api` con ese destino. Durante la validacion inicial usar el modo DNS only si Render lo solicita; activar el proxy solo despues de que Render muestre el certificado como valido.
3. Esperar a que `https://api.globaltradelab.site/api/auth/csrf` responda `200` y entregue `Set-Cookie` por HTTPS.
4. Configurar en Render:
   - `AUTH_FRONTEND_ORIGINS=https://globaltradelab.site,https://gtl1-f32d5.web.app,https://gtl1-f32d5.firebaseapp.com`
   - `AUTH_COOKIE_DOMAIN=` (vacio; cookies host-only)
   - `AUTH_COOKIE_SAME_SITE=lax`
   - `AUTH_COOKIE_SECURE=true`
   - `AUTH_SESSION_STORE=supabase`
5. Desplegar el frontend. `.env.production` ya dirige API, auth y mercado al subdominio propio.
6. Ejecutar `npm run verify:auth-production` desde el proyecto frontend.
7. Validar login, recarga, expiracion del access token, refresh, logout y dos pestanas simultaneas.

## Validacion de cabeceras

`GET /api/auth/csrf` debe devolver:

- `Access-Control-Allow-Origin: https://globaltradelab.site`
- `Access-Control-Allow-Credentials: true`
- una cookie `gtl_csrf` con `Secure`

El navegador conserva las cookies. El frontend conserva solamente el `csrfToken` retornado en JSON y lo envia en `X-CSRF-Token`; no intenta leer la cookie.

## Rollback

Si el dominio personalizado falla antes de desplegar el frontend, no hay impacto. Si falla despues, restaurar temporalmente las tres variables `VITE_*_BACKEND_URL` a `https://gtl-e6j4.onrender.com`, recompilar y desplegar. No se debe desactivar la validacion CSRF ni exponer el refresh token a JavaScript.
