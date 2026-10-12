// ========================================================
// NotesApp — Sistema de Internacionalización (i18n)
// Soporte Bilingüe: Español (ES) & Inglés (EN)
// ========================================================

const MASTER_LLM_PROMPT_ES = `Eres un especialista de élite en Ciencias Cognitivas y Arquitectura de Gestión de Conocimiento basado en Evidencia, operando bajo las reglas del sistema NotesApp.

Tu misión es recibir la documentación, texto o transcripción adjunta, analizarla exhaustivamente y extraer una red estructurada de conocimiento compuesta por:
1. Notas Fuente (notas_fuente): Síntesis bibliográfica del material de origen.
2. Notas Atómicas (notas_atomicas): Unidades conceptuales indivisibles reformuladas generativamente en palabras propias.
3. Autoevaluación Activa (autoevaluacion): Flashcards de práctica de recuperación (practice testing) para el algoritmo SM-2.
4. Mapas de Contenido (mapas_contenido): Organizadores temáticos jerárquicos con justificación relacional obligatoria.
5. Carpetas y Hashtags (carpetas y tags): Organización temática limpia.

REGLAS PEDAGÓGICAS Y DE ESTRUCTURACIÓN:

1. Principio de Atomicidad Estricta:
   - Cada nota atómica debe contener EXACTAMENTE UNA SOLA IDEA O CONCEPTO AUTÓNOMO. Si un párrafo contiene dos ideas distintas, crea dos notas atómicas separadas.
   - Efecto de Generación: La explicación en el campo 'idea' debe estar redactada en palabras propias con profundidad y claridad conceptual. NUNCA copies ni pegues frases literales del texto original. Explica el mecanismo subyacente.
   - Cada nota atómica debe explicar explícitamente:
     - 'idea': Definición y desarrollo conceptual en palabras propias.
     - 'por_que_importa': Relevancia práctica, impacto o fundamentación explicativa.
     - 'como_se_conecta': Cómo interactúa o complementa a otras ideas, usando wikilinks [[slug-de-otra-nota]].

2. Práctica de Recuperación Activa Obligatoria (Flashcards SM-2):
   - TODA nota atómica DEBE tener su objeto 'autoevaluacion'.
   - 'pregunta': Pregunta abierta y desafiante que obligue al cerebro a reconstruir el concepto mentalmente (evita preguntas triviales de sí/no o verdadero/falso).
   - 'respuesta': Respuesta concisa, precisa y auto-contenida con la clave conceptual.

3. Mapas de Contenido y Justificación Relacional:
   - Todo mapa de contenido agrupa notas atómicas bajo un paraguas temático estructurado.
   - REGLA OBLIGATORIA: Cada subtema en 'subtemas' DEBE tener un campo 'razon' que explique clara y específicamente POR QUÉ esa nota atómica pertenece y aporta a ese mapa temático. Enlaces sin razón serán rechazados.

4. Identificadores (Slugs):
   - Los 'id' deben ser slugs limpios en minúsculas con guiones (p. ej. fuente-autor-ano, atomica-concepto-clave, mapa-tema-general).
   - Prefijos obligatorios: 'fuente-' para fuentes, 'atomica-' para atómicas, 'mapa-' para mapas.

5. Maximización del Rendimiento de Extracción y Flashcards de Alta Calidad:
   - Extrae el MÁXIMO número posible de notas atómicas y flashcards. Apunta a generar entre 8 y 20 notas atómicas por cada fuente procesada (o más según la densidad del texto).
   - CADA nota atómica DEBE tener obligatoriamente su flashcard de autoevaluación ('autoevaluacion'). No dejes ninguna nota sin pregunta de repaso.
   - Diseña preguntas de autoevaluación diversas y profundas:
     * Mecanismos ("¿Cómo opera el mecanismo X y qué lo activa?")
     * Causa-Efecto ("¿Por qué ocurre Y cuando se modifica X?")
     * Discriminación conceptual ("¿En qué se diferencia el concepto A del concepto B?")
     * Aplicación práctica ("¿Cómo se aplicaría este principio en un escenario real?")
   - Las respuestas ('respuesta') deben ser sustanciales (2-4 oraciones) con la clave conceptual completa, no respuestas telegráficas.
   - Crea MÚLTIPLES mapas de contenido si el texto abarca varias dimensiones, agrupando los conceptos en subtemas organizados.
   - Conecta activamente las ideas mediante wikilinks [[atomica-slug]] en 'como_se_conecta' y en el array 'enlaces' para construir un grafo denso.
   - Cada campo 'idea' debe tener de 3 a 6 oraciones de desarrollo conceptual profundo y autónomo.

6. Creación Automática y Organización por Campo y Proyecto / Curso:
   - Aunque el usuario aún no haya creado ningún proyecto en NotesApp, el JSON importado creará o actualizará automáticamente el proyecto si defines sus metadatos en la raíz del JSON.
   - Identifica el campo de conocimiento general (p. ej. "Inteligencia Artificial", "Psicología Cognitiva", "Filosofía") y decláralo en el campo raíz 'campo' y en cada nota.
   - Identifica el proyecto, curso o temática específica (p. ej. "AI Agents and Automations", "Técnicas de Estudio") y decláralo en el campo raíz 'proyecto' y en cada nota.
   - Declara en la raíz del JSON 'proyecto_tipo' eligiendo exactamente uno de: "curso", "noticias", "investigacion", "libro", "trabajo", "otro" según la naturaleza del material.
   - Declara en la raíz del JSON 'proyecto_descripcion' con una síntesis clara de 1 a 2 oraciones que describa el propósito, alcance o temario del proyecto/curso.
   - Si el material corresponde a una clase, módulo o entrega incremental, incluye también 'leccion_numero' (número entero, p. ej. 1) y 'leccion_titulo' (título de la lección o entrega).

7. Búsqueda y Validación Externa en Google para cada Concepto:
   - Para cada nota atómica y nota fuente, DEBES incluir el campo 'busqueda_google' con una consulta de búsqueda precisa y optimizada para consultar en Google (p. ej. "Patrones de orquestación multi-agente arquitecturas IA", "Active recall testing cognitive psychology").
   - Esto permite al usuario contrastar, expandir y profundizar en la literatura externa con un solo clic.

8. Continuidad e Integración Incremental con Notas Existentes del Proyecto:
   - Si al final de este prompt se incluye una lista de notas atómicas ya existentes en el proyecto, DEBES mantener exactamente los mismos valores de 'campo' y 'proyecto', e incluir enlaces explícitos [[atomica-id-existente]] tanto en el texto de 'como_se_conecta' como en el array 'enlaces' de las nuevas notas atómicas siempre que exista relación conceptual.

FORMATO JSON REQUERIDO (SCHEMA ESTRICTO):

Debes responder ÚNICAMENTE con un bloque JSON válido (sin saludos, sin explicaciones introductorias ni notas finales) respetando exactamente la siguiente estructura:

{
  "version": "1.0",
  "language": "es",
  "campo": "Inteligencia Artificial",
  "proyecto": "AI Agents and Automations",
  "proyecto_tipo": "curso",
  "proyecto_descripcion": "Curso sobre arquitectura, memoria, herramientas y orquestación de agentes autónomos basados en modelos de lenguaje.",
  "leccion_numero": 1,
  "leccion_titulo": "Fundamentos y Arquitectura de Agentes",
  "notas_fuente": [
    {
      "id": "fuente-nombre-documento",
      "titulo": "Título de la Obra o Documento",
      "autor": "Nombre del autor o institución",
      "tipo_fuente": "libro",
      "campo": "Inteligencia Artificial",
      "proyecto": "AI Agents and Automations",
      "tags": ["etiqueta1", "etiqueta2"],
      "busqueda_google": "Título de la Obra Autor",
      "puntos_clave": "Resumen conciso y parafraseado de las tesis centrales del documento.",
      "citas_textuales": [
        "Cita literal textual representativa 1"
      ],
      "ideas_disparadas": [
        "atomica-concepto-uno",
        "atomica-concepto-dos"
      ]
    }
  ],
  "notas_atomicas": [
    {
      "id": "atomica-concepto-uno",
      "titulo": "Nombre Claro y Declarativo de la Primera Idea",
      "fuente": "fuente-nombre-documento",
      "campo": "Inteligencia Artificial",
      "proyecto": "AI Agents and Automations",
      "tags": ["etiqueta1", "etiqueta3"],
      "busqueda_google": "Nombre Claro y Declarativo de la Primera Idea",
      "idea": "Explicación completa, rigurosa y redactada enteramente en palabras propias de la idea central. Debe ser autónoma y comprensible por sí misma.",
      "por_que_importa": "Por qué este concepto es fundamental, qué consecuencias prácticas tiene o qué mecanismo explica.",
      "como_se_conecta": "Conecta directamente con [[atomica-concepto-dos]] y con los principios generales del tema.",
      "enlaces": ["atomica-concepto-dos"],
      "autoevaluacion": {
        "pregunta": "¿Cuál es el mecanismo principal de este concepto y cómo opera?",
        "respuesta": "La clave reside en [Respuesta precisa y concreta con desarrollo explicativo completo]."
      }
    },
    {
      "id": "atomica-concepto-dos",
      "titulo": "Segundo Concepto Clave Derivado o Complementario",
      "fuente": "fuente-nombre-documento",
      "campo": "Inteligencia Artificial",
      "proyecto": "AI Agents and Automations",
      "tags": ["etiqueta2", "etiqueta4"],
      "busqueda_google": "Segundo Concepto Clave Derivado o Complementario",
      "idea": "Desarrollo detallado en palabras propias del segundo concepto encontrado. Explicación del mecanismo subyacente con profundidad suficiente para ser autónoma.",
      "por_que_importa": "Complementa directamente al primer concepto porque amplía el alcance explicativo del fenómeno.",
      "como_se_conecta": "Se relaciona con [[atomica-concepto-uno]] como extensión práctica y con [[atomica-concepto-tres]] por analogía funcional.",
      "enlaces": ["atomica-concepto-uno"],
      "autoevaluacion": {
        "pregunta": "¿Cómo se diferencia este segundo concepto del primero y qué aporta de nuevo?",
        "respuesta": "La diferencia fundamental radica en [respuesta precisa]. Su aporte clave es [desarrollo explicativo]."
      }
    }
  ],
  "mapas_contenido": [
    {
      "id": "mapa-tema-central",
      "titulo": "Organizador Conceptual del Tema",
      "campo": "Inteligencia Artificial",
      "proyecto": "AI Agents and Automations",
      "tags": ["sintesis", "etiqueta1"],
      "descripcion": "Visión panorámica de la jerarquía temática y cómo se integran las partes.",
      "subtemas": [
        {
          "nota_id": "atomica-concepto-uno",
          "razon": "Constituye el fundamento biológico y conceptual del que parten el resto de las técnicas."
        },
        {
          "nota_id": "atomica-concepto-dos",
          "razon": "Aplica de manera concreta los principios fundamentales derivados de la primera idea."
        }
      ]
    }
  ]
}

A continuación se adjunta la documentación a procesar:

[PEGA AQUÍ TU DOCUMENTACIÓN O TEXTO]`;

