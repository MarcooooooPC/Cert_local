# Decisiones

- **users.active**: se añadió la columna `active` (no estaba en el esquema) para poder "desactivar" usuarios.
- **settings**: tabla `settings (k, v)` añadida al esquema (site_name, base_url).
- **SQLite**: solo para pruebas; `db.php` traduce el SQL de MySQL en tiempo de ejecución. Producción = MySQL.
- **IP del cliente**: se usa solo `REMOTE_ADDR` (X-Forwarded-For es falsificable). Si Hostinger va tras proxy y todos los visitantes comparten IP, revisar.
- **CSRF en login**: el SPA llama primero a `me` para obtener el token; `login` y `logout` también exigen `X-CSRF-Token`.
- **Throttle de login**: cuenta cada intento; el contador IP+correo se borra al acertar. Ventana fija de 15 min.
- **CERT_CONFIG** (variable de entorno): solo para que las pruebas usen otra config.
- **Desaprobados**: pendiente (ver `puede_emitir`, fase 5).

## Fase 2 · Moldes
- **Posición**: `x`,`y` son el punto de anclaje en %; en texto es el centro de la primera línea (según `align`, borde izquierdo/centro/derecho), en QR el centro.
- **Tipos de campo desconocidos** se descartan al guardar (no se convierten en texto).
- **Un solo QR** por molde en el editor (el servidor no lo restringe).
- **JPG**: se guarda como `tpl_<hex>.jpg`; los PDF llegan ya convertidos a PNG (pdf.js 3.11.174, ancho 2400 px, baja a 1600/1100 si pasa ~7,5 MB).
- **Dimensiones válidas**: 300–8000 px por lado.
- **uploads_dir** (opcional en config.php): solo para pruebas.
- **PHP en Hostinger**: subir `upload_max_filesize` y `post_max_size` a ≥ 10M (el valor por defecto de PHP, 2M, rechaza moldes grandes).
- **Fuentes**: Montserrat y Playfair Display (solo subconjunto latin, variable 400–700).

## Fase 3 · Cursos
- **Nota mínima obligatoria** en cursos con notas (sin ella no se puede calcular `passed`).
- **Sin notas**: se ignoran porcentajes, mínima, imprimir nota y redondeo (se guardan en 0/NULL); la escala queda en 20.
- **Editar un curso recalcula siempre** `final_grade`/`passed` de sus participantes; los certificados ya emitidos no cambian.
- **Borrar curso**: bloqueado si tiene certificados (aunque estén revocados); si no, se borran también sus participantes.
- **Suma de porcentajes**: se compara en centésimas (100.00 exacto).
- **Redondeo**: `floor(x + 0.5)` tras redondear a 6 decimales para evitar errores de coma flotante.

## Fase 4 · Importación y notas
- **Lectura del Excel en el navegador** (SheetJS 0.20.3, `assets/vendor/xlsx`); el servidor recibe filas JSON y es quien valida y normaliza (también en la vista previa).
- **Columnas obligatorias**: DNI, Nombres y apellidos y una por cada componente con peso > 0. Se reconocen variantes (acentos, mayúsculas, "Apellidos y nombres", "Email"…). Las columnas de componentes con peso 0 se ignoran.
- **Notas vacías** al importar = pendiente (no es error). En una **reimportación**, una celda vacía **conserva** el dato existente; en la edición manual, vacío **borra** la nota.
- **DNI**: solo dígitos y menos de 8 → se rellena con ceros a 8; otros documentos (carnet, pasaporte) se conservan tal cual en mayúsculas.
- **Límite**: 5000 filas por importación.
- **CSV**: se lee como UTF-8.

## Fase 5 · Emisión y descarga
- **Regla de elegibilidad aislada** en `puede_emitir()` ([app/Models/certificates.php](app/Models/certificates.php)): hoy solo aprobados (o todos si es sin notas). **Pendiente de definir por el cliente** qué pasa con los desaprobados.
- **Emitir exige molde asignado** al curso (si no, error claro).
- **Variables** (`cert_vars`): `periodo` se redacta según el caso ("El 3 de marzo de 2026", "Del 3 al 21 de marzo de 2026", "Del 3 de marzo al 21 de abril de 2026"…). `{nota_final}` queda vacía (no se dibuja) salvo que el curso sea con notas, tenga "imprimir nota" y la nota exista.
- **PDF**: hoja con proporción del molde y ancho de referencia A4 (842 pt apaisado / 595 pt vertical); fondo en JPEG calidad 0.92 para que pese poco.
- **ZIP**: partes de 150 PDFs, sin compresión (los PDF ya están comprimidos), nombres `certificados_<curso>_parteNdeM.zip`. Con más de una parte el navegador puede pedir permiso para "descargar varios archivos".
- **QR** apunta a `{base_url}/c/{CODIGO}`; si falta `base_url` en ajustes usa la URL del sitio detectada desde el navegador.
- **Colisión de código**: se reintenta hasta 10 veces (clave única).

