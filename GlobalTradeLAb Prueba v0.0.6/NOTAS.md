0.0.1

* Se realizaron cambios asociados al sidebar dezplegable
* Creacion del Apartado de Cuenta, Cuenta con algunos errores por soluccionar como el ancho
* Se realizo Ajuste de Margenes dado el espacio sobrante al iingresar el sidebar dezplegable, aunque deseablemente fueran mas estrechas

0.0.2

* Creacion de los apartados de traduccion, falta conectar a una API de google y crear los espacios para automatizar
* Se creo la data de los paises

0.0.3

* Se incorporo como continuidad todo el redise?o visual del dashboard, sidebar, action bars, paneles laterales, selector de temporalidad y workspace tipo terminal que se habia refinado en esa version.
* Se heredaron las bases funcionales del modulo Clases: creacion de clases por docente, actividades, entregas, foros, ranking, auditoria, detalle de estudiante y vista por sala.
* Se tomo como referencia la limpieza del flujo de autenticacion, configuracion de cuenta, settings, recuperacion de sesion y tolerancia a fallos que se habia venido ajustando en esa etapa.

0.0.4

* Se reorganizo la configuracion para concentrar ahi la informacion que antes estaba distribuida en cuenta y otros apartados.
* Se implemento Perfil con edicion completa, vista previa de avatar, alias, nombre de usuario unico, nombre, apellidos, fecha de nacimiento, correo, pais, direccion, telefono, ciudad o region, genero opcional, biografia, experiencia en trading, documento, ID, fecha de registro, ultimo acceso y acciones de editar, guardar y cancelar.
* Se retiro institucion y eliminar cuenta del apartado Perfil y se movio la informacion academica a una seccion propia.
* Se implemento Cuenta academica o institucional con institucion vinculada, codigo estudiantil, carrera, semestre o nivel, docente principal, salas inscritas, historial de salas, rol dentro del sistema, certificados y progreso general.
* Se implemento Seguridad con cambio de contrasena, indicador de fortaleza, reglas visibles, fecha de ultimo cambio, verificacion en dos pasos por correo, autenticador y SMS preparado, sesiones activas, historial de inicios, cierre de sesion en todos los dispositivos, alertas por nuevo dispositivo, recuperacion de cuenta, desactivacion temporal y eliminacion con doble confirmacion.
* Se implemento Notificaciones con configuracion por correo, dentro de la plataforma, sonidos, avisos emergentes, resumen diario o semanal y separacion por categorias academicas, financieras, administrativas y de seguridad.
* Se implemento Preferencias generales con idioma, zona horaria, formato de fecha, formato de hora, formato numerico, moneda preferida, pagina de inicio predeterminada, sala activa por defecto, vista por defecto del dashboard, cantidad de elementos por pagina en tablas y control funcional de sonidos.
* Se implemento Apariencia como seccion propia con modo claro, oscuro y automatico, color principal y secundario, estilo de bordes, tamano de fuente, tamano de componentes, estilo de dashboard, control de widgets visibles y orden del inicio.
* Se implemento Membresia o Plan con plan actual, fechas, beneficios, limitaciones, consumo frente al limite, gestionar plan, historial de pagos, facturacion, metodo de pago, cancelar, renovar y comparacion entre planes.
* Se implemento Salas con listado de salas, rol por sala, entrar por codigo, salir, historial, estado activa o cerrada o archivada, y funciones para docentes como crear, administrar, copiar codigo e invitar estudiantes.
* Se implemento Soporte y ayuda con centro de ayuda, preguntas frecuentes, contacto de soporte, reporte de errores, sugerencias, version actual, terminos, politica de privacidad y creditos.
* Se implemento Accesibilidad con contraste alto, reducir animaciones, navegacion por teclado, soporte para lector de pantalla, colores aptos para daltonismo, subrayado de enlaces e indicadores visuales mas marcados.
* Se implemento Privacidad y control de datos con visibilidad del perfil, controles sobre nombre, alias, portafolio, rendimiento, participaciones en foros, rankings, compartir estadisticas, descarga de datos, solicitud de eliminacion y consentimiento de uso de datos.
* Se elimino el apartado independiente de Cuenta y se redirigio su acceso hacia Configuracion para evitar duplicidad.
* Se corrigio una pantalla blanca causada por una referencia de icono faltante en SettingsPage.
* Se ajusto la integracion local de mercado para evitar bloqueo por CORS usando rutas relativas y proxy de Vite hacia el backend.
* Se mejoro el selector de activos del dashboard con buscador, filtros superiores por tipo, tabla estilo Mercados, scroll horizontal para chips y scrollbar vertical siempre visible con estilo del dashboard.
* Se replico el mismo lenguaje visual en la pagina Mercados como vista completa en lugar de modal.
* Se agregaron divisiones y descripciones para tipos de activos y luego se refino la presentacion para que quedara alineada con el estilo de la plataforma.
* Se dejo el wordmark GlobalTradeLab fijo respecto al color principal del sistema para que conserve su identidad visual aun cuando el usuario cambie la apariencia.
* Se refactorizo PriceChart para separar responsabilidades en hooks y modulos, incluyendo datos del chart, OHLC, indicadores, overlay de precio, drawings, chart principal, chart MACD y carpeta dedicada de Indicators.
* Se unifico el flujo de datos del chart bajo un pipeline explicito de rawData, normalizedData, repairedData y renderedData para que header, hover, series e indicadores partan de la misma fuente de verdad.
* Se extrajo la carga y cache OHLC a servicios reutilizables con store global, LRU real, TTL por temporalidad, deduplicacion de requests y scope por sesion.
* Se normalizo el manejo de timestamps con una funcion unica a epoch en segundos y se corrigio el formateo horario del chart segun la zona del usuario o la configurada.
* Se mejoro el zoom inicial del chart para enfocar el ultimo tramo con un encuadre moderado y padding visual consistente.
* Se estabilizo la creacion del chart para evitar recreaciones innecesarias, separando applyOptions y actualizacion de series del montaje principal.
* Se corrigio el manejo de series para reutilizarlas cuando solo cambia la data, reduciendo recreaciones de EMA, MACD y serie principal.
* Se desuscribieron explicitamente los listeners de sincronizacion del MACD y se hizo mas robusta la sincronizacion entre el chart principal y el panel inferior.
* Se estabilizaron handlers sensibles con refs para evitar stale closures en crosshair, overlay de precio, drawings y eventos de alta frecuencia.
* Se modelo el overlay de precio como una pequena maquina de estados y se unifico el sistema de eventos sobre pointer events para reducir bugs de hover y cursor.
* Se optimizo el crosshair con requestAnimationFrame para bajar el costo de hoveredCandle y hoveredPriceMarker en movimiento continuo.
* Se rediseo la campanita de acciones sobre precio con overlay estable, menu contextual, cierre controlado, alineacion vertical, posicionamiento dentro del chart y correcciones visuales del cursor.
* Se corrigio la visualizacion del label temporal movil del chart para usar siempre el formato largo tipo sab 21 Mar '26 00:13.
* Se agrego persistencia y mejor manejo del historial reciente para que el chart refleje cambios de la base de datos sin recargar la pagina.
* Se mejoro la fusion entre OHLC historico y datos recientes para que el chart pueda mostrar la cola viva sin depender de refresco manual.
* Se ajusto TradingContext para tomar timestamps reales del backend, mantener quotes periodicos y separar el ritmo de refresco entre OHLC y datos vivos.
* Se dejo el polling del precio en tiempo real de Twelve Data en 1.8 minutos y la revalidacion del OHLC del chart por temporalidad con foco en 1 minuto para 1M.
* Se fortalecio el fullscreen del chart para que no remonte el workspace, oculte paneles secundarios, oculte sidebar principal y aproveche mejor el alto disponible.
* Se ajusto el layout del MACD para vivir como panel inferior real, reduciendo la altura del chart principal sin mover su borde superior.
* Se agregaron controles para mostrar u ocultar las barras laterales de herramientas izquierda y derecha desde la action bar, con alineacion visual ajustada a las rails.
* Se reubico la barra izquierda del chart para reducir sacudidas visuales y se estabilizo el comportamiento general del workspace al mostrar u ocultar paneles.
* Se restauro la scrollbar del dashboard con estilo fino alineado a la paleta visual y se hicieron ajustes visuales en la action bar para mantener separadores y botones alineados.
* Se reviso el flujo de inicio de sesion sobre la nueva estructura de carpetas bajo FRONTED y se fortalecio la configuracion de variables de entorno para Supabase limpiando espacios, comillas y validando URLs.
* Se mejoro el manejo de errores de autenticacion para detectar fallos de red tipo Failed to fetch, timeouts y problemas de conectividad con Supabase, mostrando mensajes mas claros al usuario.
* Se ajusto la inicializacion de autenticacion para tolerar errores recuperables de red o locks de Supabase, evitando que la plataforma se rompa al cargar con sesiones danadas o refrescos fallidos.
* Se agrego un fallback visual no bloqueante de red mediante banner global con mensaje de error de conexion o falta de internet y boton de reintento.
* Se fortalecio la recuperacion de sesion limpiando storage local y sessionStorage cuando se detectan errores recuperables de autenticacion o estados inconsistentes de sesion.
* Se corrigio una caida completa del dashboard en PriceChart causada por una referencia faltante a normalizeTimeToSeconds, enlazandola con la normalizacion real de timestamps del modulo.
* Se ajusto el cierre de sesion para limpiar estado local, storage persistido, simulacion activa, sala activa y cache de autenticacion incluso cuando Supabase o la red no responden correctamente.
* Se agrego una proteccion temporal para evitar que el listener de autenticacion rehidrate la sesion mientras se esta ejecutando el proceso de logout.
* Se cambio el logout de la sidebar para cerrar visualmente el panel, disparar la limpieza local de sesion y navegar al login sin depender de la respuesta remota del signOut.
* Se dejaron varias compilaciones de verificacion exitosas durante el proceso para confirmar que los cambios de autenticacion, fallback de red y chart no rompieran la build.
* Se actualizo el registro de trabajo para operar sobre la nueva ruta activa FRONTED/GlobalTradeLAb Prueba v0.0.4 dentro de la reorganizacion de carpetas del proyecto.
* Se reestructuro el PriceChart principal para acercarlo a la arquitectura mental de TradingView, separando serie principal de precio, studies y renderizado en capas mas claras.
* Se agrego un registry formal de studies para EMA y MACD con metadatos, inputs, pane de destino, plots y salida normalizada.
* Se adapto useIndicatorsData para construir studyInstances, overlayStudies y paneStudies, dejando de tratar EMA y MACD solo como casos especiales acoplados al render.
* Se actualizo el chart principal para renderizar indicadores overlay desde una coleccion de plots administrados por estudio, reutilizando series y limpiando las que dejan de estar activas.
* Se actualizo el panel inferior del MACD para consumir un paneStudy explicito y renderizar sus plots de forma generica, manteniendo la sincronizacion horizontal con el chart principal.
* Se mantuvo la compatibilidad con lightweight-charts como motor visual, dejando documentado que aqui se emula la logica de studies de TradingView y no el motor nativo de Charting Library.
* Se verifico la integridad del frontend despues de esta reestructuracion con una compilacion exitosa mediante npm run build.
* Se actualizo el trabajo para operar bajo la nueva ruta activa FRONTED/GlobalTradeLAb Prueba v0.0.4 dentro de la reorganizacion reciente de carpetas.
* Se inicio el desarrollo del apartado Configuracion de la Cuenta creando una barra fija propia inspirada en la barra del dashboard para funcionar como navegador interno de secciones.
* Se construyo un componente reutilizable de barra para configuracion y luego se ajusto varias veces su estructura para acercarla al comportamiento visual de la action bar del dashboard.
* Se elimino el texto fijo Configuracion dentro de la barra superior de settings para dejar solo la navegacion por botones.
* Se implementaron los botones Perfil, Cuenta, Seguridad, Preferencias, Apariencia, Notificaciones, Salas, Membresia, Privacidad, Accesibilidad y Soporte como navegacion interna del modulo.
* Se conecto la navegacion para que cada boton cambie el contenido central de la pagina en lugar de dejar una vista estatica.
* Se dejo Apariencia como apartado funcional visible desde su boton con el control del tema claro y oscuro y el bloque base de preferencias visuales del grafico.
* Se generaron apartados base para Perfil, Cuenta, Seguridad, Preferencias, Notificaciones, Salas, Membresia, Privacidad, Accesibilidad y Soporte, listos para enlazar funcionalidad real mas adelante.
* Se ajusto Dashboard para permitir que ciertas vistas, como Configuracion, usen un contenedor principal full width sin quedar limitadas por el maximo ancho general del resto de paginas.
* Se hizo la integracion de la barra de Configuracion con el tema actual para que pueda responder a modo claro u oscuro en lugar de quedar fija en negro.
* Se corrigio una caida de compilacion en SettingsPage causada por un icono no exportado por lucide-react.
* Se ejecutaron varias compilaciones de verificacion mediante npm run build para confirmar que la nueva navegacion de settings y sus refactors no rompieran la build.
* Se consolido el trabajo de salas academicas en la nueva ruta activa FRONTED/GlobalTradeLAb Prueba v0.0.4, tomando como referencia y continuidad funcional varios cambios que se habian trabajado antes sobre los arboles 0.0.0 y 0.0.3.
* Se limpio la estructura del frontend eliminando proyectos y artefactos que no debian vivir dentro de esta app, incluyendo carpetas duplicadas de backend y salidas de compilacion temporales segun el estado de la reorganizacion.
* Se actualizo package.json y la documentacion local para que la version activa del frontend quedara registrada como 0.0.4 dentro del nuevo arbol FRONTED.
* Se removio del frontend el modelo viejo de classCode y joinedClassCode como fuente principal de verdad y se migro el flujo visual hacia rooms, room\_members, student\_sim\_accounts y sala activa.
* Se elimino Portafolio del sidebar global y se movio el portafolio al workspace de Clases, de manera que cada sala administre su propio contexto academico y operativo.
* Se dejo al docente con portafolio global visible a traves de sus salas, mientras el estudiante opera con portafolio aislado por sala activa.
* Se fortalecio el cliente Supabase con cache local de access token y escucha de onAuthStateChange para evitar que acciones sensibles, como crear salas, dependieran de getSession cuando este se cuelga o tarda demasiado.
* Se corrigio el flujo de crear sala para usar el endpoint backend dedicado en vez de inserciones directas desde el navegador, incorporando fallback de token, manejo de timeouts y lectura de respuesta del backend.
* Se corrigio el warning del sistema de toast retirando la prop dismiss del spread hacia el nodo li renderizado por Radix.
* Se mejoro TradingContext para que, si falla la recuperacion inicial de sesion, el fallback cargue el estado real de la app y no deje al usuario autenticado a medias sin rooms ni estado academico.
* Se corrigio la hidratacion de salas del docente despues de recargar la pagina, ajustando la consulta de rooms para combinar salas creadas por el docente y salas accesibles por membresia, y reparando bloques duplicados en selectRoom y refreshActiveRoomData.
* Se estabilizo la pagina de Clases para usar rooms desde el contexto global en lugar de recargas duplicadas que generaban mensajes falsos como no se pudieron cargar las salas.
* Se mantuvo registro de que el sistema de salas, actividades, auditoria, ranking, detalle de estudiante y portafolio por sala en esta version nueva hereda y consolida decisiones funcionales que venian siendo refinadas en las versiones 0.0.0 y 0.0.3.
* Separacion 0.0.0

  * Se heredaron los trabajos tempranos de integracion del chart con historico real, cache de velas, temporalidades multiples y mezcla entre datos vivos y datos historicos.
  * Se arrastro la linea de trabajo de mover el sistema academico fuera del perfil global para terminar llevandolo a rooms y sala activa en esta version.
  * Se mantuvo como antecedente la evolucion del dashboard de trading, overlays, barra superior, estudios, personalizacion del chart y arquitectura de datos del PriceChart.