const MASTER_LLM_PROMPT_EN = `You are an elite specialist in Cognitive Science and Evidence-Based Knowledge Management Architecture, operating strictly under the rules of the NotesApp system.

Your mission is to receive the attached documentation, text, or transcript, analyze it thoroughly, and extract a structured knowledge network composed of:
1. Source Notes (notas_fuente): Bibliographic synthesis of the source material.
2. Atomic Notes (notas_atomicas): Indivisible conceptual units generatively rephrased in your own words.
3. Active Recall Flashcards (autoevaluacion): Practice testing items designed for the SM-2 spaced repetition algorithm.
4. Content Maps (mapas_contenido): Hierarchical thematic organizers with mandatory relational justifications.
5. Folders and Hashtags (carpetas and tags): Clean thematic organization.

PEDAGOGICAL AND STRUCTURAL RULES:

1. Strict Atomicity Principle:
   - Each atomic note MUST contain EXACTLY ONE AUTONOMOUS IDEA OR CONCEPT. If a paragraph discusses two distinct ideas, create two separate atomic notes.
   - Generation Effect: The explanation in the 'idea' field MUST be written in your own words with conceptual depth. NEVER copy-paste verbatim sentences from the original source. Explain the underlying mechanism.
   - Each atomic note must explicitly address:
     - 'idea': Rigorous conceptual definition and development in your own words.
     - 'por_que_importa': Practical significance, impact, or explanatory foundation.
     - 'como_se_conecta': How it interacts or connects with other ideas, using wikilinks [[slug-of-other-note]].

2. Mandatory Active Recall Testing (SM-2 Flashcards):
   - EVERY atomic note MUST contain an 'autoevaluacion' object.
   - 'pregunta': Open, challenging retrieval question that forces the brain to mentally reconstruct the concept (avoid trivial yes/no or true/false questions).
   - 'respuesta': Concise, precise, and self-contained answer with the key mechanism.

3. Content Maps and Mandatory Relational Reasoning:
   - Every content map groups atomic notes under a structured thematic umbrella.
   - MANDATORY RULE: Every subtopic in 'subtemas' MUST have a 'razon' field explaining clearly and specifically WHY that atomic note belongs to and enriches this thematic map. Links without a reason will be rejected.

4. Identifiers (Slugs):
   - The 'id' fields must be clean lowercase hyphenated slugs (e.g., fuente-author-year, atomica-key-concept, mapa-general-theme).
   - Mandatory prefixes: 'fuente-' for sources, 'atomica-' for atomic notes, 'mapa-' for content maps.

5. Extraction Yield Maximization and High-Quality Flashcards:
   - Extract the MAXIMUM possible number of atomic notes and flashcards. Aim to generate between 8 and 20 atomic notes per processed source (or more depending on text density).
   - EVERY atomic note MUST include its self-assessment flashcard ('autoevaluacion'). Never leave any note without a practice question.
   - Design varied, high-yield active retrieval questions:
     * Underlying mechanisms ("What is the mechanism of X and how does it operate?")
     * Cause-and-Effect ("Why does Y occur when X is modified?")
     * Conceptual discrimination ("How does concept A differ from concept B?")
     * Applied problem-solving ("How would this principle be applied in a concrete scenario?")
   - Answers ('respuesta') must be substantial (2-4 sentences) containing the full conceptual explanation, not telegraphic fragments.
   - Create MULTIPLE content maps if the material covers different dimensions, structuring concepts into distinct thematic hierarchies.
   - Actively cross-link ideas using wikilinks [[atomica-slug]] in 'como_se_conecta' and the 'enlaces' array to build a dense knowledge graph.
   - Each 'idea' field must provide 3 to 6 sentences of deep, self-contained conceptual development.

6. Automatic Creation and Organization by Knowledge Field and Project / Course:
   - Even if the user has not created any project in NotesApp yet, the imported JSON will automatically create or update the project when you define its metadata at the root of the JSON.
   - Identify the overarching field of knowledge (e.g., "Artificial Intelligence", "Cognitive Psychology", "Philosophy") and assign it to the root 'campo' field and to each note.
   - Identify the specific project, course, book, or theme (e.g., "AI Agents and Automations", "Study Techniques") and assign it to the root 'proyecto' field and to each note.
   - Declare 'proyecto_tipo' at the JSON root, choosing exactly one of: "curso", "noticias", "investigacion", "libro", "trabajo", "otro" based on the nature of the material.
   - Declare 'proyecto_descripcion' at the JSON root with a clear 1-to-2 sentence summary describing the project or course's scope, goals, or syllabus.
   - If the material is part of a course, module, or sequential series, also include 'leccion_numero' (integer, e.g., 1) and 'leccion_titulo' (title of the lesson or module).

7. External Google Search Query for Every Concept:
   - For every atomic note and source note processed, you MUST include a 'busqueda_google' (or 'google_search') field with a precise, optimized search query for Google (e.g., "Multi-agent orchestration patterns AI architectures", "Active recall testing cognitive psychology").
   - This enables the user to verify, expand, and dive deeper into external literature with a single click.

8. Continuity and Incremental Connection with Existing Project Notes:
   - If a list of existing atomic notes in the project is provided at the end of this prompt, you MUST keep the exact same 'campo' and 'proyecto' names, and include explicit [[existing-atomica-id]] wikilinks in both 'como_se_conecta' and the 'enlaces' array of the new atomic notes whenever a conceptual connection exists.

REQUIRED JSON FORMAT (STRICT SCHEMA):

Respond ONLY with a valid JSON block (no greetings, no markdown chat explanations, no closing notes) strictly adhering to the following structure:

{
  "version": "1.0",
  "language": "en",
  "campo": "Artificial Intelligence",
  "proyecto": "AI Agents and Automations",
  "proyecto_tipo": "curso",
  "proyecto_descripcion": "Course on the architecture, memory, tool use, and orchestration of autonomous LLM-based AI agents.",
  "leccion_numero": 1,
  "leccion_titulo": "Foundations and Agent Architecture",
  "notas_fuente": [
    {
      "id": "fuente-document-name",
      "titulo": "Title of Work or Document",
      "autor": "Author or Institution Name",
      "tipo_fuente": "libro",
      "campo": "Artificial Intelligence",
      "proyecto": "AI Agents and Automations",
      "tags": ["tag1", "tag2"],
      "busqueda_google": "Title of Work Author",
      "puntos_clave": "Concise paraphrased summary of the document's central theses.",
      "citas_textuales": [
        "Representative verbatim quotation 1"
      ],
      "ideas_disparadas": [
        "atomica-concept-one",
        "atomica-concept-two"
      ]
    }
  ],
  "notas_atomicas": [
    {
      "id": "atomica-concept-one",
      "titulo": "Clear Declarative Idea Title for First Concept",
      "fuente": "fuente-document-name",
      "campo": "Artificial Intelligence",
      "proyecto": "AI Agents and Automations",
      "tags": ["tag1", "tag3"],
      "busqueda_google": "Clear Declarative Idea Title for First Concept",
      "idea": "Comprehensive, rigorous explanation written entirely in your own words. It must be autonomous and understandable on its own with 3-5 sentences of depth.",
      "por_que_importa": "Why this concept is fundamental, its practical implications, or what mechanism it explains.",
      "como_se_conecta": "Directly connects with [[atomica-concept-two]] and the overarching principles of the topic.",
      "enlaces": ["atomica-concept-two"],
      "autoevaluacion": {
        "pregunta": "What is the core mechanism of this concept and how does it operate?",
        "respuesta": "The key lies in [Precise and concrete conceptual answer with full explanatory development]."
      }
    },
    {
      "id": "atomica-concept-two",
      "titulo": "Second Derived or Complementary Key Concept",
      "fuente": "fuente-document-name",
      "campo": "Artificial Intelligence",
      "proyecto": "AI Agents and Automations",
      "tags": ["tag2", "tag4"],
      "busqueda_google": "Second Derived or Complementary Key Concept",
      "idea": "Detailed development in your own words of the second concept found. Explanation of the underlying mechanism with sufficient depth to stand on its own.",
      "por_que_importa": "Directly complements the first concept by expanding the explanatory scope of the phenomenon.",
      "como_se_conecta": "Relates to [[atomica-concept-one]] as a practical extension and to [[atomica-concept-three]] through functional analogy.",
      "enlaces": ["atomica-concept-one"],
      "autoevaluacion": {
        "pregunta": "How does this second concept differ from the first and what new insight does it provide?",
        "respuesta": "The fundamental difference lies in [precise answer]. Its new contribution is [specific explanatory contribution]."
      }
    }
  ],
  "mapas_contenido": [
    {
      "id": "mapa-central-theme",
      "titulo": "Conceptual Theme Organizer",
      "campo": "Artificial Intelligence",
      "proyecto": "AI Agents and Automations",
      "tags": ["synthesis", "tag1"],
      "descripcion": "Panoramic view of the thematic hierarchy and how the components integrate.",
      "subtemas": [
        {
          "nota_id": "atomica-concept-one",
          "razon": "Constitutes the biological and conceptual foundation from which the remaining techniques branch."
        },
        {
          "nota_id": "atomica-concept-two",
          "razon": "Applies the fundamental principles in a practical domain to bridge theory and practice."
        }
      ]
    }
  ]
}

Attached is the documentation to process:

[PASTE YOUR DOCUMENTATION OR TEXT HERE]`;