## Fase 6 · Público
- **`public_cert`** devuelve solo las variables que el molde usa (y no vacías). Revocado → solo `{status:'revoked'}`. Inexistente o código mal formado → 404. El HTML de `cert.php` nunca lleva datos personales: nombre, curso, horas, fecha y nota los carga el JS desde la API.
- **Límite**: 90 consultas/min por IP (clave `pub:`), compartido entre `cert.php` y la API → 429.
- **CSP** en `cert.php`: `script-src 'self'` (sin scripts inline); jsPDF se carga solo al pulsar "Descargar PDF".
- **Enlace de compartir**: usa `base_url` de Ajustes (el mismo del QR); si falta, la URL del host.
- **Sin caché** (`no-store`) para que una revocación se vea de inmediato.
- **Desarrollo local**: `php -S 127.0.0.1:8080 tests/router.php` replica la reescritura `/c/CODIGO` del `.htaccess`.

## Fase 7 · Revocar, ajustes y pulido
- **Revocar**: motivo opcional (máx. 300, espacios normalizados); guarda fecha y usuario. Revocar uno ya revocado o restaurar uno vigente → 409. **Restaurar** borra fecha, motivo y usuario de revocación y vuelve a congelar textos **y diseño** con los datos y el molde actuales (así se corrige un certificado emitido antes de ajustar el molde). El certificado revocado no entra en el ZIP/PDF de descarga.
- **Ajustes**: `base_url` debe ser http(s) con host; se guarda sin barra final. Cambiarla no altera PDF ya generados (el QR queda impreso).
- **Accesibilidad**: auditoría con axe-core (WCAG 2.0/2.1 A y AA) sin violaciones en login, cursos, moldes (lista y editor), usuarios, ajustes, participantes, certificados, diálogos y páginas públicas; enlace "Saltar al contenido"; `scope="col"` en tablas; mensajes de error con `role="alert"`; secciones del curso como `nav` con `aria-current`.
- **Móvil**: el panel y la página pública no desbordan a 390 px; botones táctiles de 44 px.
- `tests/ui.mjs` usa axe-core solo si está instalado (`npm i axe-core`).

## Fase 8 · Cierre y revisión de seguridad
- **Empaquetado**: `./empaquetar.sh` → `dist/certificados.zip` (sin `config.php`, `error.log`, SQLite, subidas `tpl_*`, `tests/`, `.git`). Se probó extrayéndolo en limpio: instala con el asistente, bloquea la reinstalación (403) y permite iniciar sesión.
- **Verificado con Apache real (2.4.66 de MAMP, `AllowOverride All`)**: `/c/CODIGO` se reescribe a `cert.php`; `inc/`, `sql/`, `*.md`, `uploads/` (listado) y `.php` o `.txt` en `uploads/templates/` dan 403; las imágenes PNG/JPG se sirven; las cabeceras nosniff/X-Frame-Options/Referrer-Policy salen; sin errores 500 por `Options` ni `php_flag`.
- **Revisión**: SQL siempre preparado (las únicas interpolaciones son enteros ya convertidos y fragmentos fijos); toda acción que escribe exige CSRF (verificado comparando `WRITES` con los `case` de la API); en el panel todo texto de usuario pasa por `esc()` o `textContent`.
- **Endurecimiento añadido**: `sql/` y `tests/` con `.htaccess` de denegación; HSTS (6 meses) cuando hay HTTPS; limpieza ocasional de filas vencidas en `throttle`.
- **Límites conocidos**: cambiar la clave no cierra las otras sesiones abiertas del mismo usuario; no hay caducidad de sesión por inactividad (la cookie dura hasta cerrar el navegador); el instalador es accesible hasta que se borre `/install`.

