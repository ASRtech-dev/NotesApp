// ========================================================
// NotesApp — Sistema de Internacionalización (i18n)
// Soporte Bilingüe: Español (ES) & Inglés (EN)
// ========================================================

const MASTER_LLM_PROMPT_ES = `Eres un especialista de élite en Ciencias Cognitivas y Arquitectura de Gestión de Conocimiento basado en Evidencia, operando bajo las reglas del sistema NotesApp.

Tu misión es recibir la documentación, texto o transcripción adjunta, analizarla exhaustivamente y extraer una red estructurada de conocimiento compuesta por:
1. Notas Fuente (notas_fuente): Síntesis bibliográfica del material de origen.
2. Notas Atómicas (notas_atomicas): Unidades conceptuales indivisibles reformuladas generativamente en palabras propias.
3. Autoevaluación Activa (autoevaluacion): Flashcards de práctica de recuperación (practice testing) para el algoritmo SM-2.
4. Mapas de Contenido (mapas_contenido): Organizadores temáticos jerárquicos con justificación relacional obligatoria (Kiewra et al. 1991).
5. Carpetas y Hashtags (carpetas y tags): Organización temática limpia.

REGLAS CIENTÍFICAS Y PEDAGÓGICAS INQUEBRANTABLES:

1. Principio de Atomicidad Estricta (Luhmann Zettelkasten):
   - Cada nota atómica debe contener EXACTAMENTE UNA SOLA IDEA O CONCEPTO AUTÓNOMO. Si un párrafo contiene dos ideas distintas, crea dos notas atómicas separadas.
   - Efecto de Generación: La explicación en el campo 'idea' debe estar redactada en palabras propias con profundidad y claridad conceptual. NUNCA copies ni pegues frases literales del texto original. Explica el mecanismo subyacente.
   - Cada nota atómica debe explicar explícitamente:
     - 'idea': Definición y desarrollo conceptual en palabras propias.
     - 'por_que_importa': Relevancia práctica, impacto o fundamentación explicativa.
     - 'como_se_conecta': Cómo interactúa o complementa a otras ideas, usando wikilinks [[slug-de-otra-nota]].

2. Práctica de Recuperación Activa Obligatoria (Dunlosky et al. 2013 / SM-2):
   - TODA nota atómica DEBE tener su objeto 'autoevaluacion'.
   - 'pregunta': Pregunta abierta y desafiante que obligue al cerebro a reconstruir el concepto mentalmente (evita preguntas triviales de sí/no o verdadero/falso).
   - 'respuesta': Respuesta concisa, precisa y auto-contenida con la clave conceptual.

3. Mapas de Contenido y Justificación Relacional (Kiewra et al. 1991):
   - Todo mapa de contenido agrupa notas atómicas bajo un paraguas temático estructurado.
   - REGLA OBLIGATORIA: Cada subtema en 'subtemas' DEBE tener un campo 'razon' que explique clara y específicamente POR QUÉ esa nota atómica pertenece y aporta a ese mapa temático. Enlaces sin razón serán rechazados.

4. Identificadores (Slugs):
   - Los 'id' deben ser slugs limpios en minúsculas con guiones (p. ej. fuente-autor-ano, atomica-concepto-clave, mapa-tema-general).
   - Prefijos obligatorios: 'fuente-' para fuentes, 'atomica-' para atómicas, 'mapa-' para mapas.

FORMATO JSON REQUERIDO (SCHEMA ESTRICTO):

Debes responder ÚNICAMENTE con un bloque JSON válido (sin saludos, sin explicaciones introductorias ni notas finales) respetando exactamente la siguiente estructura:

{
  "version": "1.0",
  "carpetas": {
    "atomica": ["nombre-de-carpeta"],
    "fuente": ["nombre-de-carpeta"]
  },
  "notas_fuente": [
    {
      "id": "fuente-nombre-documento",
      "titulo": "Título de la Obra o Documento",
      "autor": "Nombre del autor o institución",
      "tipo_fuente": "libro",
      "carpeta": "nombre-de-carpeta",
      "tags": ["etiqueta1", "etiqueta2"],
      "puntos_clave": "Resumen conciso y parafraseado de las tesis centrales del documento.",
      "citas_textuales": [
        "Cita literal textual representativa 1"
      ],
      "ideas_disparadas": [
        "atomica-concepto-uno"
      ]
    }
  ],
  "notas_atomicas": [
    {
      "id": "atomica-concepto-uno",
      "titulo": "Nombre Claro y Declarativo de la Idea",
      "fuente": "fuente-nombre-documento",
      "carpeta": "nombre-de-carpeta",
      "tags": ["etiqueta1", "etiqueta3"],
      "idea": "Explicación completa, rigurosa y redactada enteramente en palabras propias de la idea central. Debe ser autónoma y comprensible por sí misma.",
      "por_que_importa": "Por qué este concepto es fundamental, qué consecuencias prácticas tiene o qué mecanismo explica.",
      "como_se_conecta": "Conecta directamente con [[atomica-concepto-dos]] y con los principios generales del tema.",
      "enlaces": ["atomica-concepto-dos"],
      "autoevaluacion": {
        "pregunta": "¿Cuál es el mecanismo principal de este concepto y cómo opera?",
        "respuesta": "La clave reside en [Respuesta precisa y concreta]."
      }
    }
  ],
  "mapas_contenido": [
    {
      "id": "mapa-tema-central",
      "titulo": "Organizador Conceptual del Tema",
      "carpeta": "",
      "tags": ["sintesis", "etiqueta1"],
      "descripcion": "Visión panorámica de la jerarquía temática y cómo se integran las partes.",
      "subtemas": [
        {
          "nota_id": "atomica-concepto-uno",
          "razon": "Constituye el fundamento biológico y conceptual del que parten el resto de las técnicas."
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
4. Content Maps (mapas_contenido): Hierarchical thematic organizers with mandatory relational justifications (Kiewra et al. 1991).
5. Folders and Hashtags (carpetas and tags): Clean thematic organization.

UNBREAKABLE SCIENTIFIC AND PEDAGOGICAL RULES:

1. Strict Atomicity Principle (Luhmann Zettelkasten):
   - Each atomic note MUST contain EXACTLY ONE AUTONOMOUS IDEA OR CONCEPT. If a paragraph discusses two distinct ideas, create two separate atomic notes.
   - Generation Effect: The explanation in the 'idea' field MUST be written in your own words with conceptual depth. NEVER copy-paste verbatim sentences from the original source. Explain the underlying mechanism.
   - Each atomic note must explicitly address:
     - 'idea': Rigorous conceptual definition and development in your own words.
     - 'por_que_importa': Practical significance, impact, or explanatory foundation.
     - 'como_se_conecta': How it interacts or connects with other ideas, using wikilinks [[slug-of-other-note]].

2. Mandatory Active Recall Testing (Dunlosky et al. 2013 / SM-2):
   - EVERY atomic note MUST contain an 'autoevaluacion' object.
   - 'pregunta': Open, challenging retrieval question that forces the brain to mentally reconstruct the concept (avoid trivial yes/no or true/false questions).
   - 'respuesta': Concise, precise, and self-contained answer with the key mechanism.

3. Content Maps and Mandatory Relational Reasoning (Kiewra et al. 1991):
   - Every content map groups atomic notes under a structured thematic umbrella.
   - MANDATORY RULE: Every subtopic in 'subtemas' MUST have a 'razon' field explaining clearly and specifically WHY that atomic note belongs to and enriches this thematic map. Links without a reason will be rejected.

4. Identifiers (Slugs):
   - The 'id' fields must be clean lowercase hyphenated slugs (e.g., fuente-author-year, atomica-key-concept, mapa-general-theme).
   - Mandatory prefixes: 'fuente-' for sources, 'atomica-' for atomic notes, 'mapa-' for content maps.

REQUIRED JSON FORMAT (STRICT SCHEMA):

Respond ONLY with a valid JSON block (no greetings, no markdown chat explanations, no closing notes) strictly adhering to the following structure:

{
  "version": "1.0",
  "carpetas": {
    "atomica": ["folder-name"],
    "fuente": ["folder-name"]
  },
  "notas_fuente": [
    {
      "id": "fuente-document-name",
      "titulo": "Title of Work or Document",
      "autor": "Author or Institution Name",
      "tipo_fuente": "libro",
      "carpeta": "folder-name",
      "tags": ["tag1", "tag2"],
      "puntos_clave": "Concise paraphrased summary of the document's central theses.",
      "citas_textuales": [
        "Representative verbatim quotation 1"
      ],
      "ideas_disparadas": [
        "atomica-concept-one"
      ]
    }
  ],
  "notas_atomicas": [
    {
      "id": "atomica-concept-one",
      "titulo": "Clear Declarative Idea Title",
      "fuente": "fuente-document-name",
      "carpeta": "folder-name",
      "tags": ["tag1", "tag3"],
      "idea": "Comprehensive, rigorous explanation written entirely in your own words. It must be autonomous and understandable on its own.",
      "por_que_importa": "Why this concept is fundamental, its practical implications, or what mechanism it explains.",
      "como_se_conecta": "Directly connects with [[atomica-concept-two]] and the overarching principles of the topic.",
      "enlaces": ["atomica-concept-two"],
      "autoevaluacion": {
        "pregunta": "What is the core mechanism of this concept and how does it operate?",
        "respuesta": "The key lies in [Precise and concrete conceptual answer]."
      }
    }
  ],
  "mapas_contenido": [
    {
      "id": "mapa-central-theme",
      "titulo": "Conceptual Theme Organizer",
      "carpeta": "",
      "tags": ["synthesis", "tag1"],
      "descripcion": "Panoramic view of the thematic hierarchy and how the components integrate.",
      "subtemas": [
        {
          "nota_id": "atomica-concept-one",
          "razon": "Constitutes the biological and conceptual foundation from which the remaining techniques branch."
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
    toggleTheme: "Alternar tema claro/oscuro",

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
    newFolder: "+ 📁 Nueva Carpeta",
    newNote: "+ Nueva Nota",
    loading: "Cargando...",
    viewCards: "Tarjetas",
    viewMatrix: "Matriz Conceptual",
    copy: "Copiar",
    copied: "Copiado",

    // Section Explanations
    explainerHide: "Ocultar explicación",
    explainerShow: "Ver explicación",
    
    // 1. Home View
    homeTitle: "Bienvenido a NotesApp",
    homeSubtitle: "El sistema de notas personales diseñado bajo los principios de las Ciencias Cognitivas para maximizar comprensión y retención a largo plazo.",
    homeBadgeEvidence: "Dunlosky 2013 • Luhmann Zettelkasten • Kiewra 1991 • Ebbinghaus SM-2",
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
    homeFolder4Desc: "Archivos mapa-*.md. Estructuras conceptuales de alto nivel (Kiewra 1991). Exigen obligatoriamente una razón que justifique por qué cada nota pertenece a ese mapa.",

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
    atomicasExplainerTitle: "⚛️ Principio de Atomicidad y Efecto de Generación (Luhmann & Slamecka 1978)",
    atomicasExplainerText: "Cada nota atómica debe ser comprensible por sí misma y abarcar un único concepto. Redactarla enteramente con tus palabras (Efecto de Generación) obliga a tu cerebro a reconstruir el significado, multiplicando la retención comparado con copiar y pegar.",
    btnNewAtomica: "+ Nueva Nota Atómica",
    atomicasEmpty: "No hay notas atómicas registradas con estos filtros.",

    // 4. Fuentes View
    fuentesTitle: "Notas Fuente",
    fuentesDesc: "Registro bibliográfico, citas y puntos clave de artículos, libros o videos consultados.",
    fuentesExplainerTitle: "📚 Anclaje Bibliográfico y Síntesis Crítica",
    fuentesExplainerText: "Las notas fuente preservan la autoría y las citas textuales originales. Te permiten auditar de dónde provino un conocimiento y disparar nuevas ideas atómicas sin contaminar la pureza conceptual de tu red.",
    btnNewFuente: "+ Nueva Nota Fuente",
    fuentesEmpty: "No hay notas fuente registradas con estos filtros.",

    // 5. Mapas View
    mapasTitle: "Mapas de Contenido",
    mapasDesc: "Estructuras jerárquicas con razón de conexión obligatoria (Kiewra et al. 1991).",
    mapasExplainerTitle: "🗺️ Organización Matricial vs Listas Pasivas (Kiewra 1991)",
    mapasExplainerText: "Crear listas jerárquicas pasivas produce la ilusión de competencia. En NotesApp, cada nota añadida a un mapa exige obligatoriamente explicar la 'razón' de su relación, obligándote a procesar las conexiones conceptuales profundas.",
    btnNewMapa: "+ Nuevo Mapa",
    mapasEmpty: "No hay mapas de contenido creados aún.",

    // 6. Repaso View
    repasoTitle: "Sesión de Repaso Espaciado",
    repasoDesc: "Algoritmo SM-2 optimizado con Interleaving round-robin por tema para máxima consolidación.",
    repasoExplainerTitle: "⚡ Práctica de Recuperación Activa con Intercalado (Dunlosky 2013 & SM-2)",
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
    llmStudioSubtitle: "Transforma cualquier texto, libro, curso o transcripción en un paquete estructurado y compatible con NotesApp.",
    llmExplainerTitle: "🧠 Arquitectura Cognitiva del Prompt de NotesApp",
    llmExplainerText: "Los LLMs tienden a resumir pasivamente o citar textualmente. Este prompt maestro los obliga a actuar como ingenieros cognitivos: impone la regla de una idea por nota, bloquea el texto copiado forzando redacción autónoma, genera flashcards SM-2 y exige justificaciones relacionales en cada mapa.",
    promptLangLabel: "Idioma del Prompt:",
    btnCopyPrompt: "📋 Copiar Prompt al Portapapeles",
    btnLaunchImport: "📥 Ir a Importar JSON",
    promptRulesTitle: "Las 4 Reglas Científicas Inquebrantables del Prompt",
    promptRule1Title: "1. Atomicidad Estricta (Luhmann)",
    promptRule1Desc: "Exactamente una idea autónoma por nota. Si el texto tiene varios conceptos, el modelo los divide en archivos independientes.",
    promptRule2Title: "2. Efecto de Generación (Slamecka)",
    promptRule2Desc: "Prohibido copiar/pegar párrafos literales. El LLM debe explicar con palabras directas el mecanismo conceptual subyacente.",
    promptRule3Title: "3. Autoevaluación SM-2 (Dunlosky)",
    promptRule3Desc: "Cada nota atómica debe tener una pregunta retadora y respuesta precisa para alimentar la práctica de recuperación activa.",
    promptRule4Title: "4. Mapas con Razón Obligatoria (Kiewra)",
    promptRule4Desc: "Ninguna nota se vincula a un mapa sin un campo 'razon' explícito que justifique su aporte relacional.",

    // 10. Modals
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
    importEmptyStatus: "⚠️ JSON válido pero sin notas reconocidas"
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
    toggleTheme: "Toggle light/dark theme",

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
    newFolder: "+ 📁 New Folder",
    newNote: "+ New Note",
    loading: "Loading...",
    viewCards: "Cards",
    viewMatrix: "Conceptual Matrix",
    copy: "Copy",
    copied: "Copied",

    // Section Explanations
    explainerHide: "Hide explanation",
    explainerShow: "Show explanation",

    // 1. Home View
    homeTitle: "Welcome to NotesApp",
    homeSubtitle: "The personal knowledge system engineered around Cognitive Science principles to maximize long-term comprehension and retention.",
    homeBadgeEvidence: "Dunlosky 2013 • Luhmann Zettelkasten • Kiewra 1991 • Ebbinghaus SM-2",
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
    homeFolder4Desc: "Files named mapa-*.md. High-level conceptual organizers (Kiewra 1991). Strictly requires a relational reason explaining why each note belongs to that thematic map.",

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
    atomicasExplainerTitle: "⚛️ Atomicity Principle & Generation Effect (Luhmann & Slamecka 1978)",
    atomicasExplainerText: "Each atomic note must be self-contained and discuss exactly one concept. Explaining it entirely in your own words (Generation Effect) forces conceptual reconstruction, dramatically boosting retention over passive copying.",
    btnNewAtomica: "+ New Atomic Note",
    atomicasEmpty: "No atomic notes found matching these filters.",

    // 4. Fuentes View
    fuentesTitle: "Source Notes",
    fuentesDesc: "Bibliographic registry, verbatim quotes, and key paraphrased takeaways from consulted works.",
    fuentesExplainerTitle: "📚 Bibliographic Grounding & Critical Synthesis",
    fuentesExplainerText: "Source notes safeguard authorship and exact citations. They allow you to trace the origin of an idea and spark new atomic concepts without contaminating the conceptual purity of your permanent network.",
    btnNewFuente: "+ New Source Note",
    fuentesEmpty: "No source notes found matching these filters.",

    // 5. Mapas View
    mapasTitle: "Content Maps",
    mapasDesc: "Hierarchical structures with mandatory relational reasoning (Kiewra et al. 1991).",
    mapasExplainerTitle: "🗺️ Matrix Organization vs Passive Outlines (Kiewra 1991)",
    mapasExplainerText: "Linear outlines foster illusions of competence. In NotesApp, every note added to a map strictly requires a 'reason' explaining its relationship, training high-order relational processing.",
    btnNewMapa: "+ New Content Map",
    mapasEmpty: "No content maps created yet.",

    // 6. Repaso View
    repasoTitle: "Spaced Repetition Session",
    repasoDesc: "Optimized SM-2 algorithm with round-robin topic interleaving for maximum consolidation.",
    repasoExplainerTitle: "⚡ Active Retrieval Practice with Interleaving (Dunlosky 2013 & SM-2)",
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
    llmStudioSubtitle: "Transform any document, book, course, or transcript into a structured package compatible with NotesApp.",
    llmExplainerTitle: "🧠 Cognitive Architecture of the NotesApp Prompt",
    llmExplainerText: "Language models typically summarize passively or copy verbatim. This master prompt forces the AI to behave as a cognitive architect: enforces strict single-idea atomicity, blocks copy-pasting to ensure generative wording, creates SM-2 flashcards, and requires relational reasons in every content map.",
    promptLangLabel: "Prompt Language:",
    btnCopyPrompt: "📋 Copy Prompt to Clipboard",
    btnLaunchImport: "📥 Go to Import JSON",
    promptRulesTitle: "The 4 Unbreakable Scientific Rules of the Prompt",
    promptRule1Title: "1. Strict Atomicity (Luhmann)",
    promptRule1Desc: "Exactly one autonomous idea per note. If the source material touches multiple concepts, the AI splits them into independent files.",
    promptRule2Title: "2. Generation Effect (Slamecka)",
    promptRule2Desc: "Copying verbatim paragraphs is prohibited. The LLM must clearly explain the underlying mechanism in its own words.",
    promptRule3Title: "3. Active Recall SM-2 (Dunlosky)",
    promptRule3Desc: "Every atomic note must have an open retrieval question and key answer to fuel spaced retrieval practice.",
    promptRule4Title: "4. Content Maps with Mandatory Reason (Kiewra)",
    promptRule4Desc: "No note is linked to a map without an explicit 'razon' field explaining why and how it enriches that conceptual organizer.",

    // 10. Modals
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
    importEmptyStatus: "⚠️ Valid JSON but no recognizable notes"
  }
};


// Progressive-disclosure Home and shared navigation copy.
const HOME_COPY = {
  "es": {
    "homeDetail0": "Fricción Cero • Sweller 1988",
    "homeDetail1": "Anclaje Bibliográfico",
    "homeDetail2": "Razón Obligatoria • Kiewra 1991",
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
    "evidenceTooltip": "Metodología basada en Dunlosky et al. (2013) y Kiewra et al. (1991)"
  },
  "en": {
    "homeDetail0": "Zero friction • Sweller 1988",
    "homeDetail1": "Bibliographic grounding",
    "homeDetail2": "Required connection reason • Kiewra 1991",
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
    "evidenceTooltip": "Method based on Dunlosky et al. (2013) and Kiewra et al. (1991)"
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
    "uiCopy7": "Guía del Sistema y Fundamentos Científicos",
    "uiCopy8": "Por qué NotesApp no es un editor convencional: evidencia cognitiva de cada módulo y mejores prácticas.",
    "uiCopy9": "🔄 El Flujo Cognitivo en 5 Pasos",
    "uiCopy10": "Captura Rápida",
    "uiCopy11": "Procesar a Fuente",
    "uiCopy12": "Nota Atómica",
    "uiCopy13": "Estructura en Mapas",
    "uiCopy14": "razón",
    "uiCopy15": "Recuperación Activa",
    "uiCopy16": "🔬 El Respaldo de Investigación Científica",
    "uiCopy17": "UTILIDAD ALTA",
    "uiCopy18": "Autoevaluación (Practice Testing)",
    "uiCopy19": "Intentar recordar una respuesta desde la memoria produce un efecto de retención hasta un 50% superior a releer pasivamente. Por eso cada nota atómica tiene su pregunta asociada.",
    "uiCopy20": "Práctica Distribuida (Spaced Repetition)",
    "uiCopy21": "El cerebro consolida recuerdos durante el descanso y el sueño. Espaciar los repasos con SM-2 aplana la curva del olvido multiplicando la duración del recuerdo.",
    "uiCopy22": "DISCRIMINACIÓN COGNITIVA",
    "uiCopy23": "Intercalado (Interleaving)",
    "uiCopy24": "Repasar temas en bloques crea familiaridad engañosa. Al intercalar round-robin preguntas de temas distintos, el cerebro debe identificar primero qué concepto aplicar.",
    "uiCopy25": "CODIFICACIÓN PROFUNDA",
    "uiCopy26": "Efecto de Generación",
    "uiCopy27": "Generar una frase propia exige reconstruir el significado. Por eso NotesApp bloquea el copiado/pegado literal en las ideas y alerta sobre solapamiento de n-gramas.",
    "uiCopy28": "ORGANIZACIÓN MATRICIAL",
    "uiCopy29": "Matrices vs Outlines Lineales",
    "uiCopy30": "UTILIDAD BAJA (DESACONSEJADO)",
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
    "uiCopy7": "System guide and learning principles",
    "uiCopy8": "How NotesApp works: the learning principles behind each module and how to use them.",
    "uiCopy9": "The learning workflow in five steps",
    "uiCopy10": "Quick capture",
    "uiCopy11": "Process into a source",
    "uiCopy12": "Atomic note",
    "uiCopy13": "Organize into maps",
    "uiCopy14": "reason",
    "uiCopy15": "Active recall",
    "uiCopy16": "Supporting research",
    "uiCopy17": "HIGH UTILITY",
    "uiCopy18": "Self-testing (practice testing)",
    "uiCopy19": "Trying to recall an answer from memory can improve retention compared with passive rereading. Each atomic note therefore has an associated question.",
    "uiCopy20": "Distributed practice (spaced repetition)",
    "uiCopy21": "The brain consolidates memories during rest and sleep. Spacing reviews with SM-2 helps counter forgetting and supports longer retention.",
    "uiCopy22": "CONCEPT DISCRIMINATION",
    "uiCopy23": "Interleaving",
    "uiCopy24": "Reviewing topics in blocks can create misleading familiarity. Alternating questions across topics requires you to identify which concept to apply.",
    "uiCopy25": "DEEP ENCODING",
    "uiCopy26": "Generation effect",
    "uiCopy27": "Writing in your own words requires reconstructing meaning. NotesApp blocks pasting in idea fields and warns about phrase overlap with the source.",
    "uiCopy28": "MATRIX ORGANIZATION",
    "uiCopy29": "Matrices and linear outlines",
    "uiCopy30": "LOW UTILITY (DISCOURAGED)",
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
    "fieldHint0": "ej. Dunlosky et al. (2013)",
    "fieldHint1": "ej. Dunlosky, Rawson...",
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
    "guideStepBody2": "Formula la idea con tus propias palabras (Efecto de generación). Escribe por qué importa y cómo se conecta.",
    "guideStepBody3": "Integra la idea en un mapa temático. Explica obligatoriamente la razón de la relación.",
    "guideStepBody4": "Responde la pregunta generada. El algoritmo SM-2 con interleaving la espaciará en el momento justo."
  },
  "en": {
    "fieldHint0": "e.g. Dunlosky et al. (2013)",
    "fieldHint1": "e.g. Dunlosky, Rawson…",
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
    "guideStepBody2": "Write the idea in your own words (generation effect). Explain why it matters and how it connects.",
    "guideStepBody3": "Add the idea to a thematic map. Explain the reason for its connection.",
    "guideStepBody4": "Answer the generated question. SM-2 schedules further reviews, interleaved with other topics."
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