const I18N = {
  es: {
    // App & Nav
    appName: "NotesApp",
    appSubtitle: "Evidencia Científica",
    navHome: "Inicio",
    navInbox: "Bandeja de Entrada",
    navAtomicas: "Notas Atómicas",
    navFuentes: "Notas Fuente",
    navMapas: "Mapas de Contenido",
    navRepaso: "Repaso Espaciado",
    navGrafo: "Grafo de Red",
    navAnalitica: "Analítica de Retención",
    navLlm: "Asistente LLM & Prompt",
    navGuia: "Guía & Evidencia",
    evidencePillText: "Práctica distribuida + Recuperación activa",
    toggleTheme: "Alternar tema (Claro / Oscuro / Pastel)",
    themeLight: "Claro",
    themeDark: "Oscuro",
    themePastel: "Pastel",

    // Header
    quickCapturePlaceholder: "Captura rápida sin fricción... (Escribe y presiona Enter)",
    quickCaptureBtn: "Capturar",
    btnImportJson: "📥 Importar JSON",
    btnSearchTooltip: "Buscar en todas las notas (Ctrl + K)",
    btnReviewHeader: "🧠 Repasar hoy",

    // Common
    close: "Cerrar",
    cancel: "Cancelar",
    save: "Guardar",
    saveChanges: "Guardar Cambios",
    delete: "Eliminar",
    edit: "Editar",
    filterAllFolders: "Todas las carpetas",
    filterAllTags: "Todos los hashtags",
    all: "Todas",
    newFolder: "Nueva Carpeta",
    newNote: "Nueva Nota",
    editFolder: "Editar Carpeta",
    renameFolder: "Renombrar Carpeta",
    changeFolderColor: "Cambiar Color",
    moveFolder: "Mover Carpeta",
    deleteFolder: "Eliminar Carpeta",
    newSubfolder: "Nueva Subcarpeta",
    folderColorLabel: "Color de la carpeta",
    parentFolderLabel: "Carpeta superior",
    rootFolderLabel: "Raíz (sin carpeta superior)",
    confirmDeleteFolder: "¿Seguro que deseas eliminar esta carpeta? Las notas se conservarán y se moverán a la raíz.",
    folderRenamedSuccess: "Carpeta renombrada con éxito",
    folderMovedSuccess: "Carpeta movida con éxito",
    folderColorSuccess: "Color de carpeta actualizado con éxito",
    folderDeletedSuccess: "Carpeta eliminada con éxito",
    loading: "Cargando...",
    viewCards: "Tarjetas",
    viewMatrix: "Matriz Conceptual",
    copy: "Copiar",
    copied: "Copiado",
    foldersCollections: "Carpetas y Colecciones",
    searchFoldersPlaceholder: "Buscar carpetas...",
    allSources: "Todas las Fuentes",
    allNotes: "Todas las Notas",
    sourcesArticles: "Notas",
    sourcesDocuments: "Documentos",
    sourcesVideos: "Videos",
    filterFlashcards: "Flashcards",
    filterConnected: "Conectadas",
    sortNewest: "↕ Más recientes primero",
    sortOldest: "↕ Más antiguas primero",
    sortTitle: "↕ Título (A-Z)",
    openSource: "Abrir Fuente",
    openNote: "Abrir Nota",
    connectedAtomicNotes: "Notas Atómicas Conectadas",
    connectedNotes: "Notas Conectadas",

    // Proyectos y Campos
    scopeSelectorTooltip: "Filtrar por Campo / Curso o Proyecto",
    scopeAllProjects: "🌐 Todos los Campos y Proyectos",
    btnManageProjectsTooltip: "Gestionar Campos y Proyectos",
    activeScopeLabel: "Área activa",
    btnClearScope: "Mostrar todo",
    btnClearScopeTooltip: "Limpiar filtro (mostrar todas las notas)",
    projectManagerTitle: "🎯 Gestor de Campos y Proyectos",
    projectManagerDesc: "Organiza y enfoca tu aprendizaje por Campo de Conocimiento (Área general) y Proyecto o Curso específico.",
    pmCreateTitle: "➕ Registrar Nuevo Proyecto / Curso",
    fieldLabel: "Campo / Área",
    fieldPlaceholder: "e.g. Inteligencia Artificial, Filosofía",
    projectLabel: "Proyecto / Curso",
    projectPlaceholder: "e.g. AI Agents and Automations",
    descriptionLabel: "Descripción (opcional)",
    btnCreateProject: "Crear Proyecto",
    pmExistingTitle: "Proyectos y Cursos Registrados",
    pmNoProjects: "Aún no hay proyectos registrados. Crea uno arriba.",
    pmStatsNotes: "notas",
    pmStatsReviews: "repasos",
    scopeActivePill: "Enfoque",
    reviewScopeAll: "Repasar todo el vault",
    projectTypeLabel: "Tipo de Proyecto",
    typeCurso: "🎓 Curso / Formación",
    typeNoticias: "📰 Noticias / Actualidad",
    typeInvestigacion: "🔬 Investigación / Estudio",
    typeLibro: "📖 Libro / Lectura",
    typeTrabajo: "💼 Trabajo / Proyecto Profesional",
    typeOtro: "📂 Otro / General",
    editProject: "Editar",
    editProjectTitle: "✏️ Editar Proyecto",
    btnSaveProject: "Guardar Cambios",
    btnDeleteProject: "Eliminar Proyecto",
    confirmDeleteProject: "¿Estás seguro de que deseas eliminar este proyecto de la lista? Sus notas se conservarán.",
    projectStatus: "Estado del Proyecto",
    statusActive: "Activo",
    statusCompleted: "Completado",
    courseLessonsCount: "Lecciones",
    courseLessonsCountSuffix: "registradas",
    courseLessonMode: "Modo Lección Continua de Curso",
    courseLessonDesc: "Las notas de esta lección se añadirán al mapa maestro del curso y se conectarán con conceptos previos.",
    lessonNumberLabel: "Lección Nº",
    lessonTitleLabel: "Título de la Lección",
    courseCompletedCheckbox: "Marcar curso como completado tras esta lección",
    quickProjectTitle: "➕ Nuevo Proyecto",
    quickProjectDesc: "Crea un nuevo proyecto para organizar y clasificar tus notas.",
    btnCreateAndAssign: "Guardar y Asignar",
    btnNewProjectQuick: "➕ Nuevo Proyecto",
    btnCreateOrManageProjects: "➕ Crear / Gestionar Proyectos",
    badgeProject: "Proyecto",

    // Section Explanations
    explainerHide: "Ocultar explicación",
    explainerShow: "Ver explicación",
    
    // 1. Home View
    homeTitle: "Bienvenido a NotesApp",
    homeSubtitle: "El sistema de notas personales diseñado para maximizar comprensión y retención duradera.",
    homeBadgeEvidence: "Notas Atómicas • Mapas de Contenido • Repaso Espaciado SM-2",
    homeQuickActionsTitle: "Acciones Rápidas",
    homeActionImportJsonTitle: "Importar Paquete JSON",
    homeActionImportJsonDesc: "Pega el JSON estructurado por tu IA o sube un archivo para poblar tu base de conocimiento.",
    homeActionLlmTitle: "Prompt Maestro para LLMs",
    homeActionLlmDesc: "Copia el prompt diseñado para ChatGPT, Claude o Gemini y categoriza cualquier texto al instante.",
    homeActionCaptureTitle: "Captura Rápida",
    homeActionCaptureDesc: "Registra pensamientos instantáneos sin fricción para no interrumpir tu foco atencional.",
    homeActionReviewTitle: "Sesión de Repaso",
    homeActionReviewDesc: "Entrena tu memoria a largo plazo mediante recuperación activa con algoritmo SM-2 e intercalado.",

    homeVaultStatsTitle: "Estado del Vault de Conocimiento",
    homeStatAtomicas: "Notas Atómicas",
    homeStatFuentes: "Notas Fuente",
    homeStatMapas: "Mapas de Contenido",
    homeStatCards: "Flashcards Activas",
    homeStatDue: "Pendientes Hoy",

    homeStorageGuideTitle: "📁 Guía de Almacenamiento y Estructuración de Información",
    homeStorageGuideSubtitle: "¿Cómo guarda NotesApp tus datos cuando importas un JSON y por qué está organizado así?",
    
    homeFolder1Title: "01-inbox/",
    homeFolder1Desc: "Almacena notas en bruto capturadas rápidamente en formato Markdown plano (inbox-*.md). Protege la memoria de trabajo permitiendo anotar ideas sin forzar una clasificación inmediata.",

    homeFolder2Title: "02-source-notes/",
    homeFolder2Desc: "Archivos fuente-*.md con metadatos de autor, tipo (libro, paper, video), citas textuales exactas y puntos clave parafraseados. Separa el contenido original de tus deducciones.",

    homeFolder3Title: "03-atomic-notes/",
    homeFolder3Desc: "Archivos atomica-*.md. Cada nota alberga exactamente UNA sola idea formulada con tus palabras propias (Efecto de Generación), explicando por qué importa y sus conexiones.",

    homeFolder4Title: "04-content-maps/",
    homeFolder4Desc: "Archivos mapa-*.md. Guías temáticas e índices estructurados que articulan varias notas atómicas en torno a un tema o proyecto.",

    homeFolder5Title: "05-self-assessment/",
    homeFolder5Desc: "Archivos pregunta-*.md. Pares de pregunta/respuesta generados a partir de cada nota atómica. El combustible del algoritmo SM-2 para la práctica de recuperación activa.",

    homeFolder6Title: "06-spaced-repetition/",
    homeFolder6Desc: "Archivo reviews.json. Registra las fechas de repaso, factores de facilidad (Ease Factor), intervalos de días y repeticiones para calcular matemáticamente cuándo debes repasar.",

    homePipelineTitle: "🔄 El Flujo de Ingesta Inteligente (Pipeline)",
    homePipelineStep1Title: "1. Texto en Bruto",
    homePipelineStep1Desc: "Copia cualquier libro, transcripción o apuntes de clase.",
    homePipelineStep2Title: "2. Prompt Maestro",
    homePipelineStep2Desc: "Pega el texto junto a nuestro prompt en Claude, ChatGPT o Gemini.",
    homePipelineStep3Title: "3. JSON Estructurado",
    homePipelineStep3Desc: "El LLM extrae fuentes, ideas atómicas, preguntas SM-2 y mapas relacionales.",
    homePipelineStep4Title: "4. Ingesta NotesApp",
    homePipelineStep4Desc: "Pega el JSON en 'Importar JSON'. NotesApp escribe los archivos y actualiza el grafo.",

    homeSchemaTableTitle: "🗺️ Correspondencia del Esquema JSON al Disco",
    homeThKey: "Campo en JSON",
    homeThTarget: "Ubicación en Disco",
    homeThRole: "Función Cognitiva y Operativa",

    // 2. Inbox View
    inboxTitle: "Bandeja de Entrada",
    inboxDesc: "Captura pensamientos brutos con fricción cero. Luego procésalos en notas atómicas o fuentes.",
    inboxExplainerTitle: "💡 Fricción Cero y Memoria de Trabajo (Sweller 1988)",
    inboxExplainerText: "La memoria de trabajo humana tiene capacidad limitada. Al leer o reflexionar, detenerte a clasificar una idea rompe el flujo atencional. Vuelca aquí tus pensamientos de inmediato y procésalos en un bloque de tiempo posterior.",
    filterPending: "Pendientes",
    filterProcessed: "Procesadas",
    filterAll: "Todas",
    inboxEmpty: "No hay capturas en esta bandeja.",
    inboxProcessBtn: "⚡ Procesar",

    // 3. Atomicas View
    atomicasTitle: "Notas Atómicas",
    atomicasDesc: "Una sola idea por nota, redactada con tus propias palabras y conectada deliberadamente.",
    atomicasExplainerTitle: "⚛️ Principio de Atomicidad y Palabras Propias",
    atomicasExplainerText: "Cada nota atómica debe ser comprensible por sí misma y abarcar un único concepto. Redactarla enteramente con tus palabras obliga a tu cerebro a reconstruir el significado, multiplicando la retención comparado con copiar y pegar.",
    btnNewAtomica: "Nueva Nota Atómica",
    atomicasEmpty: "No hay notas atómicas registradas con estos filtros.",

    // 4. Fuentes View
    fuentesTitle: "Notas Fuente",
    fuentesDesc: "Registro bibliográfico, citas y puntos clave de artículos, libros o videos consultados.",
    fuentesExplainerTitle: "📚 Anclaje Bibliográfico y Síntesis Crítica",
    fuentesExplainerText: "Las notas fuente preservan la autoría y las citas textuales originales. Te permiten auditar de dónde provino un conocimiento y disparar nuevas ideas atómicas sin contaminar la pureza conceptual de tu red.",
    btnNewFuente: "Nueva Nota Fuente",
    fuentesEmpty: "No hay notas fuente registradas con estos filtros.",

    // 5. Mapas View
    mapasTitle: "Mapas de Contenido",
    mapasDesc: "Guías temáticas e índices estructurados que articulan tus notas atómicas en torno a un gran tema o proyecto.",
    mapasBannerTitle: "¿Qué es un Mapa de Contenido?",
    mapasBannerSubtitle: "Piensa en un mapa como el índice o temario de un libro. En lugar de tener notas atómicas sueltas, aquí las agrupas para formar una visión completa de un tema o proyecto.",
    mapasStep1Title: "1. Tema central",
    mapasStep1Desc: "Define el asunto general (ej. Técnicas de Estudio o Bases de Datos).",
    mapasStep2Title: "2. Añade notas atómicas",
    mapasStep2Desc: "Selecciona los conceptos que forman los capítulos de este tema.",
    mapasStep3Title: "3. Explica la conexión",
    mapasStep3Desc: "Describe en una frase cómo aporta cada nota al conjunto.",
    mapasStep4Title: "4. Genera tu guía",
    mapasStep4Desc: "Descarga todo el mapa en Markdown estructurado para estudiar.",
    mapasExplainerTitle: "🗺️ Organización Matricial vs Listas Pasivas",
    mapasExplainerText: "Crear listas jerárquicas pasivas produce la ilusión de competencia. En NotesApp, cada nota añadida a un mapa exige obligatoriamente explicar la razón de su relación, obligándote a procesar las conexiones conceptuales profundas.",
    btnNewMapa: "Nuevo Mapa",
    mapasEmpty: "No hay mapas de contenido creados aún.",

    // 6. Repaso View
    repasoTitle: "Sesión de Repaso Espaciado",
    repasoDesc: "Práctica de recuperación activa con repasos periódicos para máxima consolidación.",
    repasoExplainerTitle: "⚡ Práctica de Recuperación Activa con Intercalado",
    repasoExplainerText: "Intentar recuperar un dato de la memoria refuerza las sinapsis mucho más que releer. El algoritmo SM-2 programa repasos justo antes de que vayas a olvidar, mientras que el intercalado de temas evita la familiaridad pasiva y entrena la discriminación mental.",
    repasoExportAnki: "📥 Exportar a Anki",
    repasoRefreshQueue: "🔄 Actualizar Cola",
    repasoInterleavingActive: "🔀 Intercalado Activo",
    repasoShowAnswer: "Mostrar Respuesta",
    repasoSpaceHint: "Espacio",
    repasoGradingPrompt: "¿Qué tan bien lo recordaste? (Teclas 0–5)",
    repasoG0: "Olvido total",
    repasoG1: "Fallo vago",
    repasoG2: "Fallo con esfuerzo",
    repasoG3: "Dificultad",
    repasoG4: "Buena retención",
    repasoG5: "Perfecto",
    repasoCongratsTitle: "¡Cola de repaso completada por hoy!",
    repasoCongratsText: "Has practicado recuperación activa con intercalado. Tu cerebro ha reforzado las conexiones neuronales duraderas.",
    repasoPracticeAll: "Practicar todas las tarjetas",

    // 7. Grafo View
    grafoTitle: "Grafo de Conocimiento Interactivo",
    grafoDesc: "Visualización de relaciones entre notas con física interactiva de arrastre, tamaños proporcionales y filtros.",
    grafoExplainerTitle: "🕸️ Topología Conceptual y Detección de Islas",
    grafoExplainerText: "El conocimiento no es lineal; es una red semántica. Este grafo te ayuda a identificar nodos centrales (hubs), puentes interdisciplinarios y notas huérfanas o islas que necesitan ser integradas con el resto de tus ideas.",
    grafoSearchPlaceholder: "🔍 Buscar nodo...",
    grafoPhysics: "⏸️ Física",
    grafoZoomIn: "+",
    grafoZoomOut: "−",
    grafoReset: "↺",
    grafoLegendMapas: "Mapas",
    grafoLegendFuentes: "Fuentes",
    grafoLegendAtomicas: "Atómicas",
    grafoHint: "💡 Clic en leyenda para filtrar. Arrastra nodos para moverlos. Nodos más grandes tienen más conexiones.",

    // 8. Analitica View
    analiticaTitle: "Analítica de Aprendizaje y Retención",
    analiticaDesc: "Métricas objetivas de memoria a largo plazo basadas en el algoritmo SM-2 y tu historial de repasos.",
    analiticaExplainerTitle: "📊 Evidencia Cuantitativa de Consolidación de Memoria",
    analiticaExplainerText: "Monitorea tu progreso cognitivo real. Una alta tasa de aciertos junto a tarjetas en estado maduro confirma que los conceptos han migrado a la memoria semántica permanente.",
    btnRefreshAnalytics: "🔄 Actualizar",
    kpiRetention: "Tasa de Retención",
    kpiRetentionSub: "Aciertos (calificación ≥ 3)",
    kpiStreak: "Racha de Repaso",
    kpiStreakSub: "Constancia diaria activa",
    kpiEase: "Ease Factor Promedio",
    kpiEaseSub: "Facilidad intrínseca del material",
    kpiReviews: "Total de Repasos Realizados",
    kpiReviewsSub: "Sesiones de recuperación activa",
    chartMaturityTitle: "🌱 Distribución de Madurez de Tarjetas",
    chartMaturityDesc: "Clasificación de conceptos según su consolidación en memoria.",
    chartMaturityNew: "Nuevas (0 repasos)",
    chartMaturityLearning: "En Aprendizaje (< 21 días)",
    chartMaturityMature: "Maduras (≥ 21 días)",
    chartForecastTitle: "📅 Pronóstico de Repasos Futuros",
    chartForecastDesc: "Próximas revisiones programadas por el espaciado óptimo.",
    forecastToday: "Hoy",
    forecast7d: "1–7 días",
    forecast30d: "8–30 días",
    forecastLater: "> 30 días",

    // 9. LLM Prompt Studio View
    llmStudioTitle: "🤖 Asistente LLM & Prompt Maestro",
    guidePurposeLlmTitle: "Asistente LLM",
    importTag: "IMPORTACIÓN JSON",
    llmStudioSubtitle: "Transforma cualquier texto, libro, curso o transcripción en un paquete estructurado y compatible con NotesApp.",
    llmExplainerTitle: "🧠 Arquitectura Cognitiva del Prompt de NotesApp",
    llmExplainerText: "Los LLMs tienden a resumir pasivamente o citar textualmente. Este prompt maestro los obliga a actuar como ingenieros cognitivos: impone la regla de una idea por nota, bloquea el texto copiado forzando redacción autónoma, genera flashcards SM-2 y exige justificaciones relacionales en cada mapa.",
    promptLangLabel: "Idioma del Prompt:",
    btnCopyPrompt: "📋 Copiar Prompt al Portapapeles",
    btnLaunchImport: "📥 Ir a Importar JSON",
    promptRulesTitle: "Las 4 Reglas Fundamentales del Prompt",
    promptRule1Title: "1. Atomicidad Estricta",
    promptRule1Desc: "Exactamente una idea autónoma por nota. Si el texto tiene varios conceptos, el modelo los divide en archivos independientes.",
    promptRule2Title: "2. Palabras Propias",
    promptRule2Desc: "Prohibido copiar/pegar párrafos literales. El LLM debe explicar con palabras directas el mecanismo conceptual subyacente.",
    promptRule3Title: "3. Autoevaluación Activa",
    promptRule3Desc: "Cada nota atómica debe tener una pregunta retadora y respuesta precisa para alimentar la práctica de recuperación activa.",
    promptRule4Title: "4. Mapas con Conexión Explicada",
    promptRule4Desc: "Ninguna nota se vincula a un mapa sin un campo 'razon' explícito que justifique su aporte relacional.",

    // 10. Modals
    searchGoogle: "Buscar en Google",
    readerEditBtn: "✏️ Editar nota",
    readerQaTitle: "🎯 Pregunta de Autoevaluación Activa",
    readerBacklinksTitle: "🔗 Backlinks Recibidos",
    modalFolderTitle: "📁 Nueva Carpeta",
    modalFolderTypeLabel: "Sección / Tipo de Nota",
    modalFolderNameLabel: "Nombre de la Carpeta *",
    modalFolderNamePlaceholder: "ej. neurociencia, habitos, psicologia",
    modalFolderSubmit: "Crear Carpeta",

    // Import Dialog
    importDialogTitle: "📥 Importar Conocimiento Estructurado",
    importDialogDesc: "Pega el JSON generado por tu LLM o selecciona un archivo .json. NotesApp procesará y guardará automáticamente las notas fuente, ideas atómicas con autoevaluación SM-2, mapas de contenido y carpetas.",
    importPasteClipboard: "📋 Pegar Portapapeles",
    importLoadFile: "📁 Cargar Archivo .json",
    importTogglePrompt: "🤖 Ver Prompt para LLM",
    importLoadSample: "📄 Cargar Ejemplo",
    importLabelContent: "Contenido JSON estructurado:",
    importPlaceholder: '{\n  "version": "1.0",\n  "notas_fuente": [...],\n  "notas_atomicas": [...],\n  "mapas_contenido": [...]\n}',
    importDetectedSummary: "Elementos detectados para importar:",
    btnSubmitImport: "🚀 Importar a NotesApp",
    importValidStatus: "✓ JSON válido y estructurado",
    importInvalidStatus: "✕ Error de sintaxis JSON",
    importEmptyStatus: "⚠️ JSON válido pero sin notas reconocidas",

    // Onboarding Guide & User Profile
    navOnboarding: "Guía de Inicio",
    userProfileTooltip: "Tu perfil y Guía de Inicio",
    userProfileDefault: "Identifícate",
    onboardingTitle: "Guía de Iniciación NotesApp",
    onboardingSubtitle: "Gestión de conocimiento y repaso espaciado basado en evidencia",
    onboardingStep1Tab: "Tu Nombre",
    onboardingStep2Tab: "Fundamentos",
    onboardingStep3Tab: "Cómo Usar",
    onboardingStep4Tab: "¡A Empezar!",
    onboardingWelcomeTitle: "¡Te damos la bienvenida a NotesApp!",
    onboardingWelcomeDesc: "NotesApp es tu sistema personal para capturar, conectar y recordar todo lo que aprendes. Para personalizar tu espacio, cuéntanos cómo te llamas:",
    onboardingNameLabel: "¿Cómo te llamas? (Tu nombre o alias) *",
    onboardingNamePlaceholder: "ej. Alejandro, María, David...",
    onboardingNameHint: "Tu nombre quedará registrado en el programa en este dispositivo para personalizar tus saludos, estadísticas y guías de estudio.",
    onboardingFoundationsTitle: "Construido sobre 3 Principios Fundamentales",
    onboardingFoundationsDesc: "A diferencia de las apps de notas pasivas, NotesApp te ayuda a comprender ideas en profundidad y recordarlas a largo plazo.",
    pillar1Title: "Una sola idea por nota (Atómica)",
    pillar1Desc: "Cada nota contiene exactamente una sola idea formulada en tus propias palabras. Evita copiar y pegar: redactar las ideas con tus palabras genera un entendimiento mucho más profundo.",
    pillar1Tag: "Notas atómicas • Palabras propias",
    pillar2Title: "Mapas de contenido estructurados",
    pillar2Desc: "Los mapas de contenido agrupan notas afines en guías temáticas, explicando la conexión y el papel de cada concepto dentro del tema general.",
    pillar2Tag: "Temarios • Conexiones claras",
    pillar3Title: "Repaso espaciado activo",
    pillar3Desc: "Cada nota incluye una pregunta de autoevaluación. La app programa repasos periódicos justo antes de que olvides, consolidando tus recuerdos de forma permanente.",
    pillar3Tag: "Recuperación activa • Memoria duradera",
    onboardingHowToTitle: "Cómo Usar NotesApp en 6 Pasos",
    onboardingHowToDesc: "Sigue este ciclo para convertir tus lecturas y reflexiones en una red sólida e interconectada de conocimiento permanente.",
    wfStep1Title: "📥 Captura Rápida (Bandeja de Entrada)",
    wfStep1Desc: "¿Tienes una idea o enlace fugaz? Escríbela en la barra superior (+) y pulsa Enter. No pierdas tiempo clasificando: protege tu concentración inmediata.",
    wfStep2Title: "📚 Registrar Notas Fuente (02-source-notes)",
    wfStep2Desc: "Al leer libros, papers o artículos, crea una nota fuente con su autor, citas textuales representativas y puntos clave sintetizados.",
    wfStep3Title: "⚛️ Crear Notas Atómicas + Flashcards (03-atomic-notes)",
    wfStep3Desc: "Desglosa cada tesis en una nota atómica en tus palabras. Redacta obligatoriamente una pregunta de autoevaluación activa (P/R) para programar su repaso.",
    wfStep4Title: "🗺️ Estructurar con Mapas de Contenido (04-content-maps)",
    wfStep4Desc: "Agrupa notas atómicas bajo un paraguas temático, justificando la relación de cada una con el campo 'razón' obligatorio.",
    wfStep5Title: "🧠 Repaso Espaciado Diario (Spaced Repetition)",
    wfStep5Desc: "Haz clic en 'Repasar hoy' en el encabezado. Intenta recordar la respuesta antes de revelarla y califícate del 0 al 5 con el algoritmo SM-2.",
    wfStep6Title: "🤖 Atajo con Inteligencia Artificial (Asistente LLM)",
    wfStep6Desc: "¿Tienes un texto o transcripción muy larga? Copia nuestro Prompt Maestro en ChatGPT/Claude/Gemini y genera un paquete JSON completo listo para importar en 1 clic.",
    onboardingReadyTitle: "¡Todo Listo para Comenzar!",
    onboardingReadyDesc: "Tu biblioteca de conocimiento está configurada y lista. ¿Por dónde deseas empezar?",
    onboardingRegisteredAs: "Usuario Registrado:",
    onboardingEditName: "Modificar nombre",
    onbActionHome: "Explorar el Panel de Inicio",
    onbActionHomeDesc: "Revisa tu biblioteca, tarjetas pendientes y accesos directos.",
    onbActionAtomica: "Crear mi Primera Nota Atómica",
    onbActionAtomicaDesc: "Escribe tu primer concepto en palabras propias con su flashcard.",
    onbActionImport: "Importar Contenido con IA",
    onbActionImportDesc: "Pega un paquete JSON generado con ChatGPT o Claude.",
    onboardingBack: "⬅️ Atrás",
    onboardingSkip: "Cerrar",
    onboardingNext: "Continuar ➔",
    onboardingFinish: "¡Comenzar ahora! 🚀",
    homeActionOnboardingTitle: "🚀 Guía de Iniciación",
    homeOnboardingHint: "Aprende a usar NotesApp y personaliza tu perfil."
  },

  en: {
    // App & Nav
    appName: "NotesApp",
    appSubtitle: "Evidence-Based Notes",
    navHome: "Home",
    navInbox: "Inbox",
    navAtomicas: "Atomic Notes",
    navFuentes: "Source Notes",
    navMapas: "Content Maps",
    navRepaso: "Spaced Repetition",
    navGrafo: "Knowledge Graph",
    navAnalitica: "Retention Analytics",
    navLlm: "LLM Assistant & Prompt",
    navGuia: "Guide & Evidence",
    evidencePillText: "Distributed practice + Active retrieval",
    toggleTheme: "Switch theme (Light / Dark / Pastel)",
    themeLight: "Light",
    themeDark: "Dark",
    themePastel: "Pastel",

    // Header
    quickCapturePlaceholder: "Frictionless quick capture... (Type and press Enter)",
    quickCaptureBtn: "Capture",
    btnImportJson: "📥 Import JSON",
    btnSearchTooltip: "Search across all notes (Ctrl + K)",
    btnReviewHeader: "🧠 Review today",

    // Common
    close: "Close",
    cancel: "Cancel",
    save: "Save",
    saveChanges: "Save Changes",
    delete: "Delete",
    edit: "Edit",
    filterAllFolders: "All folders",
    filterAllTags: "All hashtags",
    all: "All",
    newFolder: "New Folder",
    newNote: "New Note",
    editFolder: "Edit Folder",
    renameFolder: "Rename Folder",
    changeFolderColor: "Change Color",
    moveFolder: "Move Folder",
    deleteFolder: "Delete Folder",
    newSubfolder: "New Subfolder",
    folderColorLabel: "Folder color",
    parentFolderLabel: "Parent folder",
    rootFolderLabel: "Root (no parent folder)",
    confirmDeleteFolder: "Are you sure you want to delete this folder? Notes will be preserved and moved to root.",
    folderRenamedSuccess: "Folder renamed successfully",
    folderMovedSuccess: "Folder moved successfully",
    folderColorSuccess: "Folder color updated successfully",
    folderDeletedSuccess: "Folder deleted successfully",
    loading: "Loading...",
    viewCards: "Cards",
    viewMatrix: "Conceptual Matrix",
    copy: "Copy",
    copied: "Copied",
    foldersCollections: "Folders & Collections",
    searchFoldersPlaceholder: "Search folders...",
    allSources: "All Sources",
    allNotes: "All Notes",
    sourcesArticles: "Notes",
    sourcesDocuments: "Documents",
    sourcesVideos: "Videos",
    filterFlashcards: "Flashcards",
    filterConnected: "Connected",
    sortNewest: "↕ Newest first",
    sortOldest: "↕ Oldest first",
    sortTitle: "↕ Title (A-Z)",
    openSource: "Open Source",
    openNote: "Open Note",
    connectedAtomicNotes: "Connected Atomic Notes",
    connectedNotes: "Connected Notes",

    // Projects and Fields
    scopeSelectorTooltip: "Filter by Field / Course or Project",
    scopeAllProjects: "🌐 All Fields & Projects",
    btnManageProjectsTooltip: "Manage Fields & Projects",
    activeScopeLabel: "Active scope",
    btnClearScope: "Show all",
    btnClearScopeTooltip: "Clear filter (show all notes)",
    projectManagerTitle: "🎯 Fields & Projects Manager",
    projectManagerDesc: "Organize and focus your learning by Knowledge Field (Domain) and specific Course or Project.",
    pmCreateTitle: "➕ Register New Project / Course",
    fieldLabel: "Field / Domain",
    fieldPlaceholder: "e.g. Artificial Intelligence, Philosophy",
    projectLabel: "Project / Course",
    projectPlaceholder: "e.g. AI Agents and Automations",
    descriptionLabel: "Description (optional)",
    btnCreateProject: "Create Project",
    pmExistingTitle: "Registered Projects & Courses",
    pmNoProjects: "No projects registered yet. Create one above.",
    pmStatsNotes: "notes",
    pmStatsReviews: "reviews",
    scopeActivePill: "Focus",
    reviewScopeAll: "Review entire vault",
    reviewScopeActive: "Review only this project",
    projectTypeLabel: "Project Type",
    typeCurso: "🎓 Course / Training",
    typeNoticias: "📰 News / Current Affairs",
    typeInvestigacion: "🔬 Research / Study",
    typeLibro: "📖 Book / Reading",
    typeTrabajo: "💼 Work / Professional Project",
    typeOtro: "📂 Other / General",
    editProject: "Edit",
    editProjectTitle: "✏️ Edit Project",
    btnSaveProject: "Save Changes",
    btnDeleteProject: "Delete Project",
    confirmDeleteProject: "Are you sure you want to remove this project? Its notes will remain intact.",
    projectStatus: "Project Status",
    statusActive: "Active",
    statusCompleted: "Completed",
    courseLessonsCount: "Lessons",
    courseLessonsCountSuffix: "registered",
    courseLessonMode: "Continuous Course Lesson Mode",
    courseLessonDesc: "Atomic notes from this lesson will be added to the master course map and connected to prior concepts.",
    lessonNumberLabel: "Lesson #",
    lessonTitleLabel: "Lesson Title",
    courseCompletedCheckbox: "Mark course as completed after this lesson",
    quickProjectTitle: "➕ New Project",
    quickProjectDesc: "Create a new project to organize and categorize your notes.",
    btnCreateAndAssign: "Save and Assign",
    btnNewProjectQuick: "➕ New Project",
    btnCreateOrManageProjects: "➕ Create / Manage Projects",
    badgeProject: "Project",

    // Section Explanations
    explainerHide: "Hide explanation",
    explainerShow: "Show explanation",

    // 1. Home View
    homeTitle: "Welcome to NotesApp",
    homeSubtitle: "The personal knowledge system engineered around Cognitive Science principles to maximize long-term comprehension and retention.",
    homeBadgeEvidence: "Atomic Notes • Content Maps • Spaced Repetition SM-2",
    homeQuickActionsTitle: "Quick Actions",
    homeActionImportJsonTitle: "Import JSON Package",
    homeActionImportJsonDesc: "Paste structured JSON generated by your AI or load a file to instantly populate your knowledge vault.",
    homeActionLlmTitle: "Master LLM Prompt",
    homeActionLlmDesc: "Copy the prompt tailored for ChatGPT, Claude, or Gemini to categorize any document into structured notes.",
    homeActionCaptureTitle: "Quick Capture",
    homeActionCaptureDesc: "Record raw thoughts with zero friction to preserve your deep working attentional flow.",
    homeActionReviewTitle: "Spaced Review",
    homeActionReviewDesc: "Train your long-term memory via active retrieval practice using the SM-2 algorithm with topic interleaving.",

    homeVaultStatsTitle: "Knowledge Vault Status",
    homeStatAtomicas: "Atomic Notes",
    homeStatFuentes: "Source Notes",
    homeStatMapas: "Content Maps",
    homeStatCards: "Active Flashcards",
    homeStatDue: "Due Today",

    homeStorageGuideTitle: "📁 Storage Hierarchy and JSON Ingestion Guide",
    homeStorageGuideSubtitle: "How NotesApp stores your data when importing JSON and why it is structured this way.",

    homeFolder1Title: "01-inbox/",
    homeFolder1Desc: "Stores raw thoughts captured with zero friction as plain Markdown files (inbox-*.md). Protects working memory by postponing categorization until a dedicated processing block.",

    homeFolder2Title: "02-source-notes/",
    homeFolder2Desc: "Files named fuente-*.md with author metadata, media type (book, paper, video), exact quotes, and paraphrased key takeaways. Separates external information from personal synthesis.",

    homeFolder3Title: "03-atomic-notes/",
    homeFolder3Desc: "Files named atomica-*.md. Each note houses exactly ONE autonomous idea written in your own words (Generation Effect), stating why it matters and linking to related concepts.",

    homeFolder4Title: "04-content-maps/",
    homeFolder4Desc: "Files named mapa-*.md. Thematic guides and structured outlines that organize multiple atomic notes around a broader subject or project.",

    homeFolder5Title: "05-self-assessment/",
    homeFolder5Desc: "Files named pregunta-*.md. Question and answer pairs generated from each atomic note. Provides fuel for the SM-2 active recall testing algorithm.",

    homeFolder6Title: "06-spaced-repetition/",
    homeFolder6Desc: "The reviews.json file. Logs review timestamps, Ease Factors, repetition counts, and interval days to mathematically schedule your next optimal review sessions.",

    homePipelineTitle: "🔄 The Intelligent Ingestion Pipeline",
    homePipelineStep1Title: "1. Raw Material",
    homePipelineStep1Desc: "Copy any article, book chapter, paper, or lecture transcript.",
    homePipelineStep2Title: "2. Master LLM Prompt",
    homePipelineStep2Desc: "Paste the raw text alongside our prompt into Claude, ChatGPT, or Gemini.",
    homePipelineStep3Title: "3. Categorized JSON",
    homePipelineStep3Desc: "The AI extracts sources, atomic concepts, SM-2 flashcards, and relational maps.",
    homePipelineStep4Title: "4. NotesApp Ingestion",
    homePipelineStep4Desc: "Paste the JSON into 'Import JSON'. NotesApp writes the Markdown files and refreshes the graph.",

    homeSchemaTableTitle: "🗺️ JSON Schema to Disk Mapping",
    homeThKey: "JSON Property",
    homeThTarget: "Disk Destination",
    homeThRole: "Cognitive & Functional Role",

    // 2. Inbox View
    inboxTitle: "Inbox",
    inboxDesc: "Capture raw thoughts with zero friction. Process them into atomic notes or sources later.",
    inboxExplainerTitle: "💡 Zero Friction & Working Memory (Sweller 1988)",
    inboxExplainerText: "Human working memory has strict bandwidth limits. Interrupting reading or thinking to classify an idea derails deep attention. Capture thoughts here instantly and process them in a dedicated batch.",
    filterPending: "Pending",
    filterProcessed: "Processed",
    filterAll: "All",
    inboxEmpty: "No captures in this inbox.",
    inboxProcessBtn: "⚡ Process",

    // 3. Atomicas View
    atomicasTitle: "Atomic Notes",
    atomicasDesc: "One single idea per note, formulated in your own words and deliberately connected.",
    atomicasExplainerTitle: "⚛️ Atomicity Principle and Own Words",
    atomicasExplainerText: "Each atomic note must be self-contained and discuss exactly one concept. Explaining it entirely in your own words (Generation Effect) forces conceptual reconstruction, dramatically boosting retention over passive copying.",
    btnNewAtomica: "New Atomic Note",
    atomicasEmpty: "No atomic notes found matching these filters.",

    // 4. Fuentes View
    fuentesTitle: "Source Notes",
    fuentesDesc: "Bibliographic registry, verbatim quotes, and key paraphrased takeaways from consulted works.",
    fuentesExplainerTitle: "📚 Bibliographic Grounding & Critical Synthesis",
    fuentesExplainerText: "Source notes safeguard authorship and exact citations. They allow you to trace the origin of an idea and spark new atomic concepts without contaminating the conceptual purity of your permanent network.",
    btnNewFuente: "New Source Note",
    fuentesEmpty: "No source notes found matching these filters.",

    // 5. Mapas View
    mapasTitle: "Content Maps",
    mapasDesc: "Structured topic guides and outlines that connect your atomic notes into cohesive subjects or projects.",
    mapasBannerTitle: "What is a Content Map?",
    mapasBannerSubtitle: "Think of a map as a book's table of contents or topic syllabus. Instead of scattered atomic notes, group them here into a structured overview of a subject or project.",
    mapasStep1Title: "1. Core topic",
    mapasStep1Desc: "Define the main subject (e.g., Study Techniques or Database Design).",
    mapasStep2Title: "2. Add atomic notes",
    mapasStep2Desc: "Pick concepts that serve as chapters of this topic.",
    mapasStep3Title: "3. Explain connection",
    mapasStep3Desc: "Write a short sentence on how each note enriches the whole.",
    mapasStep4Title: "4. Export your guide",
    mapasStep4Desc: "Download the entire compiled study guide in Markdown.",
    mapasExplainerTitle: "🗺️ Matrix Organization vs Passive Outlines",
    mapasExplainerText: "Linear outlines foster illusions of competence. In NotesApp, every note added to a map strictly requires a reason explaining its relationship, training high-order relational processing.",
    btnNewMapa: "New Content Map",
    mapasEmpty: "No content maps created yet.",

    // 6. Repaso View
    repasoTitle: "Spaced Repetition Session",
    repasoDesc: "Active retrieval practice with periodic reviews to strengthen long-term memory.",
    repasoExplainerTitle: "⚡ Active Retrieval Practice with Interleaving",
    repasoExplainerText: "Retrieving information from memory fortifies synaptic pathways far more than passive review. The SM-2 algorithm schedules reviews right at the threshold of forgetting, while cross-topic interleaving sharpens conceptual discrimination.",
    repasoExportAnki: "📥 Export to Anki",
    repasoRefreshQueue: "🔄 Refresh Queue",
    repasoInterleavingActive: "🔀 Interleaving Active",
    repasoShowAnswer: "Show Answer",
    repasoSpaceHint: "Space",
    repasoGradingPrompt: "How well did you recall it? (Keys 0–5)",
    repasoG0: "Complete blackout",
    repasoG1: "Vague incorrect",
    repasoG2: "Struggled incorrect",
    repasoG3: "Recalled with effort",
    repasoG4: "Good retention",
    repasoG5: "Perfect recall",
    repasoCongratsTitle: "Review queue completed for today!",
    repasoCongratsText: "You have engaged in active retrieval with topic interleaving. Your brain has solidified long-term neural traces.",
    repasoPracticeAll: "Practice all cards",

    // 7. Grafo View
    grafoTitle: "Interactive Knowledge Graph",
    grafoDesc: "Visualizes note relationships with draggable physics, proportional sizing, and smart filters.",
    grafoExplainerTitle: "🕸️ Conceptual Topology & Knowledge Island Discovery",
    grafoExplainerText: "Knowledge is a non-linear semantic web. This graph helps you spot central hub nodes, cross-disciplinary bridges, and isolated orphaned notes that need to be woven into your network.",
    grafoSearchPlaceholder: "🔍 Search node...",
    grafoPhysics: "⏸️ Physics",
    grafoZoomIn: "+",
    grafoZoomOut: "−",
    grafoReset: "↺",
    grafoLegendMapas: "Maps",
    grafoLegendFuentes: "Sources",
    grafoLegendAtomicas: "Atomic",
    grafoHint: "💡 Click legend to filter. Drag nodes to move. Larger nodes possess more incoming and outgoing connections.",

    // 8. Analitica View
    analiticaTitle: "Learning & Retention Analytics",
    analiticaDesc: "Objective long-term memory metrics based on the SM-2 algorithm and your review logs.",
    analiticaExplainerTitle: "📊 Quantitative Evidence of Memory Consolidation",
    analiticaExplainerText: "Track genuine cognitive growth. A high success rate paired with mature cards proves that knowledge has successfully transitioned into permanent semantic memory.",
    btnRefreshAnalytics: "🔄 Refresh",
    kpiRetention: "Retention Rate",
    kpiRetentionSub: "Successes (grade ≥ 3)",
    kpiStreak: "Review Streak",
    kpiStreakSub: "Consecutive active days",
    kpiEase: "Average Ease Factor",
    kpiEaseSub: "Intrinsic ease of material",
    kpiReviews: "Total Reviews Done",
    kpiReviewsSub: "Active recall sessions",
    chartMaturityTitle: "🌱 Card Maturity Distribution",
    chartMaturityDesc: "Classification of concepts according to their memory consolidation.",
    chartMaturityNew: "New (0 reviews)",
    chartMaturityLearning: "Learning (< 21 days)",
    chartMaturityMature: "Mature (≥ 21 days)",
    chartForecastTitle: "📅 Review Load Forecast",
    chartForecastDesc: "Upcoming reviews scheduled across optimal spacing intervals.",
    forecastToday: "Today",
    forecast7d: "1–7 days",
    forecast30d: "8–30 days",
    forecastLater: "> 30 days",

    // 9. LLM Prompt Studio View
    llmStudioTitle: "🤖 LLM Assistant & Master Prompt",
    guidePurposeLlmTitle: "LLM Assistant",
    importTag: "JSON IMPORT",
    llmStudioSubtitle: "Transform any document, book, course, or transcript into a structured package compatible with NotesApp.",
    llmExplainerTitle: "🧠 Cognitive Architecture of the NotesApp Prompt",
    llmExplainerText: "Language models typically summarize passively or copy verbatim. This master prompt forces the AI to behave as a cognitive architect: enforces strict single-idea atomicity, blocks copy-pasting to ensure generative wording, creates SM-2 flashcards, and requires relational reasons in every content map.",
    promptLangLabel: "Prompt Language:",
    btnCopyPrompt: "📋 Copy Prompt to Clipboard",
    btnLaunchImport: "📥 Go to Import JSON",
    promptRulesTitle: "The 4 Core Rules of the Prompt",
    promptRule1Title: "1. Strict Atomicity",
    promptRule1Desc: "Exactly one autonomous idea per note. If the source material touches multiple concepts, the AI splits them into independent files.",
    promptRule2Title: "2. Own Words",
    promptRule2Desc: "Copying verbatim paragraphs is prohibited. The LLM must clearly explain the underlying mechanism in its own words.",
    promptRule3Title: "3. Active Self-Assessment",
    promptRule3Desc: "Every atomic note must have an open retrieval question and key answer to fuel spaced retrieval practice.",
    promptRule4Title: "4. Content Maps with Explained Connection",
    promptRule4Desc: "No note is linked to a map without an explicit 'razon' field explaining why and how it enriches that conceptual organizer.",

    // 10. Modals
    searchGoogle: "Google Search",
    readerEditBtn: "✏️ Edit note",
    readerQaTitle: "🎯 Active Retrieval Practice Question",
    readerBacklinksTitle: "🔗 Incoming Backlinks",
    modalFolderTitle: "📁 New Folder",
    modalFolderTypeLabel: "Section / Note Type",
    modalFolderNameLabel: "Folder Name *",
    modalFolderNamePlaceholder: "e.g., neuroscience, habits, psychology",
    modalFolderSubmit: "Create Folder",

    // Import Dialog
    importDialogTitle: "📥 Import Structured Knowledge",
    importDialogDesc: "Paste the JSON generated by your LLM or choose a .json file. NotesApp will automatically write source notes, atomic ideas with SM-2 practice questions, content maps, and folders.",
    importPasteClipboard: "📋 Paste Clipboard",
    importLoadFile: "📁 Load .json File",
    importTogglePrompt: "🤖 View LLM Prompt",
    importLoadSample: "📄 Load Sample",
    importLabelContent: "Structured JSON Payload:",
    importPlaceholder: '{\n  "version": "1.0",\n  "notas_fuente": [...],\n  "notas_atomicas": [...],\n  "mapas_contenido": [...]\n}',
    importDetectedSummary: "Detected items ready to import:",
    btnSubmitImport: "🚀 Import into NotesApp",
    importValidStatus: "✓ Valid & structured JSON",
    importInvalidStatus: "✕ JSON syntax error",
    importEmptyStatus: "⚠️ Valid JSON but no recognizable notes",

    // Onboarding Guide & User Profile
    navOnboarding: "Getting Started",
    userProfileTooltip: "Your Profile and Getting Started Guide",
    userProfileDefault: "Get Started",
    onboardingTitle: "NotesApp Getting Started Guide",
    onboardingSubtitle: "Evidence-based knowledge management & spaced repetition",
    onboardingStep1Tab: "Your Name",
    onboardingStep2Tab: "Foundations",
    onboardingStep3Tab: "How to Use",
    onboardingStep4Tab: "Get Started",
    onboardingWelcomeTitle: "Welcome to NotesApp!",
    onboardingWelcomeDesc: "NotesApp is your personal workspace to capture, connect, and retain everything you learn. To personalize your space, please introduce yourself:",
    onboardingNameLabel: "What should we call you? (Your name or alias) *",
    onboardingNamePlaceholder: "e.g. Alex, Maria, David...",
    onboardingNameHint: "Your name will be registered locally on this device to customize your greetings, study guides, and knowledge library.",
    onboardingFoundationsTitle: "Built on 3 Core Principles",
    onboardingFoundationsDesc: "Unlike passive note apps, NotesApp helps you deeply understand ideas and remember them long-term.",
    pillar1Title: "One Idea per Note (Atomic)",
    pillar1Desc: "Each note develops exactly one concept in your own words. Formulating ideas yourself builds far deeper understanding than passive copy-pasting.",
    pillar1Tag: "Atomic notes • Your own words",
    pillar2Title: "Structured Content Maps",
    pillar2Desc: "Content maps organize related notes into cohesive topics and study guides, explaining the connection of each idea to the bigger picture.",
    pillar2Tag: "Topic outlines • Clear connections",
    pillar3Title: "Active Spaced Repetition",
    pillar3Desc: "Every note creates a self-test question. The system schedules reviews right before you forget, cementing knowledge permanently.",
    pillar3Tag: "Active recall • Long-term memory",
    onboardingHowToTitle: "How to Use NotesApp: The 6 Steps",
    onboardingHowToDesc: "Follow this simple cycle to turn everyday reading and thoughts into an interconnected knowledge network.",
    wfStep1Title: "📥 Quick Capture (Inbox)",
    wfStep1Desc: "Got a fleeting idea or link? Type it in the top bar (+) and press Enter. Don't stop to classify—protect your focus.",
    wfStep2Title: "📚 Save Source Notes (02-source-notes)",
    wfStep2Desc: "When reading books or articles, create a source note with authors, citations, and high-level summaries.",
    wfStep3Title: "⚛️ Create Atomic Notes + Flashcards (03-atomic-notes)",
    wfStep3Desc: "Express ONE idea in your words. Formulate an open retrieval question and key answer for spaced review.",
    wfStep4Title: "🗺️ Structure with Content Maps (04-content-maps)",
    wfStep4Desc: "Group atomic concepts under an overarching theme. Justify every connection with the mandatory 'reason' field.",
    wfStep5Title: "🧠 Daily Review (Spaced Repetition)",
    wfStep5Desc: "Click 'Review today' in the header. Test yourself before revealing the answer, then grade your recall from 0 to 5.",
    wfStep6Title: "🤖 AI Accelerated Import (LLM Assistant)",
    wfStep6Desc: "Have a long paper or book? Copy our Master LLM Prompt into ChatGPT/Claude to generate a ready-to-import JSON package in seconds.",
    onboardingReadyTitle: "You're All Set!",
    onboardingReadyDesc: "Your knowledge workspace is configured and ready. Where would you like to start?",
    onboardingRegisteredAs: "Registered User:",
    onboardingEditName: "Edit name",
    onbActionHome: "Explore Home Dashboard",
    onbActionHomeDesc: "View library counts, daily review queue, and quick shortcuts.",
    onbActionAtomica: "Create an Atomic Note",
    onbActionAtomicaDesc: "Write your first concept in your own words with a flashcard.",
    onbActionImport: "Import with AI",
    onbActionImportDesc: "Use ChatGPT or Claude to import articles or book summaries.",
    onboardingBack: "⬅️ Back",
    onboardingSkip: "Close",
    onboardingNext: "Continue ➔",
    onboardingFinish: "Start Now! 🚀",
    homeActionOnboardingTitle: "🚀 Getting Started Guide",
    homeOnboardingHint: "Learn how to use NotesApp and customize your profile."
  }
};