0.0.5

* Se cambio el direccionamiento inicial de la aplicacion para que la entrada publica comience en una landing y la experiencia operativa quede concentrada en `/plataforma`.
* Se organizaron las rutas publicas para separar Inicio, Plataforma, Mercados, Funcionalidades, Aprendizaje, Acerca de y Contacto en vistas propias en lugar de mantener toda la home apilada en una sola pagina.
* Se ajustaron accesos internos como login, registro, sidebar y preferencias para que el flujo autenticado apunte al nuevo home funcional bajo `/plataforma`.
* Se construyo una nueva arquitectura de landing publica con header fijo, hero principal, secciones de producto, vista previa, mercados, aprendizaje, acerca de, contacto y footer extendido.
* Se reemplazo el branding del header publico por logo mas wordmark de GlobalTradeLab y se alineo su tono visual con la paleta azul del dashboard.
* Se recoloreo la landing para dejarla coherente con la identidad azul de la plataforma, retirando acentos verdes y reforzando la jerarquia visual en fondos, botones, badges y paneles.
* Se creo una seccion de contacto con formulario, datos visibles y preparacion de envio por correo desde la propia landing.
* Se hizo la seccion Acerca de con definicion clara del producto, subtitulo, bloque central y tarjetas funcionales de simulacion, mercados, portafolio y aprendizaje.
* Se hizo la seccion Funcionalidades con grid de seis tarjetas orientadas a producto, enfatizando exploracion de mercados, analisis, simulacion, portafolio, seguimiento y practica.
* Se reconstruyo la seccion Plataforma como una vista previa visual del sistema usando el mockup real `GTL DASHBOARD.png`, hotspots de zonas clave y recorrido por modulos secundarios.
* Se simplifico despues esa seccion retirando bloques de texto y modulos destacados sobrantes para dejar una lectura mas limpia.
* Se agrego en Mercados una tabla visual paginada de hasta diez activos por pagina con interaccion por fila y redireccion al login o a la plataforma principal segun la sesion.
* Se dejo la tabla de Mercados conectada a los mismos `symbols` del `TradingContext` para usar la base real de activos del sistema en lugar de datos manuales.
* Se ajusto la landing para que responda al modo visual principal mientras estuvo activo el selector publico, corrigiendo contraste de tablas, tarjetas, zonas principales, footer y paneles en modo claro.
* Se diseño el footer para hacerlo mas completo, con branding, enlaces agrupados, contacto, legal, ayuda, mensaje importante y navegacion inferior.
* Se limpiaron multiples microcopys narrados desde fuera del producto para dejar la landing con un lenguaje mas directo y orientado a valor.
* Se separo la implementacion de la landing en archivos por seccion para reducir el tamaño de `content.jsx`, dejando componentes independientes para layout, hero, plataforma, funcionalidades, mercados, aprendizaje, acerca de y contacto.
* Se rehizo el inicio con un hero visual de ancho completo y luego se refino para usar la imagen real `Backgroud.avif` como fondo principal.
* Se integraron sobre ese hero el texto central de simulacion, analisis y practica, junto con CTA de crear cuenta, iniciar sesion y copy de apoyo.
* Se ajusto la scrollbar publica a un estilo mas fino y azul alineado con la identidad visual de GlobalTradeLab.
* Se corrigio el offset entre header y hero en la home publica, permitiendo que el inicio quede pegado al header fijo sin la separacion inicial.