## Revisión de seguridad y QA (correcciones aplicadas)
- **pdf.js**: `isEvalSupported: false` al convertir moldes PDF (mitiga CVE-2024-4367; un PDF malicioso podía ejecutar JavaScript en el panel).
- **Límite de intentos atómico**: se incrementa antes de leer; 20 logins en paralelo ya no pasan de 8 ni dan 500 (test incluido).
- **Consultas públicas**: 300/min por IP (antes 90; cada visita cuenta 2 y un aula comparte IP).
- **Escala**: no se puede bajar `scale_max` por debajo de la nota más alta ya registrada en el curso.
- **Página pública**: al revocarse durante la visita, también se ocultan los botones de compartir.
- **CSP en el panel** (`<meta>` en `admin/index.html`): solo scripts propios; los estilos en línea siguen permitidos.
- **Pruebas**: `CERT_TEST_MYSQL='host=…;name=…;user=…;pass=…' php tests/run.php` corre todo contra MySQL (vacía esa base). Nuevos tests: desactivarse a sí mismo, clave actual incorrecta, escala, logins en paralelo e instalador (copia aislada). `tests/package.json` declara Playwright y axe-core.
- **Limpieza**: un solo `mes_es()`, un solo `loadImg` (en `CertPdf`), paginación común (`pagerHtml`/`pagerBind` en el panel, `paginar()` en la API), rotación de `inc/error.log` a 5 MB.

## Estructura MVC
- **Controladores frontales** en la raíz (`index.php`, `cert.php`, `api/index.php`) porque en Hostinger la carpeta pública es la del subdominio; todo el código vive en `app/`, `config/`, `database/` y `storage/`, bloqueados con `.htaccess`.
- **Rutas**: `app/routes.php` reemplaza el `switch` de la API; cada acción declara si escribe (POST + CSRF). Solo se carga el controlador de la acción pedida.
- **Controladores** como funciones `action_<acción>` agrupadas por recurso (sin clases ni autoloader: el proyecto no usa Composer). **Modelos** como funciones por entidad, sin cambiar su lógica ya probada.
- **Vistas**: `app/Views/public/` para las páginas PHP; el panel (`admin/`) es la vista del lado del cliente y no cambió.
- **Sin instalador web** (retirado en nov 2026): `.env` a mano desde `.env.example`, tablas creadas solas en la primera conexión (`schema_upgrade`) y primer administrador con `php app/cli-admin.php` (también restablece claves).
- **Cambios de ruta**: `inc/config.php` → `config/config.php`, `inc/error.log` → `storage/error.log`, `sql/` → `database/`.

- **Empaquetado**: se eliminó `empaquetar.sh` a pedido; el ZIP se arma a mano según la lista de exclusiones de `LEEME_INSTALACION.md`. `dist/certificados.zip` queda de la última generación.

## Panel modular
- **Módulos ES nativos** (`<script type="module">`, `import`/`export`), sin compilación ni npm: se sube igual por FTP. Requiere navegadores de 2021 en adelante (Chrome 89, Safari 15, Firefox 89).
- **`index.html` solo es el esqueleto**; cada pantalla vive en `admin/js/modules/<módulo>/` y los diálogos los crea el módulo que los usa (`dialog()` en `core/ui.js`).
- **Librerías de terceros** (SheetJS, jsPDF, JSZip, qrcode) y `assets/js/render.js` / `certpdf.js` siguen como scripts clásicos globales: los comparten el panel y la página pública.
- La lógica de cada pantalla no cambió: se movió tal cual y la verifican las 58 pruebas de interfaz.

## Un solo .htaccess
- Todas las reglas viven en el `.htaccess` de la raíz (antes había 8 repartidos por carpeta), a pedido, para mantener un solo archivo.
- Bloquea con `mod_rewrite`: `app/`, `config/`, `database/`, `storage/`, `tests/`; en `uploads/` solo sirve `templates/*.png|jpg|jpeg`; oculta archivos con punto (salvo `/.well-known/`, que usa el SSL) y `.md/.sql/.log/.sqlite`.
- **Falla cerrado**: sin `mod_rewrite` Apache responde 500 en todo el sitio en vez de exponer `config/config.php`. Verificado con Apache 2.4 (MAMP) en la raíz y en una subcarpeta.
- Contrapartida aceptada: ya no hay defensa por carpeta; un error al editar el `.htaccess` raíz afecta a todo. Por eso conviene no tocarlo salvo necesidad.
- `storage/` y `uploads/templates/` llevan un `.gitkeep` para que existan al desplegar.

