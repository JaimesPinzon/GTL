0.0.0

* Instalacion de Librerias
* Se arrastro como base conceptual la migracion del historico de mercado desde snapshots simples hacia velas OHLC reales con persistencia en market\_candles.
* Se consolido la idea de historico hibrido con proveedor de precio actual y proveedor de historico, incluyendo cache y backfill automatico por simbolo e intervalo.
* Se incorporo la linea de trabajo de salas academicas y clases multiples que luego termino materializandose en rooms, room\_members, student\_sim\_accounts y actividades.

0.0.1

* Se ajustaron las rutas de mercado para responder de forma degradada cuando falle la consulta a proveedores externos o la persistencia, evitando errores 500 innecesarios hacia el frontend.
* Se actualizo la salida de los endpoints de cotizaciones para que la plataforma pueda seguir cargando aunque algun simbolo no tenga datos disponibles en ese momento.
* Se mejoro la tolerancia a fallos en las rutas de quote y quotes para reducir caidas visibles durante la carga inicial del dashboard.
* Se modularizo la logica de mercado sacando responsabilidades de las rutas hacia utilidades compartidas para timeframes, OHLC, indicadores y cache.
* Se creo una capa compartida de cache backend con TTL y politica LRU reutilizable por history y ohlc.
* Se implemento un endpoint OHLC dedicado para que el frontend reciba velas listas para render sin reagregar todo el historico localmente.
* Se implemento un endpoint de indicadores para EMA y MACD, moviendo ese calculo fuera del frontend.
* Se reforzo la ruta de history con backfill controlado, cache de respuesta y estrategias de degradacion para seguir sirviendo datos aun si Yahoo o Twelve Data fallan.
* Se agrego persistencia de drawings en backend con endpoint dedicado por usuario, simbolo y temporalidad.
* Se organizo el schema SQL para que sea portable entre bases, incluyendo funcion set\_updated\_at, tabla chart\_drawings, indices, trigger y policies en orden correcto.
* Se optimizaron las cotizaciones batch de Twelve Data para consultar varios activos en una sola llamada y persistir los resultados de forma agrupada.
* Se dejo una ruta separada de refresco automatico de quotes y un vercel.json preparado para scheduler backend.
* Se unifico la lista de simbolos rastreados para los procesos de refresco y backfill donde correspondia.
* Se mejoro la mezcla entre historico de Yahoo y datos recientes de Twelve Data para que history y ohlc no dependan solo del proveedor atrasado.
* Se cambio la estrategia de completado reciente para usar velas reales de time\_series de Twelve Data en lugar de interpolacion inventada.
* Se adapto ohlc y history para montar sobre el historico almacenado una cola viva real proveniente de Twelve Data en temporalidades intradia.
* Se mantuvo quote\_history como respaldo cuando no haya velas suficientes o falle la consulta principal, evitando dejar al frontend sin datos.
* Se tomo como referencia la nueva estructura activa bajo BACKEND/data-global-trade-lab V 0.01 para revisar y documentar el comportamiento integrado con el frontend.
* Se dejo registrado que el frontend ahora maneja de forma mas robusta los fallos de red y autenticacion, por lo que la integracion con este backend puede degradarse visualmente sin romper toda la interfaz cuando existan timeouts, desconexion del usuario o fallos de proveedor.
* Se mantuvo como contexto operativo la version 0.0.1 del backend mientras se corregian en frontend los flujos de login, logout, fallback de conexion y recuperacion de sesion.
* Se actualizo la documentacion operativa para trabajar sobre la nueva ruta activa BACKEND/data-global-trade-lab V 0.01 dentro del arbol reorganizado de carpetas.
* Integracion con el nuevo modelo de studies del frontend, que sigue consumiendo EMA y MACD desde los endpoints de indicadores cuando hay datos backend disponibles.
* Se registro como contexto de integracion que el frontend ahora separa serie principal de precio, studies overlay y pane independiente, por lo que este backend queda alineado conceptualmente como proveedor de datafeed e indicadores para esa arquitectura.
* Se registro como contexto de integracion que el frontend sigue ampliando el apartado Configuracion de la Cuenta con navegacion interna por secciones, por lo que el backend queda pendiente de futuras conexiones para perfil, seguridad, preferencias, notificaciones, salas, membresia, privacidad, accesibilidad y soporte.
* Se dejo documentado que la vista de Apariencia en frontend ya funciona como seccion activa dentro de Configuracion y que los demas apartados quedaron creados como base visual lista para enlazar con endpoints backend mas adelante.0.0.1
* Se consolido en la ruta activa BACKEND/data-global-trade-lab V 0.01 el trabajo reciente del sistema academico de salas que venia evolucionando desde los ciclos previos referenciados en las versiones 0.0.0 y 0.0.3 del proyecto anterior.
* Se agrego y estabilizo el endpoint backend de creacion de salas en src/app/api/rooms/create/route.ts para que el alta de salas ya no dependa de inserciones directas desde el navegador.
* Se ajusto el endpoint de creacion de salas para responder correctamente a preflight y CORS desde el frontend Vite, incluyendo soporte OPTIONS y headers de autorizacion y contenido.
* Se elimino el cuello de botella de validacion remota que estaba colgando la creacion de salas, reemplazando la verificacion por una comprobacion directa del ownerUserId contra profiles con service role y validacion de rol teacher.
* Se mantuvo y documento la estructura actual de tablas rooms, room\_members, student\_sim\_accounts, balance\_adjustments, activities, activity\_posts, activity\_submissions y activity\_grades como base del sistema academico por sala.
* Se limpio el schema para retirar del perfil global los campos heredados de clase class\_name, class\_description, class\_code y joined\_class\_code, dejando la logica academica concentrada en rooms y sus relaciones.
* Se reordeno el schema para poder eliminar columnas antiguas sin romper policies dependientes, documentando la necesidad de bajar primero policies legadas y luego aplicar drop column.
* Se actualizaron las policies de positions y transactions para depender de room\_members en lugar del modelo viejo basado en class\_code.
* Se mantuvo balance e initial\_balance en profiles como soporte del portafolio global del docente, mientras el resto del sistema academico se movio al modelo por sala.
* Se trazaron manualmente pruebas de creacion de salas y membresias directamente en Supabase para verificar que el backend estaba persistiendo datos correctamente aun cuando el frontend no los reflejaba.
* Se documento que este bloque de backend corresponde a la consolidacion en la ruta nueva de cambios cuya linea funcional ya se habia trabajado conceptualmente en los arboles anteriores 0.0.0 y 0.0.3.

