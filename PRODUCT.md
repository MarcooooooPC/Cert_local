# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- **Personal administrativo de una institución educativa**: crea cursos y talleres, importa participantes desde Excel, diseña moldes de certificado, emite, revoca y descarga certificados (PDF individual o ZIP masivo). Usa el panel de administración en escritorio, en sesiones de trabajo por tarea.
- **Público que verifica**: empleadores, instituciones y egresados que ingresan el código de 12 caracteres o escanean el QR del certificado para comprobar su validez, normalmente desde el celular.

## Product Purpose
Portal para emitir certificados de cursos y talleres y permitir su verificación pública en tiempo real. Éxito: la institución emite lotes de certificados sin ayuda técnica y cualquier tercero confirma en segundos si un certificado es auténtico, vigente o revocado.

## Positioning
La verificación pública con código y QR es el diferencial: cada certificado lleva un código único y un QR que apunta a una página de verificación en vivo que distingue vigente, revocado y no encontrado. Se instala en hosting compartido (Hostinger) sin programar.

## Operating Context
- Instalación en hosting compartido (PHP 8.1+, MySQL; SQLite solo para pruebas) con `.env`, creación automática de tablas y guía paso a paso.
- Flujo: curso → participantes (importación Excel/CSV con vista previa) → molde (imagen de fondo + campos arrastrables + QR) → emisión → PDF generado en el navegador.
- Documentos en español (es-PE); fechas largas; DNI de 8 dígitos u otros documentos.

## Capabilities and Constraints
- Cursos y talleres, con o sin notas (componentes: asistencia, talleres, exámenes modulares, examen final, con pesos que suman 100 %).
- Moldes con editor visual; revocar y restaurar certificados; enlace público `{URL base}/c/CÓDIGO`.
- Sin dependencias externas: CSP estricta, sin CDN ni fuentes remotas (fuentes y librerías locales en `assets/`).
- Nombre del sitio e identidad configurables desde Ajustes; no hay marca fija del producto.
- Pendiente de definir por el cliente: qué pasa con los desaprobados al emitir (ver DECISIONES.md).

## Brand Commitments
Ninguna marca fija. El nombre del sitio viene de Ajustes y la identidad visual debe poder convivir con la de distintas instituciones.

## Evidence on Hand
Sin testimonios, clientes ni métricas reales. No inventarlos. Existen datos de ejemplo solo en `pantallas.html` (maqueta).

## Product Principles
1. La confianza de la verificación pública va primero: el estado del certificado (vigente, revocado, no encontrado) debe leerse sin ambigüedad.
2. Quien administra no es técnico: cada tarea se resuelve en pocos pasos, con vista previa antes de confirmar lo irreversible.
3. Funciona sin servicios externos y en hosting básico.
4. Identidad neutra y configurable: el producto no impone una marca.

## Accessibility & Inclusion
Español (Perú). Mantener foco visible, navegación por teclado, lectores de pantalla y tema claro (el modo oscuro no está implementado).