## Una sola fuente por regla
- **URL del sitio**: `base_url()` (Ajustes o, si falta, `detect_base_url()` → `site_path()`, que funciona en raíz o subcarpeta). La API siempre la envía, así que el JS ya no la deduce por su cuenta.
- **Componentes de la nota**: `NOTAS_COLS` (app/Models/courses.php) en PHP y `COMPS` (admin/js/modules/cursos/notas.js) en JS; todo lo demás (cálculo, validación, formulario, control de escala) se deriva de ellas.
- **Búsquedas**: `like_param()`; **nombre del sitio por defecto**: `SITE_NAME_DEFAULT`; **nombres de archivo**: `CertPdf.slug()`.
- Duplicaciones que se mantienen a propósito: las variables del molde existen en PHP (`cert_vars`) y en JS (`CertRender.VARS`, datos de ejemplo del editor) porque el PDF se dibuja en el navegador; los rangos del editor de moldes repiten los del servidor solo como ayuda en pantalla (el servidor es quien valida); `tests/router.php` replica la regla `/c/` del `.htaccess` para el servidor de desarrollo.

## Rediseño del panel (crítica de impeccable, 2026-11)
- **Color de marca**: fijo (`#0066cc`, token `--petrol` en `admin.css`). Se eliminaron el ajuste `brand_color` y `marca.php`: ya no se editaba y costaba una consulta a la base por cada carga de CSS.
- **Selección múltiple**: por página, no entre páginas. Revocar y eliminar en lote llaman a la API una vez por fila; el ZIP de la selección usa `certs_export&codes=` (tope 300).
- **Participantes**: se quitó «Eliminar» por fila; se elimina marcando la fila (evita un menú de una sola opción).
- **Menú «Más»**: popover + anchor positioning + focusgroup; en navegadores sin esas funciones degrada (flechas por script, popover sin anclar).

### Segunda pasada (crítica 26/40)
- Se restituyó lo que faltaba tras la pasada de estilo «Apple»: menú «Más» por fila (Cursos, Moldes, Certificados), botones planos de 6 px, radios 6/8/12 y sombras mínimas.
- Solo tema claro: se quitó `color-scheme: light dark` y la mención de modo oscuro en PRODUCT.md (no hay tokens oscuros).
- `courses_list` devuelve `resumen` (participantes, certificados, con notas) de todo el filtro; los KPI ya no suman solo la página.
- Se quitó la insignia «SISTEMA ACTIVO»; la barra muestra el usuario real. Fechas cortas («2 mar – 20 abr 2026»).
- Revocar y eliminar en lote muestran avance («Revocando 12 de 40…») y la vista se atenúa mientras hay peticiones (`aria-busy`).

### Tercera pasada (crítica 28/40)
- Certificados: resumen Por emitir / Vigentes / Revocados (`certs_list` devuelve `resumen`), «Emitir N» como acción principal, «Revocado» con icono y enlace «Verlos en Participantes» que aplica el filtro `sin_emitir`.
- Cursos y Usuarios: las tarjetas KPI se sustituyeron por una línea de resumen; se eliminó el CSS de KPI.
- Una sola forma de fila (principal + «Más») también en Participantes; Eliminar aparece deshabilitado con el motivo si hay certificados. Fechas con `fechaDia`/`fechaCorta` en todas las listas.
- Los toasts de error ya no se cierran solos (se descartan al pulsarlos). Pista «Siguiente paso» en Participantes. `prefers-reduced-motion` respetado.

### Cuarta pasada (crítica 24/40)
- `ask()` acepta `peligro`: botón rojo con el verbo en eliminar/revocar (curso, molde, participante, usuario, certificados). El diálogo de usuario nombra a quién y su correo.
- Usuarios: se quitó la columna de rol (era un «Admin» fijo, el sistema no guarda roles); «Registro» solo si hay dato; fila «Editar + Más» con Eliminar dentro; sin estilos en línea.
- Se unificó «Contraseña» (login, menú, cambio de contraseña).
- Certificados: resumen y acciones en una misma franja, barra de lote fija y compacta, fila revocada atenuada. El filtro no se movió a la cabecera de la tabla.
- Errores: fallo de red → mensaje claro; un error de JS al pintar una pantalla ya no se muestra crudo (se registra en consola). Login con marca y nombre del sitio como título.