// Progressive-disclosure Home and shared navigation copy.
const HOME_COPY = {
  "es": {
    "homeDetail0": "Fricción Cero • Captura Rápida",
    "homeDetail1": "Anclaje Bibliográfico",
    "homeDetail2": "Razón Obligatoria de Conexión",
    "homeDetail3": "Algoritmo SM-2 + Interleaving",
    "homeDetail4": "Organización temática física en carpetas reales sin perder la interconexión por wikilinks.",
    "homeDetail5": "Almacena síntesis externa, autor, medio original y citas textuales exactas.",
    "homeDetail6": "Unidades de pensamiento autónomas con definición propia, razón de impacto y wikilinks [[...]].",
    "homeDetail7": "Flashcard de recuperación activa para el algoritmo SM-2 vinculada a la nota atómica.",
    "homeDetail8": "Organizadores temáticos superiores con justificación relacional obligatoria (campo razon).",
    "homeEyebrow": "TU ESPACIO",
    "homeFocusTitle": "Un poco de atención. Conocimiento duradero.",
    "homeFocusSubtitle": "Captura un pensamiento, conecta una idea o dedica un momento a recordar.",
    "homeToday": "HOY",
    "homeReviewFocus": "Conserva lo que aprendes.",
    "homeReviewFocusDesc": "Un breve repaso convierte tus notas en conocimiento que puedes recordar.",
    "homeStartReview": "Comenzar repaso",
    "homeLibrary": "Tu biblioteca",
    "homeLibraryHint": "Pequeñas ideas, conectadas.",
    "homeImportHint": "Añade notas estructuradas a tu biblioteca.",
    "homePromptHint": "Transforma tus fuentes en notas conectadas.",
    "homeReference": "Más detalles",
    "homeReferenceHint": "Explora solo lo que necesitas.",
    "homeHowImport": "De la fuente a tus notas",
    "homeHowImportHint": "Los cuatro pasos para importar conocimiento.",
    "homeHowStored": "Dónde vive tu conocimiento",
    "homeHowStoredHint": "Seis carpetas, cada una con su propósito.",
    "homeHowSchema": "Formato de importación y archivos",
    "homeHowSchemaHint": "Campos JSON y sus destinos Markdown.",
    "homeHowMethod": "El método detrás de tu espacio",
    "homeHowMethodHint": "Principios de aprendizaje y referencias.",
    "navLibrary": "Biblioteca",
    "navLearning": "Aprendizaje",
    "navTools": "Herramientas",
    "importTooltip": "Importar un paquete JSON de notas",
    "languageTooltip": "Idioma de la interfaz",
    "evidenceTooltip": "Metodología basada en notas atómicas, mapas conceptuales y repaso espaciado"
  },
  "en": {
    "homeDetail0": "Zero friction • Quick capture",
    "homeDetail1": "Bibliographic grounding",
    "homeDetail2": "Required connection reason",
    "homeDetail3": "SM-2 algorithm + Interleaving",
    "homeDetail4": "Organize topics in physical folders while retaining connections through wikilinks.",
    "homeDetail5": "Stores source summaries, authors, original media, and direct quotations.",
    "homeDetail6": "Self-contained ideas with your own definitions, their significance, and wikilinks [[...]].",
    "homeDetail7": "An active-recall flashcard linked to the atomic note and scheduled with SM-2.",
    "homeDetail8": "Thematic organizers with a required explanation for each connection (razon field).",
    "homeEyebrow": "YOUR WORKSPACE",
    "homeFocusTitle": "A little focus. Lasting knowledge.",
    "homeFocusSubtitle": "Capture a thought, connect an idea, or make time to remember.",
    "homeToday": "TODAY",
    "homeReviewFocus": "Keep what you learn.",
    "homeReviewFocusDesc": "A short review turns your notes into knowledge you can recall.",
    "homeStartReview": "Start review",
    "homeLibrary": "Your library",
    "homeLibraryHint": "Small ideas, connected.",
    "homeImportHint": "Bring structured notes into your library.",
    "homePromptHint": "Turn source material into connected notes.",
    "homeReference": "A closer look",
    "homeReferenceHint": "Explore only what you need.",
    "homeHowImport": "From source to notes",
    "homeHowImportHint": "The four steps of importing knowledge.",
    "homeHowStored": "Where your knowledge lives",
    "homeHowStoredHint": "Six folders, with a purpose for each.",
    "homeHowSchema": "Import format & file structure",
    "homeHowSchemaHint": "JSON fields and their Markdown destinations.",
    "homeHowMethod": "The method behind your workspace",
    "homeHowMethodHint": "Learning principles and supporting references.",
    "navLibrary": "Library",
    "navLearning": "Learning",
    "navTools": "Tools",
    "importTooltip": "Import a JSON note package",
    "languageTooltip": "Interface language",
    "evidenceTooltip": "Method based on atomic notes, conceptual maps, and spaced repetition"
  }
};
for (const lang of ['es', 'en']) Object.assign(I18N[lang], HOME_COPY[lang]);
// Keep decorative icons in markup, never in translated labels.
for (const dict of Object.values(I18N)) for (const key of Object.keys(dict)) {
 if (typeof dict[key] === 'string' && !key.includes('Placeholder')) dict[key] = dict[key].replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u, '').replace(/^([1-4])\. /, key.startsWith('homePipelineStep') ? '' : '$1. ');
}
I18N.en.homeFolder6Desc = 'Markdown files cola-repaso.md and registro-repasos.md store the review queue and history. Question metadata records ease factors, repetitions, and intervals for scheduling.';
I18N.es.homeFolder6Desc = 'Los archivos Markdown cola-repaso.md y registro-repasos.md guardan la cola y el historial. Los metadatos de cada pregunta registran facilidad, repeticiones e intervalos para programar los repasos.';
I18N.en.quickCapturePlaceholder = 'Capture a thought…';
I18N.es.quickCapturePlaceholder = 'Captura un pensamiento…';