0.0.2 

* Se mantuvo la integracion del frontend con las rutas backend de mercado como base activa para las vistas publicas y la experiencia interna del dashboard.
* Se tomo como fuente de verdad del frontend autenticado la data de activos servida por el contexto y sus utilidades conectadas al backend de mercado.
* No se introdujeron cambios funcionales nuevos en la carpeta backend durante este ciclo; el trabajo de esta iteracion se concentro principalmente en frontend, rutas publicas, landing y presentacion visual.
* Se deja registrado que la version backend 0.0.2 acompana la nueva estructura publica del frontend 0.0.5 sin alterar contratos existentes de quotes, history, ohlc, indicadores ni salas.
* Se integro un subsistema interno de autenticacion y sesion dentro del backend principal, modularizando config, validadores, errores, repositorios, cookies, tokens, sesiones y servicio central de auth.
* Se implementaron los endpoints csrf, restore, me, login, register, refresh, logout, logout-all, change-password, sessions y revocacion de sesion por dispositivo dentro de la API del backend principal.
* Se establecio un modelo hibrido con Supabase como base de identidad y datos de usuario, y con access token corto mas refresh token en cookie HttpOnly administrados por el backend.
* Se agrego persistencia de refresh sessions con driver configurable, soporte para Supabase y fallback transicional a archivo mientras no exista la tabla remota.
* Se preparo y conecto la tabla auth_refresh_sessions para mover la persistencia de sesiones hacia Supabase.
* Se incorporo validacion de origen permitido, control de CSRF, restauracion segura de sesion, cierre de sesion global y rotacion controlada de refresh token.
* Se implemento cambio de contrasena con invalidacion de sesiones activas del usuario.
* Se ajusto restore para reutilizar la sesion vigente del dispositivo y evitar la creacion de nuevas sesiones por cada recarga del navegador.
* Se endurecio el almacenamiento local de auth para tolerar JSON corrupto, escrituras parciales y sesiones huerfanas sin provocar errores 500.
* Se excluyeron las rutas /api del middleware SSR global para evitar fallos transversales sobre auth, mercado, cookies y CORS.
* Se ajustaron las rutas de mercado para ejecutarse en runtime nodejs de forma explicita y estabilizar su comportamiento con utilidades server-only y service role.
* Se centralizo un cache backend para quotes de TwelveData con deduplicacion de requests concurrentes y una ventana de reutilizacion de 108 segundos por lote de simbolos.
* Se adapto quote y quotes para reutilizar la misma consulta batch de TwelveData durante 1.8 minutos y reducir el consumo diario de creditos del proveedor.
* Se agrego un catalogo backend de zonas horarias para preferencias y se expuso mediante un endpoint dedicado para consumo del frontend.
* Se corrigio la normalizacion de fechas de TwelveData en series intradia para tratarlas como UTC antes de construir velas OHLC.
* Se ajusto la integracion de time_series para solicitar datos en UTC y mantener consistencia entre backend, almacenamiento y eje temporal del grafico.
* Se corrigio la ruta de quotes para mantener la carga del dashboard y evitar fallos por parametros no soportados en cotizaciones.
* Se agrego el endpoint autenticado `/api/rooms/list` para devolver al frontend las salas accesibles del usuario desde el backend principal.
* Se centralizo en backend la resolucion de salas docentes y estudiantiles para reducir dependencia de lecturas directas del cliente sobre Supabase.
* Se corrigio la autenticacion de `/api/rooms/list` para validar la sesion con el flujo propio de auth del backend en lugar de tratar el token del frontend como sesion directa de Supabase.
* Se ajusto la resolucion de salas docentes para contemplar ownership y membresias con roles `teacher` y `monitor`.
* Se corrigio la configuracion de CORS del modulo de autenticacion para aceptar origenes locales de desarrollo del frontend y habilitar restore de sesion y CSRF desde `localhost:5173`.
* Se agregaron nuevos simbolos al lote backend de seguimiento de mercado utilizado por las cotizaciones batch.
* Se corrigio la seleccion de ETFs de referencia incorporando `DIA` y `SPY` como simbolos reales de mercado dentro del seguimiento backend.
* Se agrego mapeo especifico de simbolos para Yahoo Finance en indices amplios, normalizando `DJI` hacia `^DJI` y `SPX` hacia `^GSPC` para consultas historicas.
* Se corrigio la persistencia de velas en `market_candles` haciendo que las rutas de historial y OHLC esperen el refresh de Yahoo Finance antes de responder cuando la data almacenada este desactualizada.
* Se elimino el refresh en segundo plano para velas historicas cuando existia riesgo de responder sin guardar previamente la informacion actualizada en Supabase.

