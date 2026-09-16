# Contrato del backend para dibujos del gráfico

El frontend usa el endpoint autenticado existente `/api/market/drawings`. El token de Supabase se envía como `Authorization: Bearer <token>` y el backend debe obtener `user_id` exclusivamente del token validado.

## Operaciones

- `GET /api/market/drawings?symbol=BTCUSD&timeframe=all` devuelve `{ ok: true, objects: [] }`.
- `PUT /api/market/drawings` recibe `{ symbol, timeframe: "all", objects }` y sincroniza la colección del usuario y símbolo.
- `DELETE /api/market/drawings?symbol=BTCUSD&timeframe=all` realiza borrado lógico de la colección.

`timeframe=all` identifica la colección completa del símbolo. Cada objeto decide su visibilidad con `timeframeScope.mode` y `timeframeScope.timeframe`; de esta forma un cambio de temporalidad no duplica objetos ni obliga al navegador a combinar múltiples respuestas.

## Reglas mínimas

- Validar el JWT de Supabase antes de consultar o mutar datos.
- No aceptar un `user_id` enviado por el cliente.
- Ejecutar la sincronización masiva dentro de una transacción.
- Incrementar `version` y rechazar escrituras obsoletas cuando el backend incorpore control de conflictos.
- Aplicar soft delete mediante `deleted_at`.
- Mantener RLS activa como defensa adicional, incluso si el endpoint usa credenciales de servidor.

La definición inicial de tabla, índices, permisos explícitos y políticas RLS está en `docs/sql/chart_drawings.sql`.