const UI_COPY = {
  "es": {
    "uiCopy0": "Tema",
    "uiCopy1": "Intervalo actual: 1d",
    "uiCopy2": "PREGUNTA (P)",
    "uiCopy3": "¿Cargando pregunta?",
    "uiCopy4": "RESPUESTA (R)",
    "uiCopy5": "Respuesta...",
    "uiCopy6": "-- días",
    "uiCopy7": "Guía del Sistema y Propósito de Cada Módulo",
    "uiCopy8": "Cómo funciona NotesApp: qué hace cada sección y cómo aprovecharla al máximo.",
    "uiCopy9": "🔄 El Flujo de Trabajo en 5 Pasos",
    "uiCopy10": "Captura Rápida",
    "uiCopy11": "Procesar a Fuente",
    "uiCopy12": "Nota Atómica",
    "uiCopy13": "Estructura en Mapas",
    "uiCopy14": "razón",
    "uiCopy15": "Recuperación Activa",
    "uiCopy16": "🧭 ¿Para qué sirve cada sección de NotesApp?",
    "guidePurposesIntro": "Cada área del programa tiene una función concreta diseñada para ayudarte a asimilar y recordar lo que aprendes sin esfuerzo:",
    "purposeTagInbox": "Captura Rápida",
    "purposeDescInbox": "Apunta ideas fugaces, enlaces o notas rápidas sin detenerte a clasificarlas. Protege tu flujo de concentración y luego procésalas en notas definitivas.",
    "purposeTagFuentes": "Registro de Lecturas",
    "purposeDescFuentes": "Fichas para libros, artículos, conferencias o vídeos. Guarda autores, citas textuales y puntos clave para tener siempre trazabilidad del origen.",
    "purposeTagAtomicas": "Núcleo del Conocimiento",
    "purposeDescAtomicas": "Una sola idea por nota, explicada enteramente con tus propias palabras (para interiorizarla) y conectada deliberadamente con otras mediante enlaces [[wikilink]].",
    "purposeTagMapas": "Índices y Temarios",
    "purposeDescMapas": "Actúan como el índice o temario de un gran asunto. Agrupan varias notas atómicas explicando por qué cada una forma parte del tema, y permiten exportar una guía completa de estudio.",
    "purposeTagRepaso": "Memoria a Largo Plazo",
    "purposeDescRepaso": "Preguntas activas generadas a partir de tus notas. El algoritmo programa repasos periódicos justo en el momento óptimo antes de olvidar, alternando temas para fijar el recuerdo.",
    "purposeTagGrafo": "Mapa Visual de Red",
    "purposeDescGrafo": "Visualización interactiva que muestra cómo crecen tus ramas de aprendizaje. Te ayuda a descubrir conexiones inesperadas y detectar conceptos que han quedado aislados.",
    "purposeTagAnalitica": "Métricas de Progreso",
    "purposeDescAnalitica": "Mide tu tasa de acierto en los repasos, tu racha de constancia y cuántas tarjetas han alcanzado la madurez en tu memoria semántica.",
    "purposeTagLlm": "Ingestión Inteligente",
    "purposeDescLlm": "Transforma cualquier texto extenso o libro en un paquete estructurado de fuentes, notas atómicas con preguntas y mapas temáticos listo para importar.",
    "uiCopy17": "UTILIDAD ALTA",
    "uiCopy18": "Autoevaluación",
    "uiCopy19": "Intentar recordar una respuesta desde la memoria produce un efecto de retención muy superior a releer pasivamente. Por eso cada nota atómica tiene su pregunta asociada.",
    "uiCopy20": "Práctica Distribuida",
    "uiCopy21": "El cerebro consolida recuerdos durante el descanso. Espaciar los repasos con SM-2 aplana la curva del olvido multiplicando la duración del recuerdo.",
    "uiCopy22": "DISCRIMINACIÓN COGNITIVA",
    "uiCopy23": "Intercalado de Temas",
    "uiCopy24": "Repasar temas en bloques crea familiaridad engañosa. Al intercalar preguntas de temas distintos, el cerebro debe identificar primero qué concepto aplicar.",
    "uiCopy25": "CODIFICACIÓN PROFUNDA",
    "uiCopy26": "Efecto de Generación",
    "uiCopy27": "Generar una frase propia exige reconstruir el significado. Por eso NotesApp estimula redactar con tus propias palabras.",
    "uiCopy28": "ORGANIZACIÓN MATRICIAL",
    "uiCopy29": "Matrices y Mapas Estructurados",
    "uiCopy30": "DESACONSEJADO",
    "uiCopy31": "Relectura y Subrayado Pasivo",
    "uiCopy32": "Técnicas muy populares pero ineficaces: crean la ilusión de competencia pero no fijan memoria duradera. NotesApp no incluye modo subrayador pasivo.",
    "uiCopy33": "⌨️ Atajos de Teclado y Consejos de Uso",
    "uiCopy34": "Atajo",
    "uiCopy35": "Acción",
    "uiCopy36": "Contexto",
    "uiCopy37": "Buscador global instantáneo",
    "uiCopy38": "En cualquier lugar de la app",
    "uiCopy39": "Autocompletar enlace a nota atómica existente",
    "uiCopy40": "Al escribir en campos de conexión",
    "uiCopy41": "Mostrar la respuesta de la flashcard",
    "uiCopy42": "Durante la sesión de repaso",
    "uiCopy43": "Calificar el recuerdo con algoritmo SM-2",
    "uiCopy44": "Con la respuesta visible en repaso",
    "uiCopy45": "Cerrar modal o diálogo activo",
    "uiCopy46": "En cualquier modal",
    "uiCopy47": "Atómica",
    "uiCopy48": "📁 Carpeta",
    "uiCopy49": "Título de la Nota",
    "uiCopy50": "PREGUNTA (P):",
    "uiCopy51": "RESPUESTA CLAVE (R):",
    "uiCopy52": "Notas Atómicas (03-atomic-notes/)",
    "uiCopy53": "Notas Fuente (02-source-notes/)",
    "uiCopy54": "Mapas de Contenido (04-content-maps/)",
    "uiCopy55": "Bandeja de Entrada (01-inbox/)",
    "uiCopy56": "⚡ Flujo \"Procesar\": De Captura a Conocimiento",
    "uiCopy57": "Nota capturada original:",
    "uiCopy58": "1. ¿Proviene de una fuente externa?",
    "createSourceNote": "Crear Nota Fuente",
    "uiCopy59": "Título de la Fuente *",
    "uiCopy60": "Autor(es)",
    "uiCopy61": "Tipo",
    "uiCopy62": "Artículo",
    "uiCopy63": "Libro",
    "uiCopy64": "Otro",
    "uiCopy65": "Puntos clave (parafraseados):",
    "uiCopy66": "2. Crear Nota Atómica (Efecto de Generación)",
    "uiCopy67": "Título de la Idea Atómica *",
    "uiCopy68": "🛡️ Regla Anti-Copia Activa",
    "uiCopy69": "Efecto de generación:",
    "uiCopy70": "¿Por qué importa?",
    "uiCopy71": "¿Cómo se conecta con lo que ya sé?",
    "uiCopy72": "3. Generar Pregunta de Autoevaluación (Recuperación Activa)",
    "uiCopy73": "Pregunta (P) *",
    "uiCopy74": "Respuesta Clave (R) *",
    "uiCopy75": "Guardar y Convertir Nota",
    "uiCopy76": "✏️ Escribir",
    "uiCopy77": "👁️ Vista Previa",
    "uiCopy78": "Título *",
    "uiCopy79": "Carpeta / Ubicación",
    "uiCopy80": "(Raíz - sin subcarpeta)",
    "uiCopy81": "Fuente Vinculada",
    "uiCopy82": "(Ninguna)",
    "uiCopy83": "Hashtags (separados por coma o con #)",
    "uiCopy84": "Similitud con la fuente: 0%",
    "uiCopy85": "💡 Asistente Feynman (Paráfrasis Activa):",
    "uiCopy86": "👦 Como a un principiante",
    "uiCopy87": "🪞 Con una analogía cotidiana",
    "uiCopy88": "⚡ ¿Cuándo NO se aplica o falla?",
    "uiCopy89": "¿Cómo se conecta con lo que ya sé? (Usa [[id]] para enlazar)",
    "uiCopy90": "🔗 Backlinks Recibidos",
    "uiCopy91": "No hay referencias entrantes aún.",
    "uiCopy92": "🎯 Pregunta de Autoevaluación Asociada",
    "uiCopy93": "Pregunta (P)",
    "uiCopy94": "Respuesta Clave (R)",
    "uiCopy95": "Nota Fuente",
    "uiCopy96": "Tipo de Fuente",
    "uiCopy97": "Puntos clave (parafraseados, no copiados)",
    "uiCopy98": "Ideas propias que dispara (IDs de notas atómicas)",
    "uiCopy99": "Mapa de Contenido",
    "uiCopy100": "Título del Mapa *",
    "uiCopy101": "Subtemas del Mapa",
    "uiCopy102": "⚠️ Razón obligatoria en cada enlace",
    "uiCopy103": "Nota Atómica a enlazar:",
    "uiCopy104": "Selecciona nota atómica...",
    "uiCopy105": "Razón de la relación * (Obligatoria):",
    "uiCopy106": "+ Agregar",
    "uiCopy107": "⚡ Ingesta Rápida (Copy-Paste)",
    "uiCopy108": "🤖 Prompt Maestro para Modelo de Lenguaje (ChatGPT, Claude, Gemini...)",
    "uiCopy109": "Copia este prompt, pégalo en tu IA favorita junto a tu documentación y luego pega aquí el JSON resultante.",
    "uiCopy110": "📋 Copiar Prompt"
  },
  "en": {
    "uiCopy0": "Topic",
    "uiCopy1": "Current interval: 1d",
    "uiCopy2": "QUESTION (Q)",
    "uiCopy3": "Loading question…",
    "uiCopy4": "ANSWER (A)",
    "uiCopy5": "Answer…",
    "uiCopy6": "-- days",
    "uiCopy7": "System Guide and Section Overview",
    "uiCopy8": "How NotesApp works: the purpose of each module and how to get the most out of it.",
    "uiCopy9": "The learning workflow in five steps",
    "uiCopy10": "Quick capture",
    "uiCopy11": "Process into a source",
    "uiCopy12": "Atomic note",
    "uiCopy13": "Organize into maps",
    "uiCopy14": "reason",
    "uiCopy15": "Active recall",
    "uiCopy16": "🧭 Purpose and utility of each section",
    "guidePurposesIntro": "Each area of NotesApp has a dedicated purpose designed to help you understand and retain knowledge effortlessly:",
    "purposeTagInbox": "Quick Capture",
    "purposeDescInbox": "Jot down fleeting ideas, links, or thoughts without stopping to categorize them. Protect your focus and batch-process them later.",
    "purposeTagFuentes": "Reading Registry",
    "purposeDescFuentes": "Summaries for books, papers, talks, or videos. Store authors, key takeaways, and exact quotes to always keep source traceability.",
    "purposeTagAtomicas": "Knowledge Core",
    "purposeDescAtomicas": "One idea per note, expressed in your own words (for deep encoding) and connected to related ideas via [[wikilink]] references.",
    "purposeTagMapas": "Topic Outlines",
    "purposeDescMapas": "Act as a book's table of contents or topic guide. Group multiple atomic notes explaining how each fits into the topic, and export complete study guides.",
    "purposeTagRepaso": "Long-Term Retention",
    "purposeDescRepaso": "Active retrieval questions generated from your notes. The algorithm schedules reviews right before you forget, cementing memories permanently.",
    "purposeTagGrafo": "Visual Network Map",
    "purposeDescGrafo": "Interactive graph showing how your knowledge clusters grow. Spot bridges between disciplines and discover orphaned concepts.",
    "purposeTagAnalitica": "Progress Metrics",
    "purposeDescAnalitica": "Track your review accuracy rate, study streak, and the volume of notes that have transitioned into mature semantic memory.",
    "purposeTagLlm": "Intelligent Ingestion",
    "purposeDescLlm": "Transform any long text or book into a structured package of sources, atomic notes with flashcards, and topic maps ready for 1-click import.",
    "uiCopy17": "HIGH UTILITY",
    "uiCopy18": "Self-testing",
    "uiCopy19": "Trying to recall an answer from memory produces far higher retention than passive rereading. Each atomic note therefore has an associated question.",
    "uiCopy20": "Distributed practice",
    "uiCopy21": "The brain consolidates memories during rest. Spacing reviews with SM-2 helps counter forgetting and supports longer retention.",
    "uiCopy22": "CONCEPT DISCRIMINATION",
    "uiCopy23": "Interleaving",
    "uiCopy24": "Reviewing topics in blocks can create misleading familiarity. Alternating questions across topics requires you to identify which concept to apply.",
    "uiCopy25": "DEEP ENCODING",
    "uiCopy26": "Generation effect",
    "uiCopy27": "Writing in your own words requires reconstructing meaning. NotesApp encourages formulating concepts yourself.",
    "uiCopy28": "MATRIX ORGANIZATION",
    "uiCopy29": "Structured Maps and Outlines",
    "uiCopy30": "DISCOURAGED",
    "uiCopy31": "Passive rereading and highlighting",
    "uiCopy32": "These popular techniques can create a sense of familiarity without lasting recall. NotesApp does not include a passive highlighting mode.",
    "uiCopy33": "Keyboard shortcuts and tips",
    "uiCopy34": "Shortcut",
    "uiCopy35": "Action",
    "uiCopy36": "Context",
    "uiCopy37": "Global search",
    "uiCopy38": "Anywhere in the app",
    "uiCopy39": "Autocomplete a link to an existing atomic note",
    "uiCopy40": "While writing in connection fields",
    "uiCopy41": "Reveal the flashcard answer",
    "uiCopy42": "During a review session",
    "uiCopy43": "Grade your recall with SM-2",
    "uiCopy44": "When the review answer is visible",
    "uiCopy45": "Close the active dialog",
    "uiCopy46": "In any dialog",
    "uiCopy47": "Atomic",
    "uiCopy48": "Folder",
    "uiCopy49": "Note title",
    "uiCopy50": "QUESTION (Q):",
    "uiCopy51": "KEY ANSWER (A):",
    "uiCopy52": "Atomic notes (03-atomic-notes/)",
    "uiCopy53": "Source notes (02-source-notes/)",
    "uiCopy54": "Content maps (04-content-maps/)",
    "uiCopy55": "Inbox (01-inbox/)",
    "uiCopy56": "Process: from capture to knowledge",
    "uiCopy57": "Original captured note:",
    "uiCopy58": "1. Is this from an external source?",
    "createSourceNote": "Create Source Note",
    "uiCopy59": "Source title *",
    "uiCopy60": "Author(s)",
    "uiCopy61": "Type",
    "uiCopy62": "Article",
    "uiCopy63": "Book",
    "uiCopy64": "Other",
    "uiCopy65": "Key points (in your own words):",
    "uiCopy66": "2. Create an atomic note (generation effect)",
    "uiCopy67": "Atomic idea title *",
    "uiCopy68": "Write in your own words",
    "uiCopy69": "Generation effect:",
    "uiCopy70": "Why does it matter?",
    "uiCopy71": "How does it connect with what I know?",
    "uiCopy72": "3. Create a self-test question (active recall)",
    "uiCopy73": "Question (Q) *",
    "uiCopy74": "Key answer (A) *",
    "uiCopy75": "Save and convert note",
    "uiCopy76": "Write",
    "uiCopy77": "Preview",
    "uiCopy78": "Title *",
    "uiCopy79": "Folder / location",
    "uiCopy80": "(Root — no subfolder)",
    "uiCopy81": "Linked source",
    "uiCopy82": "(None)",
    "uiCopy83": "Tags (separated by commas or #)",
    "uiCopy84": "Source similarity: 0%",
    "uiCopy85": "Feynman assistant (active paraphrasing):",
    "uiCopy86": "Explain to a beginner",
    "uiCopy87": "Use an everyday analogy",
    "uiCopy88": "When does it not apply or fail?",
    "uiCopy89": "How does it connect with what I know? (Use [[id]] to link)",
    "uiCopy90": "Incoming links",
    "uiCopy91": "No incoming references yet.",
    "uiCopy92": "Associated self-test question",
    "uiCopy93": "Question (Q)",
    "uiCopy94": "Key answer (A)",
    "uiCopy95": "Source note",
    "uiCopy96": "Source type",
    "uiCopy97": "Key points (paraphrased, not copied)",
    "uiCopy98": "Ideas it inspires (atomic note IDs)",
    "uiCopy99": "Content map",
    "uiCopy100": "Map title *",
    "uiCopy101": "Map subtopics",
    "uiCopy102": "Every link needs a reason",
    "uiCopy103": "Atomic note to link:",
    "uiCopy104": "Select an atomic note…",
    "uiCopy105": "Reason for the connection * (required):",
    "uiCopy106": "+ Add",
    "uiCopy107": "Quick import (copy and paste)",
    "uiCopy108": "Master prompt for a language model (ChatGPT, Claude, Gemini…)",
    "uiCopy109": "Copy this prompt into your AI tool with your source material, then paste the resulting JSON here.",
    "uiCopy110": "Copy prompt"
  }
};
for (const lang of ['es', 'en']) Object.assign(I18N[lang], UI_COPY[lang]);