0.0.6 

* Se elimino el backend duplicado dentro del frontend y se dejo como unica fuente de verdad el backend principal 0.0.2.
* Se redirigio la autenticacion del frontend para consumir la API interna de auth del backend mediante cookies, csrf, restore, login, refresh, logout, logout-all, sessions y change-password.
* Se reorganizo el cliente auth para mantener el access token en memoria y evitar el uso de localStorage o sessionStorage para secretos de sesion.
* Se estabilizo la restauracion de sesion durante el arranque para evitar bucles de entrada y salida, dobles bootstrap y rehidrataciones repetidas.
* Se ajusto el contexto global para operar en modo backend con cookies cuando no exista sesion directa del cliente de Supabase.
* Se desactivo en modo backend la escritura y lectura directa de perfil, portafolio y recursos protegidos de Supabase que dependian de RLS del cliente.
* Se incorporo gestion de sesiones activas por dispositivo y cambio de contrasena dentro de la seccion Seguridad de la configuracion.
* Se adapto la plataforma para consumir quotes, history, ohlc, indicators y drawings desde el backend principal ya unificado.
* Se mantuvo la carga de mercado con rutas backend unificadas y se reforzo la tolerancia visual a fallos de red y autenticacion durante el bootstrap.
* Se profesionalizo la arquitectura de internacionalizacion del frontend con recursos sincronizados en espanol e ingles, fallback estable, deteccion por almacenamiento local y estructura de claves semanticas por dominio.
* Se reorganizaron y limpiaron los archivos de traduccion para eliminar claves ambiguas, duplicadas o inconsistentes y dejar una base escalable para nuevos idiomas.
* Se migraron a i18n los textos visibles de autenticacion, dashboard, trading, configuracion, landing publica, ayuda, aprendizaje, overlays, paneles de clases, vistas docentes y portafolios estudiantiles.
* Se eliminaron textos hardcodeados de botones, labels, placeholders, toasts, estados vacios, modales, tablas, mensajes de error, atributos de accesibilidad y ayudas contextuales en los modulos principales.
* Se incorporaron interpolaciones y pluralizacion en mensajes dinamicos para evitar concatenaciones manuales y mantener consistencia entre idiomas.
* Se ajusto el formateo regional de fechas, cantidades y montos para respetar el locale activo en los puntos criticos de la interfaz.
* Se agrego un selector flotante de idioma con despliegue hacia arriba para la landing publica y cambio inmediato entre espanol e ingles.
* Se corrigio el wrapper reutilizable de dialogos para que el texto accesible de cierre use traducciones en lugar de quedar fijo en ingles.
* Se documento la arquitectura i18n en docs/i18n-architecture.md para fijar convenciones de claves, estructura y mantenimiento futuro.
* Se agrego el script scripts/check-i18n-hardcodes.mjs y el comando npm run i18n:audit para detectar textos incrustados en JSX y prevenir regresiones de internacionalizacion.
* Se corrigio el flujo de recarga autenticada para que errores recuperables de red o de bootstrap no borren la sesion persistida ni expulsen al usuario innecesariamente.
* Se agrego restauracion local de estado de sesion cuando falle temporalmente la inicializacion remota, manteniendo perfil, preferencias y contexto operativo.
* Se corrigio la persistencia del idioma del usuario para que la interfaz y el selector de preferencias conserven ingles o espanol tras recargar, cerrar sesion y volver a entrar.
* Se normalizo la sincronizacion entre i18n, perfil de usuario y preferencias locales para evitar que el selector de idioma muestre un valor distinto al idioma realmente activo.
* Se reemplazo la lista embebida de zonas horarias por carga dinamica desde el backend principal mediante preferencias unificadas.
* Se agrego un selector compacto de zona horaria en la barra fija colapsable del dashboard con despliegue superpuesto hacia la izquierda y enfoque automatico sobre la opcion activa.
* Se sincronizo en ambos sentidos la zona horaria entre Preferencias y el control rapido del dashboard.
* Se corrigio el procesamiento temporal del PriceChart para mostrar el eje y las etiquetas segun la zona horaria seleccionada por el usuario.
* Se reforzo la normalizacion local de timestamps y se versiono el cache OHLC para descartar historicos mal interpretados tras el ajuste horario.
* Se reestructuro la experiencia autenticada para iniciar en `/app/classes` y convertir Clases en el modulo principal de entrada.
* Se reorganizo el router para separar rutas globales de plataforma y rutas contextuales por sala bajo `/app/classes/:classId`.
* Se movieron Dashboard, Mercados y Mercado sintetico al contexto de sala y se elimino su dependencia como espacios globales.
* Se consolido una sola sidebar principal con submodulos contextuales debajo de Clases visibles unicamente dentro de una sala especifica.
* Se separaron responsabilidades entre sesion global, contexto de sala activa y contexto operativo de mercado para reducir acoplamiento y carga prematura.
* Se corrigio el bootstrap autenticado para no disparar consultas pesadas de trading antes de seleccionar una sala.
* Se corrigio la restauracion de sesion y la sincronizacion del token actual con Supabase para evitar perdida de clases tras recarga.
* Se elimino el upsert automatico de perfil durante el arranque autenticado para evitar bloqueos por RLS en `profiles`.
* Se agrego persistencia local y recuperacion controlada de salas accesibles como respaldo cuando la lectura remota falle temporalmente.
* Se corrigio la carga de salas docentes para contemplar membresias `teacher` y `monitor` ademas de salas creadas por el usuario.
* Se creo la vista contextual de sala en `/app/classes/:classId` como nueva portada operativa de cada clase.
* Se movieron a la vista interna de sala el resumen contextual, las metricas y la navegacion superior propia de la sala.
* Se limpio la vista general de salas para dejarla enfocada en tarjetas, busqueda y acciones de gestion sin bloques operativos internos de una sala.
* Se agrego la ruta de edicion de sala `/app/classes/:classId/edictclass` y el acceso por menu de tres puntos desde cada tarjeta.
* Se normalizaron los estados funcionales de sala a `active`, `inactive` y `deleted`.
* Se corrigio la visibilidad del saldo superior para mostrarlo solo dentro de una sala especifica y ligado al balance contextual del usuario en esa sala.
* Se reemplazo la accion superior de Actividades en la vista interna de sala por accesos directos a Dashboard, Mercados y Mercado sintetico.
* Se ajustaron las proporciones del dashboard para evitar superposicion entre el grafico principal, posiciones abiertas e historial de transacciones.
* Se corrigio el modo fullscreen del PriceChart para ocultar la sidebar y liberar todo el espacio principal del layout.
* Se corrigio el render del Dashboard importando `useEffect` faltante en la vista principal.
* Se corrigieron las consultas de `activity_grades` especificando la relacion correcta con `profiles` para eliminar la ambiguedad de Supabase.
* Se agrego una barra modular debajo del PriceChart para activar y desactivar posiciones abiertas, historial, resumen de portafolio, ranking, noticias y watchlist de pares visitados.
* Se agrego persistencia local para la visibilidad de widgets del dashboard y para la watchlist de simbolos visitados recientemente.
* Se corrigio la conciliacion entre historico OHLC y datos vivos del PriceChart para fusionar actualizaciones por timestamp y reflejar correctamente las cotizaciones vigentes.
* Se corrigio el refresco periodico de cotizaciones del dashboard para desacoplarlo de los cambios de `marketData` y mantener la actualizacion recurrente esperada.
* Se elimino la inyeccion de precios sinteticos del flujo de mercado real del dashboard y de la experiencia operativa por sala.
* Se elimino la navegacion y las rutas del mercado sintetico del workspace general autenticado.
* Se corrigio el bucle de render en DashboardWidgetShelf estabilizando el setter de `useLocalStorage`.
* Se agregaron nuevos simbolos de mercado al llamado batch de cotizaciones y a la metadata operativa del frontend.
* Se corrigio la clasificacion de ETFs reemplazando referencias de indices por los ETFs reales `DIA` y `SPY`.
* Se agrego el filtro de ETFs en la tabla flotante de busqueda de mercado y en la pagina de Mercados.
* Se reordeno el filtro de ETFs para ubicarlo inmediatamente despues del filtro de indices en ambas vistas de mercado.
* Cambio: Se estabilizo la conexion del frontend con el backend principal para consumir mercado y autenticacion por rutas `/api` unificadas.
* Correccion: Se ajusto la resolucion de `BACKEND_URL` para priorizar ruta relativa y evitar bloqueos por `ERR_CONNECTION_REFUSED` y `ERR_CONNECTION_RESET` en entorno local.
* Correccion: Se actualizo el proxy de desarrollo para apuntar a `127.0.0.1` y reducir fallos intermitentes de red al consultar `/api/auth/*` y `/api/market/*`.
* Agregacion: Se reforzo la degradacion visual del dashboard cuando no hay datos iniciales, permitiendo recuperacion tras la carga posterior de OHLC en backend.
* Eliminacion: Se retiro la dependencia de endpoints o rutas acopladas a tablas legacy de velas por temporalidad, quedando acoplado al backend con `public.candles`.
<<<<<<< HEAD

