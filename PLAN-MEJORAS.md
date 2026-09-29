# NotesApp — análisis y planes de mejora

## Arquitectura revisada
- `server.js`: API Express, Markdown con YAML mediante gray-matter, carpetas, importación JSON, SM-2, cola intercalada, analítica y exportación.
- `public/app.js`: SPA sin framework; estado global, navegación, formularios, lectura, grafo Canvas y repaso.
- `public/i18n.js`: diccionarios ES/EN y prompts bilingües; `index.html` contiene la estructura; `style.css` define los temas y componentes.
- Las carpetas de almacenamiento usan nombres ingleses. Los campos JSON y los identificadores de notas conservan su formato para mantener compatibilidad con las notas existentes.

## Plan de diseño (propuesta, sin rediseño aplicado)
1. Simplificar Inicio: título breve, captura rápida, repasos pendientes y resumen de cantidades. Mover explicaciones extensas a bloques desplegables con títulos descriptivos; mantener toda la información accesible.
2. Ordenar navegación en Biblioteca, Aprendizaje y Herramientas. Diferenciar etiquetas de grupos y destinos; limitar contadores a los que permiten tomar decisiones.
3. Establecer una jerarquía tipográfica: cuerpo de 16 px, interlineado 1.5–1.7, textos largos con ancho de 65–75 caracteres; títulos de tres niveles y espaciado consistente de 8 px.
4. Reducir emojis, sombras, gradientes y acentos simultáneos. Usar un color principal para acciones y colores semánticos para estados, acompañados de texto.
5. Unificar tarjetas: título, resumen, fuente, etiquetas y fecha en el mismo orden; acciones secundarias agrupadas, acción principal visible.
6. Mantener lectura y edición diferenciadas; mostrar enlaces y referencias en una sección secundaria accesible. En repaso, priorizar pregunta, respuesta y calificación.
7. Adaptar navegación y cuadrículas a 360, 768 y 1440 px. Verificar teclado, foco visible, etiquetas accesibles, contraste y movimiento reducido en ambos temas.
8. Validar con tareas reales: capturar, localizar, editar, importar y repasar. Aceptación: ninguna información eliminada, sin desbordamiento horizontal, acciones reconocibles y textos legibles en ES/EN.

## Plan de revisión de errores
1. Ejecutar comprobaciones de sintaxis y pruebas existentes en un directorio temporal independiente.
2. Revisar creación, edición, movimiento y eliminación; datos ausentes, colisiones de destino y entradas que intenten salir de las carpetas.
3. Comprobar SM-2 con calificaciones válidas e inválidas y exportaciones desde subcarpetas.
4. Verificar idioma inicial, persistencia de preferencia, cambio ES/EN y coherencia entre selector, texto y copia de prompts.
5. Revisar manualmente formularios, búsqueda, grafo, importación y teclado en navegador, escritorio y móvil; registrar pasos y resultado esperado de cualquier fallo.
6. Ampliar pruebas de regresión solo cuando cubran fallos reproducibles. Ejecutar `npm test` antes de publicar cambios.

## Correcciones realizadas
- Nombre visible y metadatos actualizados a NotesApp; lanzador `iniciar-notesapp.bat`.
- Inglés predeterminado; conserva la selección previa de español del usuario.
- Prompts inglés/español compartidos entre estudio e importación; indicadores sincronizados y prompt duplicado eliminado.
- Versión inglesa independiente en `PROMPT-LLM-IMPORT-EN.md`.
- Rechazo de calificaciones no enteras o fuera del rango 0–5.
- Exportación de mapas ubicados en subcarpetas.
- Validación de datos de notas y rutas peligrosas antes de operar con archivos.
- Escritura en destino antes de eliminar el original al mover notas; rechazo de destinos existentes.
- Pruebas aisladas mediante `NOTESAPP_DATA_DIR`, sin modificar las notas reales.

## Límites y seguimiento
El idioma inicial y las cadenas ya internacionalizadas están en inglés. Persisten textos españoles incrustados en formularios, mensajes dinámicos, guía y respuestas del servidor: completar su extracción a los diccionarios requiere una revisión adicional de todas las vistas. El contenido personal de las notas no se traduce automáticamente. El plan visual está documentado; no se ha aplicado un rediseño ni verificado visualmente en navegador.