const FIELD_COPY = {
  "es": {
    "fieldHint0": "ej. Hábitos Atómicos",
    "fieldHint1": "ej. James Clear",
    "fieldHint2": "Puntos principales sin copiar textualmente...",
    "fieldHint3": "ej. El efecto de espaciado",
    "fieldHint4": "Redacta la idea con tus propias palabras...",
    "fieldHint5": "Relevancia o consecuencias prácticas...",
    "fieldHint6": "Escribe [[slug]] para autocompletar enlaces...",
    "fieldHint7": "¿Por qué o cómo funciona...?",
    "fieldHint8": "Respuesta sintética y precisa...",
    "fieldHint9": "ej. #memoria, #psicologia, aprendizaje",
    "fieldHint10": "Formula la pregunta...",
    "fieldHint11": "Respuesta esperada...",
    "fieldHint12": "ej. #cognicion, lectura",
    "fieldHint13": "ej. Técnicas de estudio con evidencia",
    "fieldHint14": "¿Por qué se relaciona con este mapa?",
    "fieldHint15": "Buscar por título, contenido, autor o concepto...",
    "guideStepBody0": "Vuelca cualquier idea sin fricción. No clasifiques de inmediato para evitar interrumpir tu flujo de atención.",
    "guideStepBody1": "Si proviene de un libro, paper o video, registra la bibliografía y extrae los puntos clave parafraseados.",
    "guideStepBody2": "Formula la idea con tus propias palabras para asimilarla bien. Escribe por qué importa y cómo se conecta.",
    "guideStepBody3": "Integra la idea en un mapa temático. Explica cómo se conecta con el tema general.",
    "guideStepBody4": "Responde la pregunta generada. El repaso espaciado te la mostrará en el momento óptimo para consolidarla."
  },
  "en": {
    "fieldHint0": "e.g. Atomic Habits",
    "fieldHint1": "e.g. James Clear",
    "fieldHint2": "Key points in your own words…",
    "fieldHint3": "e.g. The spacing effect",
    "fieldHint4": "Write the idea in your own words…",
    "fieldHint5": "Significance or practical consequences…",
    "fieldHint6": "Type [[slug]] to autocomplete links…",
    "fieldHint7": "Why or how does it work…?",
    "fieldHint8": "A concise, precise answer…",
    "fieldHint9": "e.g. #memory, #psychology, learning",
    "fieldHint10": "Write the question…",
    "fieldHint11": "Expected answer…",
    "fieldHint12": "e.g. #cognition, reading",
    "fieldHint13": "e.g. Evidence-based study techniques",
    "fieldHint14": "How does it relate to this map?",
    "fieldHint15": "Search by title, content, author, or concept…",
    "guideStepBody0": "Capture any thought without stopping to classify it, so you can stay focused.",
    "guideStepBody1": "For a book, paper, or video, record the reference and paraphrase its key points.",
    "guideStepBody2": "Write the idea in your own words to deeply understand it. Note why it matters and how it connects.",
    "guideStepBody3": "Add the idea to a thematic map, explaining how each connects to the main theme.",
    "guideStepBody4": "Answer the generated question. Spaced repetition will schedule reviews right at the threshold of forgetting."
  }
};
for (const lang of ['es', 'en']) Object.assign(I18N[lang], FIELD_COPY[lang]);