20260827

* Correccion: Se ajusto la carga inicial de precios para que todos los activos tengan una serie operable desde el primer snapshot del mercado.
* Correccion: Se incorporo la variacion porcentual entregada por el backend como referencia del precio anterior, evitando mostrar `0%` por falta de una segunda vela.
* Correccion: Se agrego un fallback de precios simulados validos cuando un mercado no responde o entrega una cotizacion invalida, evitando que el formulario de operaciones quede bloqueado con precio `0`.
* Correccion: Se mantuvo la validacion de precio positivo para proteger las operaciones, permitiendo operar en todos los mercados con una cotizacion disponible.
=======
* Cambio: Se consolido el consumo de mercado y autenticacion del frontend sobre el backend principal con rutas `/api` centralizadas.
* Agregacion: Se dejo el frontend preparado para reflejar velas OHLC servidas desde `public.candles` sin manejo de nombres de particiones en cliente.
* Correccion: Se estabilizo la conectividad local reduciendo errores de red intermitentes mediante ajustes de `BACKEND_URL` y proxy en desarrollo.
* Correccion: Se reforzo la recuperacion visual del dashboard para continuar operativo durante ausencia temporal de datos y rehidratarse al llegar nuevas velas.
* Eliminacion: Se retiro el acoplamiento del frontend a estructuras legacy de velas por timeframe, usando un flujo unificado con backend.
* Cambio: Se actualizo la configuracion local del frontend para consumir el backend publico `https://gtl-e6j4.onrender.com` en `VITE_BACKEND_URL`, `VITE_AUTH_BACKEND_URL` y `VITE_MARKET_BACKEND_URL`.
* Agregacion: Se dejo el frontend preparado para operar contra Render sin depender de `localhost` en variables de entorno activas.
* Correccion: Se confirmo compilacion de frontend con `npm run build` despues de aplicar la URL publica del backend.
* Eliminacion: No se realizaron eliminaciones en frontend durante este cierre.
* Cambio: Se fijo la carga inicial de historico OHLC en 500 velas y la carga incremental al desplazar hacia la izquierda en bloques de 100 velas.
* Correccion: Se corrigio el cambio de activo en grafico limpiando estado previo al cambiar simbolo o temporalidad y reemplazando la serie inicial por la del activo seleccionado.
* Correccion: Se evito la precarga automatica de historico antiguo al iniciar, dejando la solicitud incremental solo por desplazamiento real del usuario hacia la izquierda.
* Correccion: Se estabilizo el enfoque inicial del chart para mostrar un rango amplio y consistente de barras al abrir.
* Agregacion: Se agrego estado de fin de historico con validacion robusta cuando no hay mas velas o cuando la respuesta ya no agrega nuevos timestamps.
* Agregacion: Se incorporo aviso visual de "No hay mas velas disponibles" en el badge superior de estado y en el borde izquierdo del grafico al llegar al limite historico.
* Correccion: Se versiono cache OHLC en frontend para invalidar historicos antiguos y forzar recarga limpia tras ajustes de logica.
* Eliminacion: Se retiro el comportamiento de mezclar historicos de simbolos distintos en la carga inicial del chart
* Cambio: Se actualizo la configuracion local del frontend para consumir el backend publico `https://gtl-e6j4.onrender.com` en `VITE_BACKEND_URL`, `VITE_AUTH_BACKEND_URL` y `VITE_MARKET_BACKEND_URL`.
* Agregacion: Se dejo el frontend preparado para operar contra Render sin depender de `localhost` en variables de entorno activas.
* Correccion: Se confirmo compilacion de frontend con `npm run build` despues de aplicar la URL publica del backend.
* Eliminacion: No se realizaron eliminaciones en frontend durante este cierre.
* Cambio: Se habilito inicio y registro con Google en las vistas `Login` y `Register` reutilizando el flujo OAuth de Supabase en el contexto global de autenticacion.
* Agregacion: Se incorporaron estados de carga y acciones de UI para Google OAuth en ambos formularios, incluyendo textos i18n para espanol e ingles.
* Agregacion: Se centralizo la URL de redireccion OAuth en `src/lib/auth-config.js` con resolucion desde `VITE_OAUTH_REDIRECT_URL` y fallback dinamico al `APP_HOME_PATH`.
* Correccion: Se agrego un puente automatico en `restoreSession` para intercambiar sesion Supabase por sesion propia de backend cuando no existe cookie previa de `refresh`.
* Correccion: Se reforzo la configuracion de entorno para OAuth con `VITE_OAUTH_REDIRECT_URL` en el frontend.
* Eliminacion: No se realizaron eliminaciones funcionales en frontend durante este cierre.
* Cambio: Se unifico el flujo de union a sala para validar y normalizar el codigo (`trim`, mayusculas, eliminacion de espacios y guiones) antes de procesarlo.
* Agregacion: Se priorizo en frontend el endpoint backend `POST /api/rooms/join` para el ingreso de estudiantes y se dejo fallback controlado al flujo directo cuando aplique.
* Correccion: Se elimino el falso error visual posterior al ingreso cuando la vinculacion ya fue exitosa y falla una accion secundaria de seleccion de sala.
* Agregacion: Se incorporo en tarjetas de sala el menu de tres puntos para estudiantes con la accion `Salir de sala`.
* Correccion: Se estabilizo la interaccion del menu de acciones en tarjetas para evitar click-through sobre la tarjeta y superposicion de navegaciones.
* Eliminacion: No se realizaron eliminaciones funcionales en frontend durante este cierre.

