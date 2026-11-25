# Portal de certificados · Guía de instalación en Hostinger

Esta guía es para instalar el portal **sin saber programar**, usando solo el navegador y el panel de Hostinger (hPanel). Tiempo estimado: 20–30 minutos.

**Lo que necesitas antes de empezar**
- Una cuenta de Hostinger con un plan de hosting compartido (Premium o superior) y un dominio.
- El archivo `certificados.zip` que te entregaron.

---

## 1. Crear el subdominio y activar el SSL

Recomendamos un subdominio solo para los certificados, por ejemplo `certificados.tudominio.com`.

1. Entra a **hPanel** → **Sitios web** → tu dominio → **Administrar**.
2. Busca **Dominios → Subdominios** y crea el subdominio (por ejemplo `certificados`). Anota la carpeta que Hostinger le asigna (normalmente `public_html/certificados`).
3. En **Seguridad → SSL**, comprueba que el subdominio tenga el SSL activo (candado). Si aparece "Instalar", haz clic y espera unos minutos.
4. Activa **Forzar HTTPS** (en la misma sección de SSL).

## 2. Elegir PHP 8.1 o superior y activar extensiones

1. En hPanel → **Avanzado → Configuración de PHP** (o "PHP Configuration").
2. En **Versión de PHP** elige **8.1 o superior** (8.2 o 8.3 también sirven).
3. En **Extensiones** deben estar activadas: **pdo_mysql**, **mbstring**, **fileinfo** y **zip** (respaldos). Recomendada: **gd** (miniatura ligera del certificado al compartir por WhatsApp; sin ella se usa la imagen original).
4. En **Opciones de PHP** sube estos valores (los moldes pueden pesar hasta 8 MB):
   - `upload_max_filesize` = **64M**
   - `post_max_size` = **64M**
   (los moldes pesan hasta 8 MB; el margen es para **restaurar un respaldo**, que incluye todas las imágenes)
5. Guarda los cambios.

## 3. Crear la base de datos MySQL

1. En hPanel → **Bases de datos → Administración de bases de datos MySQL**.
2. Crea una base de datos, un usuario y una contraseña. Hostinger agrega un prefijo, por ejemplo:
   - Base de datos: `u123456789_certs`
   - Usuario: `u123456789_admin`
   - Contraseña: la que elijas (guárdala en un lugar seguro).
3. Anota los tres datos: van en el archivo `.env` (paso 5).

## 4. Subir el portal

1. En hPanel → **Archivos → Administrador de archivos**.
2. Entra a la carpeta del subdominio (por ejemplo `public_html/certificados`). Si hay un archivo `default.php` u otro de bienvenida, bórralo.
3. Haz clic en **Subir archivos** y sube `certificados.zip`.
4. Clic derecho sobre el ZIP → **Extraer** (extráelo en la misma carpeta, no dentro de una subcarpeta nueva).
5. Verifica que en la carpeta ahora estén directamente `index.php`, `cert.php`, `admin`, `api`, `app`, `.env.example`…
   Si quedaron dentro de otra carpeta (por ejemplo `certificados/`), muévelas una a una a la carpeta principal.
6. **Importante: archivo oculto.** El portal usa un único archivo `.htaccess` en la carpeta principal (empieza con punto y es oculto). En el Administrador de archivos activa **Configuración → Mostrar archivos ocultos** y comprueba que exista. Sin él el portal **no es seguro** (quedarían visibles la configuración y el código) y los enlaces `/c/CÓDIGO` no funcionan.
7. Borra el `certificados.zip` de la carpeta cuando termines.

## 5. Crear el archivo de configuración `.env`

1. En el Administrador de archivos, en la carpeta del portal, copia `.env.example` y renómbralo a **`.env`** (activa *Mostrar archivos ocultos*: empieza con punto).
2. Edítalo y completa los datos del paso 3:
   ```
   DB_DRIVER="mysql"
   DB_HOST="localhost"
   DB_NAME="u123456789_certs"
   DB_USER="u123456789_admin"
   DB_PASS="tu clave"
   APP_DEBUG="false"
   ```
   Deja los valores **entre comillas dobles** (la clave puede tener espacios, `#` o `=`).
3. Permisos del `.env`: clic derecho → Permisos → **640**. El `.htaccess` impide descargarlo por URL.
4. Abre `https://certificados.tudominio.com/`: en la primera visita el portal **crea solo las tablas** de la base.

## 6. Crear el primer administrador

Con **SSH** (hPanel → Avanzado → Acceso SSH), desde la carpeta del portal:
```
php app/cli-admin.php tu@correo.com "Tu Nombre"
```
Te pedirá la clave (mínimo 10 caracteres). El mismo comando con un correo existente **restablece su clave** (útil si la olvidas).

Sin SSH: crea una **Tarea Cron** que se ejecute una vez con
`/usr/bin/php /home/TU_USUARIO/domains/TU_DOMINIO/public_html/app/cli-admin.php tu@correo.com "Tu Nombre" "TuClave"`
y **bórrala en cuanto se ejecute** (la clave queda escrita en la tarea).