const CONTROL_COPY = {
  "es": {
    "controlTip0": "Descargar mazo de flashcards para Anki (TSV)",
    "controlTip1": "Preguntas intercaladas para evitar bloques monótonos",
    "controlTip2": "Pausar o reanudar simulación física",
    "controlTip3": "Acercar",
    "controlTip4": "Alejar",
    "controlTip5": "Reiniciar vista",
    "controlTip6": "Filtrar por Mapas",
    "controlTip7": "Filtrar por Fuentes",
    "controlTip8": "Filtrar por Atómicas",
    "controlTip9": "Pegar contenido del portapapeles",
    "controlTip10": "Cargar desde archivo .json",
    "controlTip11": "Ver y copiar el prompt maestro para el modelo de lenguaje",
    "controlTip12": "Cargar un JSON de prueba",
    "formCopy0": "Idea (con tus propias palabras) *",
    "formCopy1": "Idea (con mis palabras) *",
    "formCopy2": "Pegar texto directo está bloqueado. Producir el contenido refuerza la huella de memoria.",
    "guideReasonBody": "Obligar a especificar la razón de una relación activa el procesamiento relacional superior, evitando colecciones caóticas de notas aisladas."
  },
  "en": {
    "controlTip0": "Download flashcards for Anki (TSV)",
    "controlTip1": "Questions alternate between topics",
    "controlTip2": "Pause or resume physics",
    "controlTip3": "Zoom in",
    "controlTip4": "Zoom out",
    "controlTip5": "Reset view",
    "controlTip6": "Filter by maps",
    "controlTip7": "Filter by sources",
    "controlTip8": "Filter by atomic notes",
    "controlTip9": "Paste clipboard content",
    "controlTip10": "Load a .json file",
    "controlTip11": "View and copy the master prompt",
    "controlTip12": "Load sample JSON",
    "formCopy0": "Idea (in your own words) *",
    "formCopy1": "Idea (in my own words) *",
    "formCopy2": "Pasting is disabled. Producing the content yourself strengthens recall.",
    "guideReasonBody": "Explaining the reason for a connection encourages relational processing and helps prevent disconnected collections of notes."
  }
};
for (const lang of ['es', 'en']) Object.assign(I18N[lang], CONTROL_COPY[lang]);