0.0.7

20261405

* Cambio: Se amplio la creacion y edicion de salas para manejar nombre, descripcion, moneda, saldo inicial, fecha de inicio, fecha de cierre, mercados habilitados, ranking, calificaciones, visibilidad del portafolio y portada.
* Agregacion: Se incorporo `src/lib/room-options.js` con catalogo de monedas y saldo base por moneda (`USD` 2500, `COP` 100000000), y listado de mercados disponibles.
* Agregacion: Se incorporo `src/lib/room-settings.js` para persistencia local de configuraciones de sala (ranking, calificaciones, mercados, visibilidad, portada y fechas operativas).
* Cambio: Se hidrataron salas en contexto global para mezclar datos de backend y configuracion local, incluyendo guardado de `roomSettings` al crear o editar.
* Correccion: Se unificaron los estados de sala a `active`, `closed` y `archived`, con normalizacion de valores legacy.
* Cambio: Se ajustaron las tarjetas de salas para mostrar bloques verticales de `Saldo base`, `Posicion en ranking` y `Calificaciones`.
* Agregacion: Se aplico degradado visual y tooltip cuando ranking o calificaciones estan desactivados en la sala.
* Correccion: Se estabilizo el menu de tres puntos en tarjetas para evitar superposicion de despliegues y aperturas multiples simultaneas.
* Agregacion: Se anadio eliminar sala desde el menu de tres puntos con confirmacion explicita y estilos de advertencia en rojo.
* Agregacion: Se anadio eliminar sala dentro de editar sala con confirmacion explicita y estilos de advertencia en rojo.
* Cambio: La eliminacion de sala se maneja como archivado operativo (`archived`) para retirarla del flujo activo.
* Correccion: Se removieron textos extra de advertencia en el modal de eliminacion, conservando solo el titulo y la confirmacion puntual.
* Cambio: En creacion de sala, los mercados habilitados quedaron desmarcados por defecto y se exige minimo un mercado para guardar.
* Correccion: Se reforzaron validaciones de fecha para impedir cierres menores a la fecha de inicio.
* Agregacion: Se habilito fecha de cierre indefinida en editar sala, permitiendo guardar `operationCloseDate` en `null`.
* Cambio: Se hizo no editable la moneda en editar sala una vez creada la sala.
* Correccion: Se redirigio cancelar y volver en editar sala hacia el listado general de clases (`/app/classes`).
* Correccion: Se estandarizo la apertura del calendario desde el icono usando `showPicker()` con fallback, evitando fallos intermitentes de apertura.
* Cambio: Se aplico estilo GTL unificado a fechas y checkboxes mediante clases globales `gtl-date-input` y `gtl-checkbox`.
* Agregacion: Se agregaron y ajustaron claves de i18n en espanol e ingles para nuevos campos, validaciones, toasts y acciones de sala.
* Correccion: Se bloqueo operacion de estudiantes cuando la sala esta cerrada, archivada o fuera de fecha de cierre, manteniendo acceso de visualizacion.