20260506

* Cambio: Se unifico el modelo de velas en una tabla particionada `public.candles` con insercion exclusiva desde backend hacia la tabla padre.
* Agregacion: Se incorporo en `schema.sql` la creacion automatica de particiones mensuales desde 2000-01 hasta 2026-12, incluyendo particion `DEFAULT` y funcion programada con `pg_cron` para generar meses futuros.
* Agregacion: Se incluyeron scripts SQL de verificacion y mantenimiento para validar particiones activas, estado de `cron.job` y control de filas en `candles_default`.
* Correccion: Se ajustaron lecturas y rutas de mercado para consumir `public.candles` como fuente principal y mantener fallback seguro con datos recientes de TwelveData.
* Agregacion: Se creo y ejecuto un script de carga para poblar OHLC recientes en `public.candles` con datos de TwelveData para temporalidades intradia y diaria.
* Eliminacion: Se retiro del flujo operativo la dependencia de tablas legacy por temporalidad (`candles_1m`, `candles_5m`, `candles_15m`, `candles_1h`, `candles_1d`, `candles_1wk`, `candles_1mo`, `candles_1y`) en endpoints y procesos de lectura.

20261305

* Cambio: Se consolido `public.candles` como fuente canonica de velas para dashboard, historia y OHLC desde backend.
* Agregacion: Se dejo activa en `schema.sql` la preparacion de particiones mensuales historicas (2000-01 a 2026-12) mas generacion futura automatica por `pg_cron`.
* Agregacion: Se formalizo la verificacion operativa de particiones con control de `candles_default`, validacion de `cron.job` y chequeo de rangos por mes.
* Correccion: Se estabilizo la integracion de carga de velas recientes para que el backend complete huecos con TwelveData sin romper la lectura principal.
* Eliminacion: Se retiro el uso directo de tablas por timeframe en las rutas de mercado, quedando un acceso unificado sobre la tabla particionada padre.