¿Pasas una instalación existente? En vez de crear el administrador, importa la base en phpMyAdmin o restaura un respaldo (Ajustes → Respaldos) y sube la carpeta `uploads/`.

Luego entra a **Ajustes** y pon el nombre del sitio y la **URL base** (`https://…`, sin `/` al final).

## 7. Entrar al panel

Abre `https://certificados.tudominio.com/admin/` e inicia sesión con el correo y la clave del administrador.

---

## Uso básico (resumen)

1. **Moldes** → *Nuevo molde*: sube la imagen o PDF de tu diseño de certificado, arrastra los campos (nombre, curso, QR, etc.) y guarda. Usa *Vista previa* para revisar.
2. **Cursos** → *Nuevo curso o taller*: completa los datos, elige el molde y, si es con notas, los porcentajes (deben sumar 100).
3. En el curso, pestaña **Participantes** → *Descargar plantilla*, llénala en Excel y **Importar Excel**. Revisa la vista previa antes de confirmar.
4. Pestaña **Certificados** → **Emitir certificados**. Hoy solo se emite a los **aprobados** (o a todos si el curso no tiene notas).
5. Descarga el **PDF** de cada persona o **Descargar todos (ZIP)**. Si hay más de 150, se descargan varios ZIP; el navegador puede pedirte permiso para "descargar varios archivos".
6. Tus clientes verifican en `https://certificados.tudominio.com/` escribiendo el código, o escaneando el QR del certificado.
7. Para anular un certificado: pestaña Certificados → **Anular**. Se puede **Restaurar** después.
8. **Ajustes**: nombre del sitio y URL base. Si cambias la URL base, los PDF ya descargados conservan el QR antiguo.

---

## Respaldos (hazlos cada cierto tiempo)

Un respaldo es un **ZIP con todos los datos** (cursos, participantes, certificados con su diseño y textos congelados, moldes, empresas, usuarios y ajustes) y **todos los archivos subidos** (fondos, logos, firmas y fuentes). No incluye el archivo `.env` (la clave de la base): guárdalo aparte una vez.

**Tres capas, de menos a más esfuerzo:**

1. **Copias de Hostinger**: hPanel → **Archivos → Copias de seguridad**. Restauran archivos y base de días anteriores (semanales o diarias según el plan). Actívalas, pero no dependas solo de ellas: viven en el mismo proveedor y se guardan pocos días.
2. **Copia diaria automática del portal**: hPanel → **Avanzado → Tareas Cron** → nueva tarea, una vez al día (por ejemplo a las 3:00), comando:
   ```
   /usr/bin/php /home/TU_USUARIO/domains/TU_DOMINIO/public_html/app/cli-respaldo.php
   ```
   (ajusta la ruta a donde subiste el portal; si `/usr/bin/php` no existe, usa el que indica hPanel). Cada noche crea un ZIP en `storage/backups/` y conserva los **últimos 14**. Esa carpeta no es accesible por internet.
3. **Copia fuera del servidor**: en el panel, **Ajustes → Respaldos** → **Descargar** el más reciente y guárdalo en tu PC o Google Drive **al menos una vez al mes** (si falla la cuenta de hosting, las copias que viven en ella también se pierden).

En **Ajustes → Respaldos** también puedes **Crear respaldo ahora** (por ejemplo antes de un cambio grande).

### Restaurar
- **Ajustes → Respaldos → Restaurar desde un archivo…** → elige el ZIP → escribe tu contraseña → **Restaurar todo**.
- Reemplaza **todos** los datos por los del respaldo y repone los archivos. Antes guarda automáticamente un respaldo del estado actual («Antes de restaurar» en la lista), por si te equivocaste de archivo.
- Solo acepta ZIP generados por el portal: cada imagen y fuente se valida y cualquier archivo extraño cancela la restauración sin tocar nada.
- **En un servidor nuevo**: sube el portal, crea el `.env` y un administrador (pasos 5 y 6), entra y restaura el ZIP; los usuarios del respaldo reemplazan al recién creado.

### Usar el respaldo en phpMyAdmin
El ZIP trae también **`database.sql`**: la misma información en SQL de MySQL. En phpMyAdmin → tu base → **Importar** → elige `database.sql` (descomprímelo antes). **Borra y vuelve a crear las tablas**, así que úsalo en una base vacía o que quieras reemplazar. Después sube la carpeta `uploads/` del ZIP a la carpeta del portal.

### Respaldo manual con phpMyAdmin (alternativa)
- Base: hPanel → **phpMyAdmin** → tu base → **Exportar** → *Rápido*, *SQL*. Archivos: descarga la carpeta `uploads/` desde el Administrador de archivos.
- Restaurar: importa el `.sql` en una base **vacía** y sube `uploads/` de nuevo.

---