20261405

* Correccion: Se elimino la sincronizacion del access token interno del backend hacia el almacenamiento de sesion de Supabase para evitar contaminacion de tokens.
* Agregacion: Se incorporo validacion del issuer JWT de Supabase y saneamiento automatico de tokens invalidos o incompatibles en el storage local del cliente.
* Correccion: Se reforzo la restauracion de sesion para usar token valido de Supabase y ejecutar `refreshSession` antes de reintentar `POST /api/auth/oauth-login` cuando el token este vencido o sea invalido.
* Correccion: Se estabilizo la recuperacion de sesion en recarga para reducir falsos cierres de sesion por errores recuperables de red o expiracion de token de puente OAuth.
* Correccion: Se valido compilacion del frontend con `npm run build` despues de los ajustes de autenticacion.
* Eliminacion: No se realizaron eliminaciones funcionales en frontend durante este cierre.

20261405

* Agregacion: Se incorporo `deleteRoom(roomId)` en `src/lib/trading-db.js` para consumir `DELETE /api/rooms/delete` del backend.
* Cambio: Se conecto el flujo de eliminar sala en `ClassesPanel` y `EditClassPage` para usar eliminacion real en backend en lugar de cambio de estado a `archived`.
* Agregacion: Se agrego `deleteManagedRoom` en `TradingContext` para centralizar la eliminacion y refrescar la data de salas despues de borrar.
* Correccion: Se ajustaron `updateRoomState` y `updateRoomDetails` para evitar error `406/PGRST116` cuando no hay filas, reemplazando `.single()` por lectura con `limit(1)` y control de sala inexistente.
* Correccion: Se actualizaron textos i18n de eliminacion en `src/Languages/es.js` y `src/Languages/en.js`, cambiando redaccion de "archivada" a "eliminada" en mensajes de borrado de sala.