## Actualización: rediseño de Inicio aplicado
- Inicio prioriza un solo bloque de repaso, biblioteca compacta y accesos secundarios a importación y prompt.
- Toda la documentación anterior permanece en cuatro desplegables nativos: importación, almacenamiento, esquema JSON y metodología. Se conservan las seis carpetas, cuatro pasos y cinco filas del esquema.
- Menú con iconos SVG de línea, grupos Biblioteca/Aprendizaje/Herramientas y un único selector de idioma.
- Se ampliaron las traducciones de Inicio, formularios, ayudas, guía, tarjetas y mensajes dinámicos. Los documentos del usuario y los identificadores del formato de almacenamiento conservan su idioma original.
- Verificación en navegador: ES/EN, desplegables con teclado, navegación a biblioteca y repaso, temas claro/oscuro, escritorio de 1440 px y móvil de 390 px sin desbordamiento horizontal de Inicio; sin errores registrados en consola durante estas comprobaciones.
- Validación: todas las claves data-i18n de HTML tienen versión ES/EN; sintaxis JavaScript correcta; 39 comprobaciones de integración y regresiones adicionales pasan sobre datos temporales.
- Esta actualización sustituye la nota anterior sobre el rediseño pendiente. No se ha auditado exhaustivamente cada mensaje excepcional del servidor.

## Carpetas inglesas y ajustes de componentes
Las carpetas activas son `01-inbox`, `02-source-notes`, `03-atomic-notes`, `04-content-maps`, `05-self-assessment`, `06-spaced-repetition` y `_templates`. Servidor, documentación, interfaz ES/EN y pruebas apuntan a estos directorios. Se verificaron los hashes SHA-256 de los 31 archivos durante el traslado.

Botones con tamaño mínimo y esquinas uniformes; cabeceras que se adaptan sin comprimir acciones; filtros con ancho flexible; cuadrículas adaptables; calificaciones en dos filas en móvil; formularios y controles del grafo sin desbordamientos. Cambiar de sección devuelve su contenido al inicio. Verificación de las diez vistas a 390 y 1280 px, sin desbordamiento horizontal del contenedor principal.

## Knowledge Graph: revisión funcional y visual
- Separados el sistema de coordenadas de los nodos y la cámara: ampliar y desplazar ya no deforma la distribución ni aprisiona nodos contra los bordes.
- Ajuste de vista independiente del reinicio, zoom centrado en el cursor y dibujo adaptado a la densidad de píxeles y al tamaño del contenedor.
- Nueva distribución inicial, separación de nodos coincidentes y etiquetas que evitan superponerse. Los títulos completos siguen disponibles en la selección y en una lista de notas accesible con teclado.
- Seleccionar un nodo destaca sus conexiones y abre un panel con título, carpeta, etiquetas, notas relacionadas y razones completas. Desde él se abre la nota o se explora otra conexión.
- Filtros estrictos de tipo, etiqueta y búsqueda sin distinción de acentos; los nodos excluidos ya no reciben clics. Contador de resultados y mensajes específicos para grafo vacío, sin coincidencias o error de carga con reintento.
- Interacción unificada mediante Pointer Events para ratón y pantallas táctiles; captura y cancelación del arrastre; zoom y ajuste con teclado. Movimiento desactivado inicialmente si el sistema pide movimiento reducido.
- Controles y panel ES/EN. Explicación del método en un desplegable. Se conserva el contenido de las notas en su idioma original.
- API: las autorreferencias no generan conexiones ni inflan el grado de un nodo.
- Validación: ocho pruebas específicas (`npm run test:graph`), 39 comprobaciones de integración y regresiones adicionales (`npm test`). Navegador: filtros, búsqueda sin resultados y sin acentos, selección directa, arrastre, zoom, ajuste, apertura de notas, ES/EN, temas claro/oscuro y ancho móvil de 390 px. No se ha medido rendimiento con bibliotecas de miles de notas.

## Revisión final y distribución vacía (2026-09-29)
- Capturas con UUID; protección frente a IDs duplicados entre carpetas, procesamiento repetido e importaciones que sobrescriben notas. Validación del lote importado antes de escribir notas.
- Edición conserva metadatos y contenido omitido; las calificaciones actualizan también notas ubicadas en subcarpetas. Archivos escritos mediante sustitución desde un archivo temporal.
- Errores HTTP visibles en las operaciones del cliente; bloqueo de doble calificación; validación de pregunta/respuesta incompletas; etiquetas escapadas para evitar ejecutar contenido como JavaScript.
- Cola pendiente separada de la práctica voluntaria; biblioteca vacía sin historial ni métricas de retención inventadas. Mensajes de confirmación y asistente Feynman localizados.
- Servidor limitado al equipo local y API protegida frente a orígenes externos. Lanzador Windows independiente del directorio desde el que se inicia.
- Eliminados 26 archivos de notas, preguntas y repaso, sus subcarpetas y tres capturas antiguas. Se conservan las seis carpetas raíz y cinco plantillas.
- Pruebas aisladas con datos sintéticos (sin copiar notas personales): 39 comprobaciones de integración, ocho pruebas del grafo y regresiones de validación, duplicados, conservación de datos, cola, subcarpetas e idiomas.
- Revisadas las diez secciones vacías en navegador. Esta entrega prepara una distribución local; no incluye despliegue público ni autenticación multiusuario.