## Certificados inmutables, empresas y seguridad (nov 2026)
- **Diseño congelado al emitir**: `template_versions` guarda una copia del molde; cada certificado apunta a la suya (`template_version_id`). Editar el molde o cambiar el molde del curso solo afecta a lo que se emita después. Los archivos (fondos, imágenes) y fuentes que usa una versión no se borran nunca.
- **Textos congelados al emitir**: `certificates.vars_json` (nombre, curso, fechas, horas, nota). Corregir un certificado: anularlo, corregir los datos y restaurarlo (restaurar vuelve a congelar con los datos actuales).
- **Empresas**: tabla `companies`; cada curso elige quién lo dicta (nombre, logo, web) y la página pública lo muestra. Sin empresa: el nombre e icono del sitio.
- **Actualización de la base**: `schema_upgrade()` (app/Core/db.php) añade tablas/columnas a instalaciones previas en la primera petición. Cada paso aislado: si uno falla se registra en `storage/error.log` y el sitio sigue funcionando. Marca en `storage/` (o `settings.schema_version` si no se puede escribir).
- **Seguridad**: sesión con caducidad por inactividad (2 h) y absoluta (12 h); límite de intentos al cambiar la clave; cabeceras `Permissions-Policy` y `Cross-Origin-Opener-Policy`; API con CSP `default-src 'none'`; `uploads/.htaccess` con CSP `sandbox` y PHP desactivado; `.htaccess` bloquea también `dist/` y archivos `.sh/.json/.bak/.ini/...`.
- **Respaldos**: `app/Models/backup.php`. ZIP con `datos.json` (tablas; lo usa Restaurar), `database.sql` (lo mismo en SQL de MySQL con DROP/CREATE, para phpMyAdmin; verificado importándolo en una base nueva: tablas idénticas) + `uploads/`; sin `config.php`. En `storage/backups` (o `backups_dir` en config), últimos 14. Crear/descargar/restaurar en Ajustes; copia diaria con cron `app/cli-respaldo.php`. Restaurar pide la contraseña, guarda antes un respaldo «previo», valida cada archivo del ZIP (nombres del sistema y contenido real) y rechaza respaldos sin usuarios.
- **Configuración en `.env`** (raíz del portal, `app/Core/env.php`): `DB_DRIVER`, `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`, `APP_DEBUG` y opcionales `DB_SQLITE_PATH`, `UPLOADS_DIR`, `BACKUPS_DIR`. Se crea a mano desde `.env.example` (permisos 640). Intérprete propio sin dependencias (comillas, `#` comentarios, `export`). Las variables de entorno reales del servidor tienen prioridad. `.htaccess` bloquea los archivos que empiezan por punto (`/.env` → 403). `config/config.php` se sigue leyendo en instalaciones anteriores hasta pasarlas a `.env`. Las pruebas siguen usando `CERT_CONFIG` (archivo PHP).

## Correo (configuración y plantilla)
- **Ajustes › pestaña Correo** (#ajustes/correo): servidor SMTP, plantilla (asunto y mensaje), vista previa con datos de ejemplo y envío de prueba (usa la configuración **guardada**).
- **SMTP propio sin librerías** ([app/Models/mail.php](app/Models/mail.php)): SSL (465), STARTTLS (587) o sin cifrado; AUTH LOGIN; verifica el certificado TLS del servidor. Hostinger: `smtp.hostinger.com`, 465, SSL, usuario = buzón completo.
- **Clave SMTP**: se guarda en `settings` (`mail_pass`), nunca se devuelve al navegador, **no se incluye en los respaldos** y al restaurar se conserva la del servidor. Campo vacío al guardar = conservar la clave.
- **Plantilla**: variables `{nombre} {curso} {codigo} {enlace} {sitio}`; `{enlace}` es obligatorio y en HTML se dibuja como botón «Ver certificado». Se envía texto plano + HTML (multipart). Todo valor se escapa en la versión HTML.
- **Se envía el enlace al certificado, no el PDF adjunto** (el PDF se genera en el navegador; el enlace siempre refleja si se anuló).

## Vista previa al compartir (LinkedIn/WhatsApp)
- **Certificado completo** (con nombre y datos que muestre el molde), a pedido del cliente: antes era solo el fondo del molde, que en moldes de fondo blanco salía en blanco.
- **La genera el panel**, no el servidor: el navegador del administrador dibuja la página 1 con el mismo motor que la página pública y el PDF y la sube (`cert_og_upload`) como JPG de 1200 px ≤ 300 KB. Se hace al emitir, al restaurar y con el botón «Generar vistas previas (N)» para las que falten. PHP/GD no podría reproducir las fuentes WOFF2 ni el ajuste de líneas; que la suba el visitante permitiría cambiar la imagen de un certificado ajeno.
- **Archivo** `uploads/og/CODIGO.jpg` (servido por `.htaccess` solo con ese patrón). La URL lleva `?v=<fecha del archivo>` para que el CDN y LinkedIn no muestren una versión vieja. Sin archivo se usa lo de antes (fondo del molde o logo).
- **Anular borra la imagen**; restaurar la vuelve a generar. No va en los respaldos (se regenera).