20261405

* Cambio: Se reemplazo el bloque de `Cuentas simuladas` por `Portafolios activos` en el resumen de la vista interna de clase.
* Agregacion: Se agrego en la barra superior de clase el boton de regreso a clases con icono y acceso directo.
* Agregacion: Se conecto el boton `Formar grupos` a una gestion funcional con modal para crear grupos, listar grupos, asignacion manual de estudiantes, autoasignacion y provision de portafolios grupales.
* Agregacion: Se incorporaron helpers de consumo backend en `src/lib/trading-db.js` para grupos de sala (`list`, `create`, `update`, `members`, `auto-assign`, `provision-portfolios`).
* Correccion: Se corrigio el error `ReferenceError: roomAccounts is not defined` en la vista de clase, restaurando el origen correcto del estado contextual.
* Correccion: Se dejo la fecha de cierre operativa como campo no obligatorio en el flujo de creacion/edicion de sala.

20261405

* Correccion: Se ajusto la carga de salas en `src/contexts/TradingContext.jsx` para evitar rehidratar salas eliminadas desde cache local cuando el backend responde lista vacia.
* Cambio: Se condiciono el fallback a `gtl.accessible-rooms` solo cuando falla la consulta al backend, conservando como fuente de verdad la respuesta remota.
* Correccion: Se persistio cache de salas tambien cuando la lista es vacia para limpiar datos obsoletos en cliente.
* Correccion: Se valido compilacion del frontend con `npm run build` despues de los ajustes de sincronizacion de salas.