## Problemas frecuentes

| Síntoma | Qué revisar |
|---|---|
| **Error 500** en todo el sitio | Versión de PHP menor a 8.1 (paso 2), o el hosting no tiene `mod_rewrite` (el `.htaccess` lo exige a propósito para no exponer archivos internos como `.env`). En Hostinger viene activo. Revisa también que el `.htaccess` no se haya dañado al editarlo. |
| `/c/CÓDIGO` muestra 404 | No se subió el `.htaccess` de la raíz (archivo oculto, paso 4.6) o el hosting no permite `mod_rewrite`. Mientras tanto funciona `cert.php?code=CÓDIGO`. |
| "Falta la configuración del portal (archivo .env)" | No existe el `.env` en la carpeta del portal o está mal nombrado (paso 5). |
| Error 500 al abrir el sitio tras crear el `.env` | Revisa base, usuario y clave (con el prefijo `u123456789_`); el servidor casi siempre es `localhost`. Detalle en `storage/error.log`. |
| "La imagen supera el máximo de 8 MB" o la subida falla | Sube `upload_max_filesize` y `post_max_size` (paso 2.4) o reduce el tamaño del molde. |
| No se ven las fuentes o el certificado sale en blanco | Limpia la caché del navegador (Ctrl+F5) y confirma que se subió la carpeta `assets/`. |
| Olvidé mi clave de administrador | `php app/cli-admin.php tu@correo.com "Tu Nombre"` (paso 6) o pide a otro administrador que te la cambie en **Usuarios**. |

## Seguridad: lista de comprobación final

- [ ] `.env` con permisos 640 y `APP_DEBUG="false"`.
- [ ] Sitio abre con `https://` (candado) y *Forzar HTTPS* activo.
- [ ] `https://tudominio/.env`, `https://tudominio/app/bootstrap.php` y `https://tudominio/database/certificados_mysql.sql` dan **403/404** (no se descargan).
- [ ] Clave de administrador de 10+ caracteres y única.
- [ ] Tienes un respaldo reciente de la base de datos y de `uploads/templates/`.

---

## Para quien mantiene el código

- Estructura MVC (PHP 8.1+ puro, PDO, sin Composer):
  ```
  index.php, cert.php     controladores frontales de las páginas públicas
  api/index.php           controlador frontal de la API JSON (despacha según app/routes.php)
  app/                    código de la aplicación (bloqueado desde la web)
    bootstrap.php         arranque: configuración (.env), errores, carga de núcleo y modelos
    routes.php            acción → [controlador, ¿escribe?]  (escribe = POST + CSRF)
    Core/                 util, db, http (respuestas, sesión, vistas), auth (CSRF, límites, login)
    Models/               settings, users, templates, courses, participants, certificates (acceso a datos y reglas)
    Controllers/          un archivo por recurso con funciones action_<acción>
    Views/public/         plantillas HTML de inicio y certificado
  admin/                  vista del panel (consume la API; sin compilación)
    index.html            solo el esqueleto: menú, contenedor y carga de js/main.js
    css/admin.css         estilos del panel
    js/main.js            arranque, menú y registro de pantallas
    js/core/              api.js (llamadas con CSRF) y ui.js (avisos, diálogos, paginación, escape)
    js/modules/           una carpeta por módulo: auth, usuarios, ajustes, moldes (lista, editor),
                          cursos (lista, formulario, detalle, participantes, importar, certificados, notas)
  assets/                 CSS, JS, fuentes y librerías (vendor/)
  .env                    configuración (se crea a partir de .env.example; no se descarga por URL)
  database/               esquema SQL
  storage/                error.log (y SQLite de pruebas)
  uploads/templates/      imágenes de moldes subidas
  ```
- Agregar una pantalla al panel: crear `admin/js/modules/<módulo>/<pantalla>.js` que exporte su función, importarla en `admin/js/main.js` y (si va en el menú) añadirla a `views` y un botón `data-view` en `index.html`.
- Agregar una acción a la API: escribir `action_<nombre>()` en el controlador y una línea en `app/routes.php`. Interfaz del panel en JavaScript sin compilación. Librerías en `assets/vendor/` (jsPDF, JSZip, SheetJS, qrcode-generator, pdf.js).
- Para armar el ZIP de despliegue, comprime la carpeta del proyecto **sin**: `.env`, `storage/error.log*`, `*.sqlite`, `uploads/templates/tpl_*`, `tests/`, `dist/` ni `.git/`. Incluye el `.htaccess` de la raíz (oculto) y los `.gitkeep` de `storage/` y `uploads/templates/`.
- Pruebas: `php tests/run.php` (servidor + SQLite temporal) y `node tests/ui.mjs` (Playwright; opcional `npm i axe-core` para la auditoría de accesibilidad).
- Desarrollo local: `php -S 127.0.0.1:8080 tests/router.php`.
- Decisiones tomadas y pendientes: ver `DECISIONES.md`.
