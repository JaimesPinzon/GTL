# Auth Smoke Test

Esta guía prueba el subsistema de autenticación y sesión del backend principal `0.0.2`.

## 1. Preparación

Verifica en `.env.local`:

```env
AUTH_USERS_STORE=supabase
AUTH_SESSION_STORE=file
AUTH_FRONTEND_ORIGINS=http://localhost:5173
AUTH_COOKIE_SAME_SITE=lax
AUTH_COOKIE_SECURE=false
```

Si ya aplicaste `supabase/auth_refresh_sessions.sql`, puedes usar:

```env
AUTH_SESSION_STORE=supabase
```

## 2. Levantar backend y frontend

Backend:

```powershell
cd "f:\Xhakerz\trade lab\GTL PRUEBAS\data-global-trade-lab V 0.0.2"
npm run dev
```

Frontend:

```powershell
cd "f:\Xhakerz\trade lab\GTL PRUEBAS\GlobalTradeLAb Prueba v0.0.5"
npm run dev
```

## 3. Flujo mínimo esperado en navegador

1. Abrir la app en `http://localhost:5173`.
2. Sin iniciar sesión, `GET /api/auth/restore` debe responder `401` si no hay cookie de refresh.
3. Registrar usuario nuevo.
4. Confirmar que `POST /api/auth/register` responde `201`.
5. Confirmar que se setean cookies de refresh y CSRF.
6. Recargar la app.
7. Confirmar que `GET /api/auth/restore` responde `200`.
8. Confirmar que el usuario sigue autenticado.
9. Entrar a configuración de seguridad.
10. Confirmar que aparecen sesiones activas.
11. Cambiar contraseña.
12. Confirmar que el usuario es expulsado y debe volver a iniciar sesión.
13. Iniciar sesión con la contraseña nueva.
14. Cerrar sesión.

## 4. Prueba HTTP con PowerShell

### 4.1 Bootstrap CSRF

```powershell
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$csrf = Invoke-WebRequest `
  -Uri "http://localhost:3000/api/auth/csrf" `
  -Method GET `
  -WebSession $session `
  -Headers @{ Origin = "http://localhost:5173" }

$csrfJson = $csrf.Content | ConvertFrom-Json
$csrfToken = $csrfJson.csrfToken
$csrfToken
```

Debe devolver un token y setear la cookie CSRF.

### 4.2 Register

```powershell
$registerBody = @{
  name = "Usuario Prueba"
  email = "prueba.auth@example.com"
  password = "Password123!"
  role = "student"
} | ConvertTo-Json

Invoke-WebRequest `
  -Uri "http://localhost:3000/api/auth/register" `
  -Method POST `
  -WebSession $session `
  -ContentType "application/json" `
  -Headers @{
    Origin = "http://localhost:5173"
    "X-CSRF-Token" = $csrfToken
  } `
  -Body $registerBody
```

Debe responder `201`.

### 4.3 Restore

```powershell
Invoke-WebRequest `
  -Uri "http://localhost:3000/api/auth/restore" `
  -Method GET `
  -WebSession $session `
  -Headers @{ Origin = "http://localhost:5173" }
```

Debe responder `200` y devolver `accessToken`.

### 4.4 Me

```powershell
$restore = Invoke-WebRequest `
  -Uri "http://localhost:3000/api/auth/restore" `
  -Method GET `
  -WebSession $session `
  -Headers @{ Origin = "http://localhost:5173" }

$restoreJson = $restore.Content | ConvertFrom-Json
$accessToken = $restoreJson.accessToken

Invoke-WebRequest `
  -Uri "http://localhost:3000/api/auth/me" `
  -Method GET `
  -WebSession $session `
  -Headers @{
    Origin = "http://localhost:5173"
    Authorization = "Bearer $accessToken"
  }
```

Debe responder `200` con el usuario autenticado.

### 4.5 Listar sesiones

```powershell
Invoke-WebRequest `
  -Uri "http://localhost:3000/api/auth/sessions" `
  -Method GET `
  -WebSession $session `
  -Headers @{
    Origin = "http://localhost:5173"
    Authorization = "Bearer $accessToken"
  }
```

Debe responder `200` con al menos una sesión.

### 4.6 Change password

Primero vuelve a pedir CSRF si el backend rotó sesión:

```powershell
$csrf = Invoke-WebRequest `
  -Uri "http://localhost:3000/api/auth/csrf" `
  -Method GET `
  -WebSession $session `
  -Headers @{ Origin = "http://localhost:5173" }

$csrfJson = $csrf.Content | ConvertFrom-Json
$csrfToken = $csrfJson.csrfToken
```

Luego:

```powershell
$changePasswordBody = @{
  currentPassword = "Password123!"
  newPassword = "Password456!"
} | ConvertTo-Json

Invoke-WebRequest `
  -Uri "http://localhost:3000/api/auth/change-password" `
  -Method POST `
  -WebSession $session `
  -ContentType "application/json" `
  -Headers @{
    Origin = "http://localhost:5173"
    Authorization = "Bearer $accessToken"
    "X-CSRF-Token" = $csrfToken
  } `
  -Body $changePasswordBody
```

Debe responder `200` y limpiar cookies. Luego `restore` debe volver a `401`.

### 4.7 Login con contraseña nueva

```powershell
$csrf = Invoke-WebRequest `
  -Uri "http://localhost:3000/api/auth/csrf" `
  -Method GET `
  -WebSession $session `
  -Headers @{ Origin = "http://localhost:5173" }

$csrfJson = $csrf.Content | ConvertFrom-Json
$csrfToken = $csrfJson.csrfToken

$loginBody = @{
  email = "prueba.auth@example.com"
  password = "Password456!"
} | ConvertTo-Json

Invoke-WebRequest `
  -Uri "http://localhost:3000/api/auth/login" `
  -Method POST `
  -WebSession $session `
  -ContentType "application/json" `
  -Headers @{
    Origin = "http://localhost:5173"
    "X-CSRF-Token" = $csrfToken
  } `
  -Body $loginBody
```

Debe responder `200`.

### 4.8 Logout

```powershell
$csrf = Invoke-WebRequest `
  -Uri "http://localhost:3000/api/auth/csrf" `
  -Method GET `
  -WebSession $session `
  -Headers @{ Origin = "http://localhost:5173" }

$csrfJson = $csrf.Content | ConvertFrom-Json
$csrfToken = $csrfJson.csrfToken

Invoke-WebRequest `
  -Uri "http://localhost:3000/api/auth/logout" `
  -Method POST `
  -WebSession $session `
  -Headers @{
    Origin = "http://localhost:5173"
    "X-CSRF-Token" = $csrfToken
  }
```

Debe responder `200`. Después `GET /api/auth/restore` debe responder `401`.

## 5. Resultado esperado

El flujo correcto queda así:

- `register` o `login` entrega sesión válida
- `restore` restaura mientras exista cookie de refresh válida
- `me` responde con bearer access token
- `sessions` lista sesiones activas del usuario
- `change-password` invalida sesiones previas
- `logout` limpia cookies y deja `restore` en `401`

## 6. Siguiente paso de producción

Para cerrar la migración de sesiones:

1. Ejecutar `supabase/auth_refresh_sessions.sql` en Supabase.
2. Cambiar `AUTH_SESSION_STORE=supabase`.
3. Repetir esta guía completa.