20261405

* Correccion: Se estabilizo el callback de Google OAuth en frontend con reintentos extendidos de sesion Supabase durante la restauracion inicial.
* Agregacion: Se incorporo lectura de `access_token` desde la URL de callback como respaldo para el puente OAuth cuando la sesion aun no esta hidratada en storage.
* Cambio: Se reforzo `restoreSession` y el puente `POST /api/auth/oauth-login` con estrategia de reintento para evitar cierres de sesion por desfase de reloj de segundos.
* Correccion: Se agrego manejo especifico de errores transitorios de autenticacion (`issued in the future` y `AuthSessionMissingError`) para evitar logout falso en el arranque.
* Correccion: Se valido compilacion del frontend con `npm run build` y se publico en hosting con `firebase deploy --only hosting`.

20261805

* Cambio: Se actualizo `leaveRoom` en `src/lib/trading-db.js` para priorizar el endpoint backend `POST /api/rooms/leave` y confirmar salida real desde servidor.
* Correccion: Se ajusto el fallback de salida para evitar confirmaciones falsas cuando el endpoint remoto no esta disponible, exigiendo verificacion de estado `removed`.
* Correccion: Se elimino la reaparicion visual de salas tras salir aplicando limpieza inmediata de estado local y cache de salas accesibles en `TradingContext`.
* Correccion: Se estabilizo el flujo de union a sala para evitar errores falsos posteriores a una vinculacion ya exitosa.
* Correccion: Se mantiene operativa la autenticacion con Google con comportamiento parcial, pendiente de estabilizacion completa en callback y restauracion.
>>>>>>> 65fcd81 (Cambio PC1)