const GRAPH_COPY = {
  "graphFit": [
    "Ajustar vista",
    "Fit view"
  ],
  "graphRetry": [
    "Reintentar",
    "Retry"
  ],
  "graphSelectTitle": [
    "Explora una conexión",
    "Explore a connection"
  ],
  "graphSelectHint": [
    "Selecciona un nodo para ver su título completo, sus etiquetas y sus conexiones. También puedes usar la lista de notas.",
    "Select a node to see its full title, tags, and connections. You can also use the note list."
  ],
  "graphOpenNote": [
    "Abrir nota",
    "Open note"
  ],
  "graphConnections": [
    "conexiones",
    "connections"
  ],
  "graphNotes": [
    "notas",
    "notes"
  ],
  "graphIsolated": [
    "Esta nota todavía no tiene conexiones.",
    "This note has no connections yet."
  ],
  "graphMapLink": [
    "Subtema del mapa",
    "Map subtopic"
  ],
  "graphSourceLink": [
    "Fuente de la idea",
    "Source of the idea"
  ],
  "graphNoteLink": [
    "Notas conectadas",
    "Linked notes"
  ],
  "graphLoading": [
    "Cargando el grafo…",
    "Loading graph…"
  ],
  "graphError": [
    "No se pudo cargar el grafo. Reintenta la conexión.",
    "Could not load the graph. Please retry."
  ],
  "graphNoMatches": [
    "No hay coincidencias. Cambia los filtros o restablece el grafo.",
    "No matches. Change the filters or reset the graph."
  ],
  "graphNoNotes": [
    "Tu grafo comienza con una nota. Crea una nota atómica, una fuente o un mapa.",
    "Your graph starts with a note. Create an atomic note, source, or map."
  ],
  "graphPause": [
    "Pausar movimiento",
    "Pause layout"
  ],
  "graphResume": [
    "Reanudar movimiento",
    "Resume layout"
  ],
  "graphHelp": [
    "Selecciona un nodo para explorar sus conexiones. Arrastra el fondo para desplazar; usa la rueda para ampliar. Teclado: + / − para zoom, 0 para ajustar.",
    "Select a node to inspect its connections. Drag the background to pan; scroll to zoom. Keyboard: + / − to zoom, 0 to fit."
  ],
  "graphList": [
    "Explorar notas coincidentes",
    "Browse matching notes"
  ],
  "grafoDesc": [
    "Explora las relaciones entre tus notas y consulta cada conexión sin perder el contexto.",
    "Explore relationships between your notes and inspect each connection in context."
  ],
  "grafoHint": [
    "Filtra por tipo. Las líneas discontinuas representan subtemas de mapas.",
    "Filter by type. Dashed lines represent map subtopics."
  ]
};
for (const [key, values] of Object.entries(GRAPH_COPY)) { I18N.es[key] = values[0]; I18N.en[key] = values[1]; }

I18N.en.graphMethod = 'About this graph';
I18N.es.graphMethod = 'Acerca de este grafo';

// Helper de traducción
function t(key, lang = (window.__alenotes_lang || 'en')) {
  const dictionary = I18N[lang] || I18N.en;
  return dictionary[key] || I18N.es[key] || key;
}

window.I18N = I18N;
window.t = t;
window.MASTER_LLM_PROMPT_ES = MASTER_LLM_PROMPT_ES;
window.MASTER_LLM_PROMPT_EN = MASTER_LLM_PROMPT_EN;
