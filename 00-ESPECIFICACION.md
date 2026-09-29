# Especificación de aplicación — sistema de notas basado en evidencia

> Documento dirigido a un agente de desarrollo (p. ej. Antigravity). Define qué construir, el modelo de datos, las reglas de negocio derivadas de evidencia científica, y trae datos de ejemplo (seed data) ya cargados en las carpetas 01–06 y `_templates/` de este mismo paquete.

## 1. Qué construir

Una app de notas **local-first**, sobre archivos de texto plano (`.md` + frontmatter YAML). No es un editor genérico: cada tipo de nota cumple un rol funcional específico (ver `sistema-notas-basado-evidencia.md` para el respaldo de investigación completo) y la app debe **hacer cumplir el flujo** entre esos roles, no solo almacenarlos.

## 2. Modelo de datos

Campos comunes a todo archivo `.md`:

| Campo | Tipo | Notas |
|---|---|---|
| `id` | string (slug único) | usado en los enlaces `[[id]]` |
| `titulo` | string | |
| `tipo` | enum | `bandeja` \| `fuente` \| `atomica` \| `mapa` |
| `creado` | fecha ISO | |
| `enlaces` | lista de `id` | notas relacionadas |

Campos adicionales por tipo:

- **bandeja**: `procesada: bool` (default `false`)
- **fuente**: `autor`, `tipo_fuente` (libro/articulo/video/podcast), `ideas_disparadas: [id...]`
- **atomica**: `fuente: id | null`, secciones de contenido fijas: *Idea*, *Por qué importa*, *Cómo se conecta*
- **mapa**: `subtemas: [{ nota_id, razon }]`

Cada nota `atomica` tiene **1 archivo de pregunta asociado** en `05-self-assessment/`, con:

| Campo | Tipo |
|---|---|
| `nota_id` | id de la nota atómica |
| `pregunta` / `respuesta` | string |
| `ease_factor` | float, default `2.5` |
| `intervalo_dias` | int, default `1` |
| `proxima_revision` | fecha ISO |
| `historial` | lista de `{fecha, acierto: bool}` |

## 3. Funcionalidades obligatorias (y de qué evidencia salen)

1. **Captura rápida** en `01-inbox/` — sin campos obligatorios más allá de `creado`. *(fricción cero en el momento de capturar)*
2. **Flujo "Procesar"**: convierte una nota de bandeja en `fuente` y/o `atomica`. El campo *Idea (con tus palabras)* de una nota atómica **no debe poder rellenarse por copiar/pegar directo** desde el campo de la fuente — ver §4. *(efecto de generación / toma de notas generativa)*
3. **Autolinking**: al escribir `[[texto]]` se autocompleta contra notas atómicas existentes y se generan backlinks automáticos y bidireccionales.
4. **Generador de preguntas**: botón "crear pregunta" en cada nota atómica → crea el archivo asociado en `05-self-assessment/`. *(recuperación activa / practice testing)*
5. **Motor de repaso espaciado + intercalado** (algoritmo en §5–6). *(repetición espaciada + interleaving)*
6. **Mapas de contenido**: enlazar notas atómicas exige rellenar un campo `razon` — no se permite un enlace sin explicar por qué se relaciona. *(organización tipo outline/matriz, Kiewra et al. 1991)*
7. **Backlinks** visibles en cada nota atómica.
8. **Búsqueda** full-text + filtro por `tipo` / tag.

## 4. Reglas anti-copia (function de codificación)

- El campo *Idea (con tus palabras)* del editor de nota atómica debe desincentivar pegar texto literal de la fuente (deshabilitar pegado en ese campo, o resaltar en rojo fragmentos idénticos al origen).
- Opcional: calcular % de solapamiento de n-gramas entre la nota fuente vinculada y la nota atómica; avisar si supera ~30%.

## 5. Algoritmo de repaso (SM-2, simplificado)

Al calificar un repaso con `q` de 0 a 5 (0 = fallo total, 5 = perfecto):

```
si q < 3:
    repeticiones = 0
    intervalo_dias = 1
si q >= 3:
    si repeticiones == 0: intervalo_dias = 1
    si repeticiones == 1: intervalo_dias = 6
    si repeticiones > 1:  intervalo_dias = round(intervalo_dias_anterior * ease_factor)
    repeticiones += 1

ease_factor = max(1.3, ease_factor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)))
proxima_revision = hoy + intervalo_dias
```

(SM-2 es un algoritmo público y ampliamente documentado; FSRS es una alternativa moderna si se busca mayor precisión.)

## 6. Interleaving de la cola de repaso

Al construir la cola diaria (`06-spaced-repetition/cola-repaso.md`):

1. Filtrar preguntas con `proxima_revision <= hoy`.
2. Agrupar por tema (heurística: mapa de contenido padre, o primer tag).
3. Intercalar round-robin entre grupos — nunca presentar dos preguntas seguidas del mismo tema si hay alternativa disponible.

## 7. Fuera de alcance (sin evidencia que lo respalde)

- Modo "resaltar texto" como función principal.
- Vista de solo relectura sin recuperación activa.
- Mnemotecnia de palabra clave automática.
- Cualquier diseño que priorice "cantidad de notas" sobre generación propia y repaso.

## 8. Estructura de archivos (ya poblada en este paquete como datos de ejemplo)

```
note-app-spec/
├── 00-ESPECIFICACION.md
├── 01-inbox/
├── 02-source-notes/
├── 03-atomic-notes/
├── 04-content-maps/
├── 05-self-assessment/
├── 06-spaced-repetition/
└── _templates/
```

## 9. Datos de ejemplo (seed / fixtures)

Las carpetas 01–06 contienen un caso de uso real y coherente entre sí: una nota fuente (`fuente-dunlosky-2013`) dispara dos notas atómicas (`atomica-efecto-generacion`, `atomica-repeticion-espaciada`), ambas enlazadas desde un mapa de contenido, cada una con su pregunta de autoevaluación, y ambas aparecen ya en la cola de repaso — útil para pruebas end-to-end del flujo completo.