20261305

* Cambio: Se habilito en backend el endpoint `GET /api/health` para validacion operativa del servicio desplegado en Render.
* Agregacion: Se agrego el archivo `src/app/api/health/route.ts` con respuesta JSON de estado (`ok`, `service`, `timestamp`).
* Correccion: Se verifico compilacion de backend con `npm run build` incluyendo la nueva ruta `/api/health`.
* Eliminacion: No se realizaron eliminaciones en backend durante este cierre.

20261305

* Cambio: Se unifico la lectura de velas base con deduplicacion por `open_time` y prioridad del simbolo principal cuando existen variantes (`BTCUSD` y `BTC/USD`).
* Correccion: Se corrigio el corte de historico en backend eliminando duplicados por timestamp antes del saneamiento de continuidad en velas intradia.
* Correccion: Se estabilizo la carga de OHLC para evitar respuestas incompletas en extremos recientes y antiguos durante la navegacion del grafico.
* Cambio: Se ajusto la politica de frescura de mercado a 5 minutos para las validaciones de backfill y refresco de velas.
* Agregacion: Se protegieron las rutas `GET` y `POST` de `/api/market/backfill/base-candles` con validacion opcional de `CRON_SECRET` por header `Authorization`.
* Agregacion: Se incorporo en `schema.sql` la extension `pg_net`, la funcion `public.trigger_market_base_candles_backfill()` y el job `market-base-candles-backfill-5min` en `pg_cron`.
* Agregacion: Se habilito configuracion por base de datos para cron de backfill con `app.settings.market_backend_url` y `app.settings.market_cron_secret`.
* Eliminacion: Se retiro la ruta de refresco no autenticada para backfill periodico de velas base, quedando centralizado en ejecucion programada segura.

20261305

* Cambio: Se habilito en backend el endpoint `GET /api/health` para validacion operativa del servicio desplegado en Render.
* Agregacion: Se agrego el archivo `src/app/api/health/route.ts` con respuesta JSON de estado (`ok`, `service`, `timestamp`).
* Correccion: Se verifico compilacion de backend con `npm run build` incluyendo la nueva ruta `/api/health`.
* Eliminacion: No se realizaron eliminaciones en backend durante este cierre.

20261305

* Cambio: Se implemento el puente de autenticacion OAuth hacia sesion propia del backend mediante `POST /api/auth/oauth-login` dentro de `/api/auth/[action]`.
* Agregacion: Se agregaron `parseOauthLoginBody` y `loginUserWithSupabaseAccessToken` para validar `accessToken`, resolver usuario de Supabase y emitir `refreshToken` y `csrfToken` del sistema propio.
* Agregacion: Se incorporo `getOrCreateUserFromSupabaseAccessToken` para crear o actualizar el perfil local cuando el usuario llega desde Google OAuth y aun no existe registro operativo.
* Correccion: Se normalizo la emision de cookies de sesion backend despues de OAuth para que `restore` y `refresh` funcionen con el mismo contrato de autenticacion por correo y password.
* Eliminacion: No se realizaron eliminaciones de rutas o modulos en backend durante este cierre.
