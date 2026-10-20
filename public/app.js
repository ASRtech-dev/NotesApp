// ========================================================
// NotesApp v3 — Aplicación Cliente SPA
// Preview-First, Carpetas, Hashtags y Grafo de Conocimiento
// ========================================================

const state = {
  notes: {
    bandeja: [],
    fuente: [],
    atomica: [],
    mapa: [],
    preguntasCount: 0
  },
  folders: {
    atomica: [],
    fuente: [],
    mapa: [],
    bandeja: []
  },
  currentView: 'inicio',
  lang: (['en', 'es'].includes(localStorage.getItem('notesapp_lang') || localStorage.getItem('alenotes_lang')) ? (localStorage.getItem('notesapp_lang') || localStorage.getItem('alenotes_lang')) : 'en'),
  userName: localStorage.getItem('notesapp_user_name') || '',
  onboardingStep: 1,
  inboxFilter: 'pendientes',
  mapViewMode: 'cards', // 'cards' | 'matrix'
  reviewQueue: [],
  currentReviewIndex: 0,
  isAnswerRevealed: false,
  activeInboxItem: null,
  activeMapSubtemas: [],
  theme: localStorage.getItem('alenotes_theme') || 'light',
  graphZoom: 1.0,
  graphSearchQuery: '',
  selectedGraphTag: '',
  isGraphPhysicsActive: true,
  selectedAtomicaFolder: '',
  selectedAtomicaTag: '',
  selectedFuenteFolder: '',
  selectedFuenteTag: '',
  selectedGraphType: null,
  activeField: null,
  activeProject: null,
  projects: [],
  fuenteTypeFilter: 'all',
  atomicaTypeFilter: 'all',
  fuenteLayoutMode: 'grid',
  atomicaLayoutMode: 'grid',
  homeModuleFilter: '',
  homeLessonFilter: '',
  homeSearchQuery: '',
  homeExpandedKeys: {},
  selectedAtomicaModulo: '',
  selectedAtomicaLeccion: '',
  atomicaSearchQuery: '',
  selectedFuenteModulo: '',
  selectedFuenteLeccion: '',
  fuenteSearchQuery: '',
  mapaTypeFilter: 'all',
  selectedMapaModulo: '',
  selectedMapaLeccion: '',
  mapaSearchQuery: '',
  mapasExpandedKeys: {},
  activeExpandedFuenteId: null,
  activeExpandedFuenteTab: null,
  showFuentesFoldersDrawer: false
};

// -------------------------------------------------------------
// Inicialización
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initLanguage();
  initLlmStudio();
  initNavigation();
  initProjectScoping();
  initQuickCapture();
  initModalsAndForms();
  initAntiCopyControls();
  initWikilinkAutocomplete();
  initGlobalSearch();
  initKeyboardShortcuts();
  initEditorTabs();
  initGraphControls();
  initFolderAndTagControls();
  initJsonImport();
  initOnboarding();
  loadAllData();
  checkAutoOnboarding();
});


// -------------------------------------------------------------
// Renderizador Markdown y Utilidades
// -------------------------------------------------------------
async function apiFetch(url, options = {}) {
  const response = await fetch(url, { cache: 'no-store', ...options });
  if (!response.ok) throw new Error('Request failed: ' + response.status);
  return response;
}
function slugifyClient(text) {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
function noteMatchesActiveScope(n) {
  if (!n) return false;
  if (!state.activeField && !state.activeProject) return true;
  const nCampo = (n.campo || (n.data && n.data.campo) || '').trim();
  const nProy = (n.proyecto || (n.data && n.data.proyecto) || '').trim();
  const nFolder = ((n.data && n.data.carpeta) || n.carpeta || '').replace(/\\/g, '/');

  if (state.activeProject) {
    const activePSlug = slugifyClient(state.activeProject);
    const proyMatches = nProy === state.activeProject || (activePSlug && slugifyClient(nProy) === activePSlug) || (activePSlug && nFolder.endsWith('/' + activePSlug));
    if (!proyMatches) return false;
    if (state.activeField) {
      const activeCSlug = slugifyClient(state.activeField);
      const campoMatches = nCampo === state.activeField || (activeCSlug && slugifyClient(nCampo) === activeCSlug) || (activeCSlug && nFolder.startsWith(activeCSlug + '/'));
      if (!campoMatches) {
        const sameNameProjects = (state.projects || []).filter(p => slugifyClient(p.proyecto) === activePSlug);
        if (sameNameProjects.length > 1) return false;
      }
    }
    return true;
  }

  if (state.activeField) {
    const activeCSlug = slugifyClient(state.activeField);
    return nCampo === state.activeField || (activeCSlug && slugifyClient(nCampo) === activeCSlug) || (activeCSlug && (nFolder === activeCSlug || nFolder.startsWith(activeCSlug + '/')));
  }
  return true;
}
function inlineArgument(value) {
  return escapeHtml(JSON.stringify(String(value)));
}
function humanizeSlug(slug) {
  if (!slug) return '';
  return String(slug)
    .replace(/^atomica-/, '')
    .replace(/^fuente-/, '')
    .replace(/^mapa-/, '')
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
function ui(es, en) { return state.lang === 'en' ? en : es; }

function getCardSnippet(rawText, maxLen = 220) {
  if (!rawText) return '';
  let clean = String(rawText)
    .replace(/^##+\s+[^\n]+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[\[([a-zA-Z0-9_-]+)\]\]/g, '$1')
    .replace(/^[-*]\s+/gm, '')
    .replace(/^[0-9]+\.\s+/gm, '')
    .replace(/\n+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (clean.length > maxLen) {
    clean = clean.substring(0, maxLen).trim() + '…';
  }
  return clean;
}

function renderMarkdown(md) {
  if (!md) return '';

  // Pre-process: extract fenced code blocks to protect them
  const codeBlocks = [];
  let processed = md.replace(/```([\s\S]*?)```/g, (match, code) => {
    codeBlocks.push(code);
    return `%%CODEBLOCK_${codeBlocks.length - 1}%%`;
  });

  // Dynamic header localization based on active language
  if (state.lang === 'en') {
    processed = processed
      .replace(/^##\s+Idea\s+\(con mis palabras\)/gim, '## Idea (in my own words)')
      .replace(/^##\s+¿?Por qué importa\??/gim, '## Why it matters')
      .replace(/^##\s+¿?Cómo se conecta con lo que ya sé\??/gim, '## How it connects with what I already know')
      .replace(/^##\s+Puntos clave\s*\(parafraseados,?\s*no copiados\)/gim, '## Key points (paraphrased, not copied)')
      .replace(/^##\s+Citas textuales relevantes/gim, '## Relevant verbatim quotations')
      .replace(/^##\s+Ideas propias que dispara/gim, '## Ideas it sparks')
      .replace(/^###\s+Pregunta de Autoevaluación/gim, '### Self-Assessment Question')
      .replace(/^\*\*P:\*\*/gm, '**Q:**')
      .replace(/^\*\*R:\*\*/gm, '**A:**');
  } else {
    processed = processed
      .replace(/^##\s+Idea\s+\(in my own words\)/gim, '## Idea (con mis palabras)')
      .replace(/^##\s+Why it matters\??/gim, '## ¿Por qué importa?')
      .replace(/^##\s+How it connects(?: with what I already know)?\??/gim, '## ¿Cómo se conecta con lo que ya sé?')
      .replace(/^##\s+Key points\s*\(paraphrased,?\s*not copied\)/gim, '## Puntos clave (parafraseados, no copiados)')
      .replace(/^##\s+Relevant verbatim quotations/gim, '## Citas textuales relevantes')
      .replace(/^##\s+Ideas it sparks/gim, '## Ideas propias que dispara')
      .replace(/^###\s+Self-Assessment Question/gim, '### Pregunta de Autoevaluación')
      .replace(/^\*\*Q:\*\*/gm, '**P:**')
      .replace(/^\*\*A:\*\*/gm, '**R:**');
  }

  let html = escapeHtml(processed);

  // Wikilinks [[slug]] -> Badge interactivo clickeable y acceso directo a Google
  html = html.replace(/\[\[([a-zA-Z0-9_-]+)\]\]/g, (match, slug) => {
    const slugName = humanizeSlug(slug);
    return `<span class="wikilink-badge-group"><a href="#" class="wikilink-badge" onclick="event.preventDefault(); openReaderModal('atomica', '${slug}')">⚛️ ${slug}</a><a href="https://www.google.com/search?q=${encodeURIComponent(slugName || slug)}" target="_blank" rel="noopener noreferrer" class="wikilink-google" title="${ui("Buscar en Google: ", "Search on Google: ")}${escapeHtml(slugName || slug)}">🔍</a></span>`;
  });

  // Hashtags #tag -> Badge interactivo
  html = html.replace(/(^|\s)#([a-zA-Z0-9_\u00C0-\u017F-]+)/g, (match, space, tag) => {
    return `${space}<span class="badge-hashtag" onclick="filterByTag('${tag}')">#${tag}</span>`;
  });

  // Section Headers with High-Contrast Stylized Badges
  html = html.replace(/^##\s+(Idea\s+\((?:con mis palabras|in my own words)\)|Idea)$/gim,
    '<h2 class="reader-heading reader-heading-idea"><span class="heading-icon">💡</span> $1</h2>');
  html = html.replace(/^##\s+(¿?Por qué importa\??|Why it matters\??)$/gim,
    '<h2 class="reader-heading reader-heading-why"><span class="heading-icon">🎯</span> $1</h2>');
  html = html.replace(/^##\s+(¿?Cómo se conecta(?: con lo que ya sé)?\??|How it connects(?: with what I already know)?\??)$/gim,
    '<h2 class="reader-heading reader-heading-connect"><span class="heading-icon">🔗</span> $1</h2>');
  html = html.replace(/^##\s+(Puntos clave\s*\(parafraseados,?\s*no copiados\)|Key points\s*\(paraphrased,?\s*not copied\)|Key points)$/gim,
    '<h2 class="reader-heading reader-heading-points"><span class="heading-icon">📌</span> $1</h2>');
  html = html.replace(/^##\s+(Citas textuales relevantes|Relevant verbatim quotations)$/gim,
    '<h2 class="reader-heading reader-heading-quotes"><span class="heading-icon">💬</span> $1</h2>');
  html = html.replace(/^##\s+(Ideas propias que dispara|Ideas it sparks)$/gim,
    '<h2 class="reader-heading reader-heading-sparks"><span class="heading-icon">⚡</span> $1</h2>');

  // Generic Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Bold and Italic
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Blockquotes
  html = html.replace(/^\&gt;\s?(.*$)/gim, '<blockquote>$1</blockquote>');
  html = html.replace(/^\>\s?(.*$)/gim, '<blockquote>$1</blockquote>');

  // Horizontal rules
  html = html.replace(/^---$/gim, '<hr>');

  // Inline code (with visible contrast)
  html = html.replace(/`([^`]+)`/g, '<code style="background:var(--bg-input);border:1px solid var(--border-color);padding:2px 6px;border-radius:4px;font-family:var(--font-mono);font-size:13px;">$1</code>');

  // Process line-by-line for lists
  const lines = html.split('\n');
  let result = [];
  let inUl = false;
  let inOl = false;
  let currentHeadingType = '';

  for (let line of lines) {
    const trimmed = line.trim();

    if (trimmed.includes('reader-heading-sparks')) {
      currentHeadingType = 'sparks';
    } else if (trimmed.includes('reader-heading-quotes')) {
      currentHeadingType = 'quotes';
    } else if (trimmed.startsWith('<h') || trimmed.startsWith('<hr')) {
      currentHeadingType = '';
    }

    // Unordered list item
    if (/^- (.*)/.test(trimmed) || /^\* (.*)/.test(trimmed)) {
      if (inOl) { result.push('</ol>'); inOl = false; }
      if (!inUl) {
        const ulClass = currentHeadingType === 'sparks' ? ' class="sparked-ideas-cluster"' : '';
        result.push(`<ul${ulClass}>`);
        inUl = true;
      }
      const content = trimmed.replace(/^[-*]\s+/, '');
      result.push(`<li>${content}</li>`);
      continue;
    }

    // Ordered list item
    const olMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (olMatch) {
      if (inUl) { result.push('</ul>'); inUl = false; }
      if (!inOl) { result.push('<ol>'); inOl = true; }
      result.push(`<li>${olMatch[2]}</li>`);
      continue;
    }

    // Close any open lists
    if (inUl) { result.push('</ul>'); inUl = false; }
    if (inOl) { result.push('</ol>'); inOl = false; }

    // Empty line = paragraph break
    if (trimmed === '') {
      if (currentHeadingType !== 'quotes') {
        result.push('<br>');
      }
    } else if (!trimmed.startsWith('<h') && !trimmed.startsWith('<blockquote') && !trimmed.startsWith('<hr')) {
      result.push(`<p>${trimmed}</p>`);
    } else {
      result.push(trimmed);
    }
  }

  if (inUl) result.push('</ul>');
  if (inOl) result.push('</ol>');
  html = result.join('\n');

  // Clean up superfluous line breaks around blockquotes, headings and lists
  html = html.replace(/(<\/blockquote>)\s*(?:<br\s*\/?>\s*)+(<blockquote>)/gi, '$1\n$2');
  html = html.replace(/(<\/h[1-6]>)\s*(?:<br\s*\/?>\s*)+/gi, '$1\n');
  html = html.replace(/(?:<br\s*\/?>\s*)+(<h[1-6]>)/gi, '\n$1');
  html = html.replace(/(?:<br\s*\/?>\s*)+(<ul|<ol)/gi, '\n$1');
  html = html.replace(/(<\/ul>|<\/ol>)\s*(?:<br\s*\/?>\s*)+/gi, '$1\n');

  // Wrap quotes under reader-heading-quotes in a dedicated container
  html = html.replace(/(<h2 class="reader-heading reader-heading-quotes"[^>]*>[\s\S]*?<\/h2>)\s*((?:<blockquote>[\s\S]*?<\/blockquote>\s*)+)/gi, (match, heading, quotes) => {
    return `${heading}\n<div class="reader-quotes-container">\n${quotes.trim()}\n</div>`;
  });
  html = html.replace(/(<\/div>)\s*(?:<br\s*\/?>\s*)+(<h[1-6]>)/gi, '$1\n$2');

  // Restore code blocks
  codeBlocks.forEach((code, i) => {
    html = html.replace(`%%CODEBLOCK_${i}%%`, `<pre><code>${escapeHtml(code).trim()}</code></pre>`);
  });

  return html;
}

// -------------------------------------------------------------
// Gestión de Temas (Claro / Oscuro / Pastel)
// -------------------------------------------------------------
function applyTheme(theme) {
  const validThemes = ['light', 'dark', 'pastel'];
  const activeTheme = validThemes.includes(theme) ? theme : 'light';
  state.theme = activeTheme;
  document.body.className = `theme-${activeTheme}`;
  document.body.setAttribute('data-theme', activeTheme);
  document.documentElement.setAttribute('data-theme', activeTheme);

  const icon = document.getElementById('theme-icon');
  const toggleBtn = document.getElementById('theme-toggle');

  const icons = {
    light: '☀️',
    dark: '🌙',
    pastel: '🎨'
  };
  if (icon) icon.textContent = icons[activeTheme] || '☀️';

  const tooltips = {
    light: ui("Tema actual: Claro (Click para Oscuro)", "Current theme: Light (Click for Dark)"),
    dark: ui("Tema actual: Oscuro (Click para Pastel)", "Current theme: Dark (Click for Pastel)"),
    pastel: ui("Tema actual: Pastel (Click para Claro)", "Current theme: Pastel (Click for Light)")
  };
  if (toggleBtn) {
    toggleBtn.setAttribute('title', tooltips[activeTheme] || '');
  }
}

function initTheme() {
  const saved = localStorage.getItem('alenotes_theme') || 'light';
  applyTheme(saved);

  const toggleBtn = document.getElementById('theme-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const cycle = { light: 'dark', dark: 'pastel', pastel: 'light' };
      const nextTheme = cycle[state.theme] || 'light';
      applyTheme(nextTheme);
      localStorage.setItem('alenotes_theme', state.theme);
      if (state.currentView === 'grafo' && typeof window.renderGraph === 'function') {
        renderGraph();
      }
    });
  }
}

// -------------------------------------------------------------
// Internacionalización (i18n: ES / EN)
// -------------------------------------------------------------
function initLanguage() {
  const savedLang = (['en', 'es'].includes(localStorage.getItem('notesapp_lang') || localStorage.getItem('alenotes_lang')) ? (localStorage.getItem('notesapp_lang') || localStorage.getItem('alenotes_lang')) : 'en');
  setLanguage(savedLang, false);

  const btnLangEs = document.getElementById('btn-lang-es');
  const btnLangEn = document.getElementById('btn-lang-en');
  const btnHeaderLangEs = document.getElementById('btn-header-lang-es');
  const btnHeaderLangEn = document.getElementById('btn-header-lang-en');

  btnLangEs?.addEventListener('click', () => setLanguage('es'));
  btnLangEn?.addEventListener('click', () => setLanguage('en'));
  btnHeaderLangEs?.addEventListener('click', () => setLanguage('es'));
  btnHeaderLangEn?.addEventListener('click', () => setLanguage('en'));
}

function setLanguage(lang, reloadViews = true) {
  lang = lang === 'es' ? 'es' : 'en';
  state.lang = lang;
  window.__alenotes_lang = lang;
  localStorage.setItem('notesapp_lang', lang);
  document.documentElement.lang = lang;

  // Actualizar botones de idioma activos
  document.querySelectorAll('.btn-lang:not([id*="prompt"])').forEach(btn => {
    const isEs = btn.id.toLowerCase().includes('-es') || btn.textContent.trim().toLowerCase() === 'es' || btn.textContent.trim().toLowerCase() === 'español';
    const isEn = btn.id.toLowerCase().includes('-en') || btn.textContent.trim().toLowerCase() === 'en' || btn.textContent.trim().toLowerCase() === 'english';
    if (lang === 'es') {
      btn.classList.toggle('active', isEs);
    } else {
      btn.classList.toggle('active', isEn);
    }
  });

  // Traducir todos los elementos con data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const translated = window.t ? window.t(key, lang) : key;
    if (translated && translated !== key) {
      el.textContent = translated;
    }
  });

  // Traducir placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const translated = window.t ? window.t(key, lang) : key;
    if (translated && translated !== key) {
      el.setAttribute('placeholder', translated);
    }
  });

  // Traducir tooltips/titles
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    const translated = window.t ? window.t(key, lang) : key;
    if (translated && translated !== key) {
      el.setAttribute('title', translated);
    }
  });

  // Actualizar tema para refresh de tooltip bilingüe
  applyTheme(state.theme);

  // Si la vista previa del lector está abierta, refrescarla con el nuevo idioma
  if (state.activeReaderNote && document.getElementById('modal-reader')?.open) {
    openReaderModal(state.activeReaderNote.tipo, state.activeReaderNote.id);
  }

  // Actualizar prompt en Prompt Studio y Modal
  updateStudioPromptText();
  updateHeaderUserProfile();
  updateHomeUserGreeting();
  if (state.onboardingStep) setOnboardingStep(state.onboardingStep);

  // Traducir controles dinámicos de filtros y mapas
  const elMapaAll = document.getElementById('mapa-filter-all-label');
  if (elMapaAll) elMapaAll.textContent = ui('Todos los Mapas', 'All Maps');
  const elMapaCurso = document.getElementById('mapa-filter-curso-label');
  if (elMapaCurso) elMapaCurso.textContent = ui('🎓 Mapa Maestro del Curso', '🎓 Course Master Map');
  const elMapaTematico = document.getElementById('mapa-filter-tematico-label');
  if (elMapaTematico) elMapaTematico.textContent = ui('🗺️ Mapas Temáticos', '🗺️ Topic Maps');
  const btnMapasToggleAll = document.getElementById('btn-mapas-toggle-all');
  if (btnMapasToggleAll) btnMapasToggleAll.textContent = ui('↕ Desplegar / Plegar todos', '↕ Expand / Collapse All');
  const aSearch = document.getElementById('atomica-search-input');
  if (aSearch) aSearch.placeholder = ui('Buscar nota atómica...', 'Search atomic notes...');
  const fSearch = document.getElementById('fuente-search-input');
  if (fSearch) fSearch.placeholder = ui('Buscar fuente...', 'Search sources...');
  const mSearch = document.getElementById('mapa-search-input');
  if (mSearch) mSearch.placeholder = ui('Buscar mapa o concepto...', 'Search map or concept...');
  ['atomica', 'fuente', 'mapa'].forEach(tp => {
    const lbl = document.getElementById(`${tp}-clear-filters-label`);
    if (lbl) lbl.textContent = ui('Limpiar', 'Clear');
  });
  const lblMapaMod = document.getElementById('label-mapa-modulo');
  if (lblMapaMod) lblMapaMod.textContent = ui('Módulo (Opcional)', 'Module (Optional)');
  const lblMapaLec = document.getElementById('label-mapa-leccion-titulo');
  if (lblMapaLec) lblMapaLec.textContent = ui('Tema / Lección (Opcional)', 'Topic / Lesson (Optional)');
  const lblMapaDesc = document.getElementById('label-mapa-descripcion');
  if (lblMapaDesc) lblMapaDesc.textContent = ui('Descripción / Resumen del Mapa (Opcional)', 'Map Description / Summary (Optional)');

  updateStudyCompass();

  if (reloadViews) {
    renderHomeView();
    renderInboxView();
    renderAtomicasView();
    renderFuentesView();
    renderMapasView();
    const selections = [...document.querySelectorAll('select')].map(el => [el, el.value]);
    populateProjectScopeSelects();
    populateSelects();
    populateFolderSelects();
    populateTagFilters();
    selections.forEach(([el, value]) => { el.value = value; });
    if (state.currentView === "repaso") { const revealed = state.isAnswerRevealed; renderFlashcard(); if (revealed) revealAnswer(); }
    if (state.currentView === "analitica") loadAnalyticsView();
    if (state.currentView === "grafo") graphRefreshUI();
  }
}
window.setLanguage = setLanguage;

function updateStudyCompass() {
  const v = state.currentView || 'inicio';
  // Map Bandeja to step 1 (Capture/AI) for compass highlighting
  const activeCompassView = (v === 'bandeja' || v === 'llm') ? 'llm' : v;
  document.querySelectorAll('#study-compass-bar .compass-step').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-compass-view') === activeCompassView);
  });

  const setTxt = (id, es, en) => {
    const el = document.getElementById(id);
    if (el) el.textContent = ui(es, en);
  };
  const setHtml = (id, es, en) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = ui(es, en);
  };

  setTxt('compass-lbl-inicio', 'Inicio y Temario', 'Home & Syllabus');
  setTxt('compass-lbl-capture', 'Capturar / IA', 'Capture / AI');
  setTxt('compass-lbl-fuentes', 'Fuentes', 'Sources');
  setTxt('compass-lbl-atomicas', 'Notas Atómicas', 'Atomic Notes');
  setTxt('compass-lbl-mapas', 'Mapas de Estudio', 'Content Maps');
  setTxt('compass-lbl-repaso', 'Repaso Activo', 'Active Recall');

  // Localize Inbox Strip
  setTxt('inbox-strip-title', 'Cómo usar la Bandeja', 'How to use Inbox');
  setHtml(
    'inbox-strip-desc',
    'Captura ideas rápidas arriba sin interrumpir tu lectura y pulsa <strong>Procesar nota</strong> para convertirlas en Notas Atómicas — o usa el <strong>Asistente IA</strong> para importar temas completos.',
    'Capture spontaneous ideas in the top bar without interrupting your study session, then click <strong>Process note</strong> to turn them into Atomic Notes — or use the <strong>LLM Assistant</strong> to import full lessons.'
  );
  setTxt('inbox-strip-btn', '🤖 Asistente IA →', '🤖 AI Assistant →');

  // Localize LLM 3-Step Strip & Collapsible Summary
  setHtml('llm-step-1-txt', '<strong>Configura el Tema:</strong> Elige Proyecto, Módulo y Lección abajo', '<strong>Configure Topic:</strong> Choose Project, Module &amp; Lesson below');
  setHtml('llm-step-2-txt', '<strong>Copia el Prompt:</strong> Pégalo en tu IA junto con tu PDF o apuntes', '<strong>Copy Master Prompt:</strong> Paste it into your AI with your PDF or notes');
  setHtml('llm-step-3-txt', '<strong>Importa el .JSON:</strong> Pega la respuesta para crear tus Notas y Mapas ↗', '<strong>Import .JSON:</strong> Paste the AI response to generate Notes &amp; Maps ↗');
  setTxt('prompt-raw-summary-title', 'Ver o editar el texto completo del Prompt Maestro', 'Inspect or Edit Generated Master Prompt Text');

  // Localize Spaced Repetition Group Pills
  setTxt('grading-group-repeat-lbl', '🔴 Necesito Repetir (0–2 · Se reprograma a 1 día)', '🔴 Needs Repetition (0–2 · Resets to 1 day)');
  setTxt('grading-group-pass-lbl', '🟢 Recordado con Éxito (3–5 · Amplía el intervalo)', '🟢 Recalled Successfully (3–5 · Expands interval)');

  // Contextual Study Hint on the right of the Compass Bar
  const hintEl = document.getElementById('study-compass-hint');
  if (!hintEl) return;

  const hints = {
    inicio: ui(
      '🧭 <strong>Centro de Estudio:</strong> Elige un tema en tu curso o haz tu repaso diario. <button type="button" class="compass-next-btn" onclick="switchView(\'mapas\')">Ir a Mapas →</button>',
      '🧭 <strong>Study Hub:</strong> Pick a topic in your syllabus or start today\'s review. <button type="button" class="compass-next-btn" onclick="switchView(\'mapas\')">Go to Maps →</button>'
    ),
    bandeja: ui(
      '📥 <strong>Paso 1 (Captura):</strong> Convierte tus apuntes rápidos en conceptos permanentes. <button type="button" class="compass-next-btn" onclick="switchView(\'fuentes\')">Siguiente: Fuentes →</button>',
      '📥 <strong>Step 1 (Capture):</strong> Turn raw thoughts into permanent concepts. <button type="button" class="compass-next-btn" onclick="switchView(\'fuentes\')">Next: Sources →</button>'
    ),
    llm: ui(
      '🤖 <strong>Paso 1 (IA):</strong> Configura tu tema, copia el prompt e importa el .JSON. <button type="button" class="compass-next-btn" onclick="openModal(\'modal-import-json\')">Pegar .JSON →</button>',
      '🤖 <strong>Step 1 (AI):</strong> Configure topic, copy prompt, and import the .JSON. <button type="button" class="compass-next-btn" onclick="openModal(\'modal-import-json\')">Paste .JSON →</button>'
    ),
    fuentes: ui(
      '📄 <strong>Paso 2 (Fuentes):</strong> Haz clic en una fuente para leer sus puntos clave e ideas extraídas. <button type="button" class="compass-next-btn" onclick="switchView(\'atomicas\')">Siguiente: Atómicas →</button>',
      '📄 <strong>Step 2 (Sources):</strong> Click any source to read its key points and extracted ideas. <button type="button" class="compass-next-btn" onclick="switchView(\'atomicas\')">Next: Atomic Notes →</button>'
    ),
    atomicas: ui(
      '⚛️ <strong>Paso 3 (Conceptos):</strong> Haz clic en una nota para estudiar su Idea Central y autoevaluarte. <button type="button" class="compass-next-btn" onclick="switchView(\'mapas\')">Siguiente: Mapas →</button>',
      '⚛️ <strong>Step 3 (Concepts):</strong> Click any note to study its Core Idea and self-test. <button type="button" class="compass-next-btn" onclick="switchView(\'mapas\')">Next: Content Maps →</button>'
    ),
    mapas: ui(
      '🗺️ <strong>Paso 4 (Mapas):</strong> Despliega un mapa para ver cómo encajan todos los conceptos del tema. <button type="button" class="compass-next-btn" onclick="switchView(\'repaso\')">Siguiente: Repaso →</button>',
      '🗺️ <strong>Step 4 (Maps):</strong> Expand a map to see how all concepts of a topic fit together. <button type="button" class="compass-next-btn" onclick="switchView(\'repaso\')">Next: Active Recall →</button>'
    ),
    repaso: ui(
      '🧠 <strong>Paso 5 (Consolidación):</strong> Intenta recordar antes de mostrar la respuesta (Espacio). <button type="button" class="compass-next-btn" onclick="switchView(\'analitica\')">Ver Analítica →</button>',
      '🧠 <strong>Step 5 (Consolidation):</strong> Recall the answer before pressing Show Answer (Space). <button type="button" class="compass-next-btn" onclick="switchView(\'analitica\')">View Analytics →</button>'
    ),
    grafo: ui(
      '🕸️ <strong>Exploración:</strong> Haz clic en un nodo para inspeccionar sus enlaces o abrir la nota. <button type="button" class="compass-next-btn" onclick="switchView(\'mapas\')">Ir a Mapas →</button>',
      '🕸️ <strong>Exploration:</strong> Click any node to inspect its connections or open the note. <button type="button" class="compass-next-btn" onclick="switchView(\'mapas\')">Go to Maps →</button>'
    ),
    analitica: ui(
      '📊 <strong>Progreso:</strong> Revisa tu diagnóstico de retención y carga de estudio. <button type="button" class="compass-next-btn" onclick="switchView(\'repaso\')">Practicar ahora →</button>',
      '📊 <strong>Progress:</strong> Check your retention diagnosis and upcoming review load. <button type="button" class="compass-next-btn" onclick="switchView(\'repaso\')">Practice now →</button>'
    ),
    guia: ui(
      '📖 <strong>Guía Visual:</strong> Explora los 3 pósters y el método científico de estudio. <button type="button" class="compass-next-btn" onclick="switchView(\'inicio\')">Volver al Inicio →</button>',
      '📖 <strong>Visual Guide:</strong> Explore the 3 posters and evidence-based study workflow. <button type="button" class="compass-next-btn" onclick="switchView(\'inicio\')">Back to Home →</button>'
    )
  };

  hintEl.innerHTML = hints[v] || hints.inicio;
}
window.updateStudyCompass = updateStudyCompass;

// -------------------------------------------------------------
// Banners Explicativos de Sección (Cognitive Explainers)
// -------------------------------------------------------------
window.toggleExplainer = function(sectionId) {
  const explainer = document.getElementById(`explainer-${sectionId}`);
  if (!explainer) return;
  const isCollapsed = explainer.classList.toggle('collapsed');
  const btn = explainer.querySelector('.btn-explainer-toggle');
  if (btn) {
    btn.textContent = isCollapsed ? 'ℹ️' : '✕';
    const showText = state.lang === 'en' ? 'Show explanation' : 'Ver explicación';
    const hideText = state.lang === 'en' ? 'Hide explanation' : 'Ocultar explicación';
    btn.title = isCollapsed ? showText : hideText;
  }
};

// -------------------------------------------------------------
// Vista Inicio (Home View) — Dinámica por Proyecto / Área / Guía Inicial
// -------------------------------------------------------------
function renderHomeView() {
  let atomicas = (state.notes.atomica || []).filter(noteMatchesActiveScope);
  let fuentes = (state.notes.fuente || []).filter(noteMatchesActiveScope);
  let mapas = (state.notes.mapa || []).filter(noteMatchesActiveScope);

  const atomicasCount = atomicas.length;
  const fuentesCount = fuentes.length;
  const mapasCount = mapas.length;
  let cardsCount = state.notes.preguntasCount || 0;
  if (state.activeField || state.activeProject) {
    cardsCount = atomicas.filter(a => a.pregunta && (a.pregunta.pregunta || a.pregunta.proxima_revision)).length;
  }

  const elAtomicas = document.getElementById('home-count-atomicas');
  const elFuentes = document.getElementById('home-count-fuentes');
  const elMapas = document.getElementById('home-count-mapas');
  const elCards = document.getElementById('home-count-cards');
  const elDue = document.getElementById('home-count-due');

  if (elAtomicas) elAtomicas.textContent = atomicasCount;
  if (elFuentes) elFuentes.textContent = fuentesCount;
  if (elMapas) elMapas.textContent = mapasCount;
  if (elCards) elCards.textContent = cardsCount;

  if (state.activeField || state.activeProject) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const dueInScope = atomicas.filter(a => a.pregunta && a.pregunta.proxima_revision && a.pregunta.proxima_revision <= todayStr).length;
    if (elDue) elDue.textContent = String(dueInScope);
  } else {
    const headerDueCount = document.getElementById('header-due-count')?.textContent || '0';
    if (elDue) elDue.textContent = headerDueCount;
  }

  updateHomeUserGreeting();
  updateHeaderUserProfile();
  renderHomeDynamicSections(atomicas, fuentes, mapas);
}

function updateHomeUserGreeting() {
  const elGreeting = document.getElementById('home-user-greeting');
  const elTitle = document.getElementById('home-welcome-title');
  const elSubtitle = document.getElementById('home-welcome-subtitle');
  const badgesEl = document.getElementById('home-active-project-badges');
  const actionsEl = document.getElementById('home-active-project-actions');
  const focusEyebrow = document.getElementById('home-focus-eyebrow');
  const focusTitle = document.getElementById('home-focus-title');
  const focusDesc = document.getElementById('home-focus-desc');
  const libTitle = document.getElementById('home-library-title');
  const libHint = document.getElementById('home-library-hint');

  if (state.activeProject) {
    const activePSlug = slugifyClient(state.activeProject);
    const activeCSlug = slugifyClient(state.activeField || '');
    const projObj = (state.projects || []).find(p =>
      (p.proyecto === state.activeProject || slugifyClient(p.proyecto) === activePSlug) &&
      (!state.activeField || p.campo === state.activeField || slugifyClient(p.campo) === activeCSlug)
    );
    const campoName = projObj?.campo || state.activeField || ui('General', 'General');
    const tipo = projObj?.tipo || 'curso';
    const isCompleted = projObj?.estado === 'completado';
    const lessonsCount = (projObj?.lecciones || []).length;
    const desc = (projObj?.descripcion || '').trim();

    if (badgesEl) {
      badgesEl.style.display = 'flex';
      badgesEl.innerHTML = `
        <span class="badge-folder" style="font-size:11.5px;">📂 ${escapeHtml(campoName)}</span>
        ${typeof getProjectTypeBadge === 'function' ? getProjectTypeBadge(tipo) : ''}
        <span class="badge-folder" style="font-size:11px; color:${isCompleted ? 'var(--accent-success)' : 'var(--accent-primary)'};">
          ${isCompleted ? ui('✅ Completado', '✅ Completed') : ui('🟢 En curso', '🟢 Active')}
        </span>
        ${lessonsCount > 0 ? `<span class="badge-folder" style="font-size:11px;">📚 ${lessonsCount} ${ui('temas / lecciones', 'topics / lessons')}</span>` : ''}
      `;
    }

    if (elGreeting) {
      elGreeting.textContent = ui(`PROYECTO ACTIVO · ${campoName.toUpperCase()}`, `ACTIVE PROJECT · ${campoName.toUpperCase()}`);
    }
    if (elTitle) {
      elTitle.textContent = state.activeProject;
    }
    if (elSubtitle) {
      elSubtitle.textContent = desc || ui(
        'Aún no has añadido una descripción para este proyecto. Puedes editarlo para especificar el temario, objetivos o fuentes.',
        'No description added for this project yet. You can edit it to specify syllabus, goals, or references.'
      );
    }

    if (actionsEl) {
      actionsEl.style.display = 'flex';
      const cSlug = projObj?.campoSlug || '';
      const pSlug = projObj?.proySlug || '';
      actionsEl.innerHTML = `
        <button type="button" class="btn-primary" onclick="openPromptStudioForActiveProject()">
          🤖 ${ui('Configurar Prompt (Módulo / Tema)', 'Customize Prompt (Module / Topic)')}
        </button>
        <button type="button" class="btn-accent" onclick="document.getElementById('btn-import-json-trigger')?.click()">
          📥 ${ui('Importar .JSON en este Proyecto', 'Import .JSON into Project')}
        </button>
        <button type="button" class="btn-ghost" onclick="openCreateNoteInActiveProject('atomica')">
          ➕ ${ui('Nueva Nota Atómica', 'New Atomic Note')}
        </button>
        ${(cSlug && pSlug) ? `<button type="button" class="btn-ghost" onclick="openEditProjectModal('${escapeHtml(cSlug)}', '${escapeHtml(pSlug)}')">✏️ ${ui('Editar Proyecto', 'Edit Project')}</button>` : ''}
        <button type="button" class="btn-ghost" onclick="clearProjectScope()">
          🌐 ${ui('Vista Global', 'Global View')}
        </button>
      `;
    }

    if (focusEyebrow) focusEyebrow.textContent = ui('REPASO DEL PROYECTO', 'PROJECT REVIEW');
    if (focusTitle) focusTitle.textContent = ui(`Consolida "${state.activeProject}"`, `Master "${state.activeProject}"`);
    if (focusDesc) focusDesc.textContent = ui('Repasa las preguntas de recuperación activa SM-2 pertenecientes únicamente a este proyecto.', 'Review active-recall SM-2 flashcards belonging specifically to this project.');
    if (libTitle) libTitle.textContent = ui(`Contenido de ${state.activeProject}`, `Contents of ${state.activeProject}`);
    if (libHint) libHint.textContent = ui('Notas y mapas conectados dentro de este proyecto.', 'Connected notes and maps inside this project.');
    return;
  }

  if (state.activeField) {
    if (badgesEl) {
      badgesEl.style.display = 'flex';
      badgesEl.innerHTML = `<span class="badge-folder" style="font-size:11.5px;">📂 ${ui('Campo / Área Activa', 'Active Field / Domain')}</span>`;
    }
    if (elGreeting) elGreeting.textContent = ui('VISTA POR CAMPO DE ESTUDIO', 'FIELD WORKSPACE');
    if (elTitle) elTitle.textContent = state.activeField;
    if (elSubtitle) elSubtitle.textContent = ui(`Explorando todos los proyectos, notas y mapas dentro del campo "${state.activeField}".`, `Exploring all projects, notes, and maps inside the "${state.activeField}" field.`);
    if (actionsEl) {
      actionsEl.style.display = 'flex';
      actionsEl.innerHTML = `
        <button type="button" class="btn-primary" onclick="openProjectManagerModal(true)">➕ ${ui('Nuevo Proyecto en este Campo', 'New Project in this Field')}</button>
        <button type="button" class="btn-ghost" onclick="clearProjectScope()">🌐 ${ui('Ver todos los campos', 'Show all fields')}</button>
      `;
    }
    if (focusEyebrow) focusEyebrow.textContent = ui('REPASO DEL CAMPO', 'FIELD REVIEW');
    if (focusTitle) focusTitle.textContent = ui(`Repaso en ${state.activeField}`, `Review in ${state.activeField}`);
    if (focusDesc) focusDesc.textContent = ui('Tarjetas pendientes de todos los proyectos de este campo.', 'Due flashcards across all projects in this field.');
    if (libTitle) libTitle.textContent = ui(`Biblioteca de ${state.activeField}`, `${state.activeField} Library`);
    if (libHint) libHint.textContent = ui('Resumen agregado del área seleccionada.', 'Aggregated summary of the selected field.');
    return;
  }

  // Vista Global (Sin proyecto ni campo filtrado)
  if (badgesEl) badgesEl.style.display = 'none';
  if (actionsEl) actionsEl.style.display = 'none';
  if (state.userName) {
    if (elGreeting) elGreeting.textContent = ui(`¡HOLA, ${state.userName.toUpperCase()}! 👋`, `HELLO, ${state.userName.toUpperCase()}! 👋`);
    if (elTitle) elTitle.textContent = ui(`Tu biblioteca de conocimiento personal`, `Your personal knowledge library`);
  } else {
    if (elGreeting) elGreeting.textContent = ui(`TU ESPACIO DE TRABAJO`, `YOUR WORKSPACE`);
    if (elTitle) elTitle.textContent = ui(`Un poco de enfoque. Conocimiento duradero.`, `A little focus. Lasting knowledge.`);
  }
  if (elSubtitle) {
    elSubtitle.textContent = ui(`Captura una idea, organiza tus proyectos y cursos, o dedica unos minutos a recordar.`, `Capture a thought, organize your projects and courses, or make time to remember.`);
  }
  if (focusEyebrow) focusEyebrow.textContent = ui('HOY', 'TODAY');
  if (focusTitle) focusTitle.textContent = ui('Conserva lo que aprendes.', 'Keep what you learn.');
  if (focusDesc) focusDesc.textContent = ui('Un repaso breve transforma tus notas en conocimiento duradero.', 'A short review turns your notes into knowledge you can recall.');
  if (libTitle) libTitle.textContent = ui('Tu biblioteca global', 'Your global library');
  if (libHint) libHint.textContent = ui('Ideas atómicas conectadas entre todos tus proyectos.', 'Small ideas, connected across all your projects.');
}

function findActiveProjectObj() {
  if (!state.activeProject) return null;
  const activePSlug = slugifyClient(state.activeProject);
  const activeCSlug = slugifyClient(state.activeField || '');
  return (state.projects || []).find(p =>
    (p.proyecto === state.activeProject || slugifyClient(p.proyecto) === activePSlug) &&
    (!state.activeField || p.campo === state.activeField || slugifyClient(p.campo) === activeCSlug)
  ) || null;
}

function findProjectObjForNote(note, fallbackProjObj = null) {
  if (fallbackProjObj) return fallbackProjObj;
  const activeObj = findActiveProjectObj();
  if (activeObj) return activeObj;
  const nProj = note?.proyecto || (note?.data && note.data.proyecto) || '';
  if (!nProj) return null;
  const nCampo = note?.campo || (note?.data && note.data.campo) || '';
  const pSlug = slugifyClient(nProj);
  const cSlug = slugifyClient(nCampo);
  return (state.projects || []).find(p =>
    (p.proyecto === nProj || slugifyClient(p.proyecto) === pSlug) &&
    (!nCampo || p.campo === nCampo || slugifyClient(p.campo) === cSlug)
  ) || null;
}

function isMasterCourseMap(m) {
  if (!m) return false;
  const tipoMapa = String((m.data && m.data.tipo_mapa) || m.tipo_mapa || '').toLowerCase();
  if (tipoMapa === 'curso' || tipoMapa === 'master') return true;
  if (String(m.id || '').startsWith('mapa-curso-')) return true;
  const t = String((m.data && m.data.titulo) || '').toLowerCase();
  return t.includes('mapa general del curso') || t.includes('course master map');
}

function getNoteCurriculumMeta(note, projObj = null) {
  const data = note?.data || {};
  let modulo = String(data.modulo || note?.modulo || '').trim();
  let leccionNum = (data.leccion !== undefined && data.leccion !== null && data.leccion !== '')
    ? String(data.leccion).trim()
    : '';
  let leccionTitulo = String(data.leccion_titulo || note?.leccion_titulo || '').trim();

  const pObj = findProjectObjForNote(note, projObj);
  const lecciones = Array.isArray(pObj?.lecciones) ? pObj.lecciones : [];
  if (lecciones.length > 0 && note?.id) {
    const matchedLec = lecciones.find(l =>
      (leccionNum !== '' && Number(l.numero) === Number(leccionNum)) ||
      (Array.isArray(l.notas_atomicas) && l.notas_atomicas.includes(note.id)) ||
      (Array.isArray(l.notas_fuente) && l.notas_fuente.includes(note.id)) ||
      (Array.isArray(l.mapas_contenido) && l.mapas_contenido.includes(note.id))
    );
    if (matchedLec) {
      if (!modulo && matchedLec.modulo) modulo = String(matchedLec.modulo).trim();
      if (leccionNum === '' && matchedLec.numero !== undefined && matchedLec.numero !== null) {
        leccionNum = String(matchedLec.numero).trim();
      }
      if (!leccionTitulo && matchedLec.titulo) leccionTitulo = String(matchedLec.titulo).trim();
    }
  }

  // Si es un mapa de contenido sin módulo/lección explícitos, inferirlo de sus subtemas atómicos
  if ((!modulo || (!leccionTitulo && leccionNum === '')) && Array.isArray(data.subtemas) && data.subtemas.length > 0) {
    const allAtomicas = (state.notes && state.notes.atomica) || [];
    for (const sub of data.subtemas) {
      if (!sub || !sub.nota_id) continue;
      const foundA = allAtomicas.find(a => a.id === sub.nota_id);
      if (foundA) {
        const aData = foundA.data || {};
        if (!modulo && aData.modulo) modulo = String(aData.modulo).trim();
        if (leccionNum === '' && aData.leccion !== undefined && aData.leccion !== null && aData.leccion !== '') {
          leccionNum = String(aData.leccion).trim();
        }
        if (!leccionTitulo && aData.leccion_titulo) {
          leccionTitulo = String(aData.leccion_titulo).trim();
        }
        if (modulo && (leccionTitulo || leccionNum !== '')) break;
      }
    }
  }

  const leccion = leccionTitulo || (leccionNum !== '' ? `${ui('Tema', 'Topic')} ${leccionNum}` : '');
  const leccionDisplay = (leccionNum !== '' && leccionTitulo)
    ? `${ui('Tema', 'Topic')} ${leccionNum}: ${leccionTitulo}`
    : leccion;

  return { modulo, leccionNum, leccionTitulo, leccion, leccionDisplay };
}

function isHomeKeyExpanded(key, defaultOpen = false) {
  if (state.homeExpandedKeys && Object.prototype.hasOwnProperty.call(state.homeExpandedKeys, key)) {
    return Boolean(state.homeExpandedKeys[key]);
  }
  return Boolean(defaultOpen);
}

window.handleHomeDetailsToggle = function(detailsEl) {
  if (!detailsEl) return;
  const key = detailsEl.getAttribute('data-collapse-key');
  if (!key) return;
  if (!state.homeExpandedKeys) state.homeExpandedKeys = {};
  state.homeExpandedKeys[key] = Boolean(detailsEl.open);
};

window.toggleAllHomeSections = function() {
  const container = document.getElementById('home-project-filtered-body');
  if (!container) return;
  const allDetails = Array.from(container.querySelectorAll('details[data-collapse-key]'));
  if (allDetails.length === 0) return;
  const anyClosed = allDetails.some(d => !d.open);
  if (!state.homeExpandedKeys) state.homeExpandedKeys = {};
  allDetails.forEach(d => {
    d.open = anyClosed;
    const k = d.getAttribute('data-collapse-key');
    if (k) state.homeExpandedKeys[k] = anyClosed;
  });
};

window.setHomeCurriculumFilter = function(filterType, value) {
  if (filterType === 'modulo') {
    state.homeModuleFilter = value || '';
    state.homeLessonFilter = '';
    renderHomeView();
  } else if (filterType === 'leccion') {
    state.homeLessonFilter = value || '';
    renderHomeView();
  } else if (filterType === 'search') {
    state.homeSearchQuery = value || '';
    const bodyEl = document.getElementById('home-project-filtered-body');
    const clearBtn = document.getElementById('btn-home-clear-filters');
    if (clearBtn) {
      clearBtn.style.display = (state.homeModuleFilter || state.homeLessonFilter || state.homeSearchQuery.trim()) ? 'inline-flex' : 'none';
    }
    if (bodyEl) {
      const atomicas = (state.notes.atomica || []).filter(noteMatchesActiveScope);
      const fuentes = (state.notes.fuente || []).filter(noteMatchesActiveScope);
      const mapas = (state.notes.mapa || []).filter(noteMatchesActiveScope);
      const projObj = findActiveProjectObj();
      bodyEl.innerHTML = buildHomeProjectFilteredBodyHtml(atomicas, fuentes, mapas, projObj);
    } else {
      renderHomeView();
    }
  }
};

window.clearHomeCurriculumFilters = function() {
  state.homeModuleFilter = '';
  state.homeLessonFilter = '';
  state.homeSearchQuery = '';
  renderHomeView();
};

function buildUnifiedProjectCurriculum(atomicas, fuentes, projObj, mapas = []) {
  const rawLecciones = Array.isArray(projObj?.lecciones) ? projObj.lecciones : [];
  const lessonMap = new Map();

  rawLecciones.forEach(lec => {
    const numKey = String(lec.numero);
    lessonMap.set(numKey, {
      numero: lec.numero,
      numKey,
      titulo: lec.titulo || `${ui('Tema / Lección', 'Topic / Lesson')} ${lec.numero}`,
      modulo: (lec.modulo || '').trim(),
      fecha: lec.fecha || '',
      total_atomicas: lec.total_atomicas || 0,
      atomicas: [],
      fuentes: [],
      mapas: []
    });
  });

  atomicas.forEach(a => {
    const meta = getNoteCurriculumMeta(a, projObj);
    if (meta.leccionNum !== '') {
      if (!lessonMap.has(meta.leccionNum)) {
        lessonMap.set(meta.leccionNum, {
          numero: Number(meta.leccionNum) || meta.leccionNum,
          numKey: meta.leccionNum,
          titulo: meta.leccionTitulo || `${ui('Tema / Lección', 'Topic / Lesson')} ${meta.leccionNum}`,
          modulo: meta.modulo || '',
          fecha: a.data?.creado || '',
          total_atomicas: 0,
          atomicas: [],
          fuentes: [],
          mapas: []
        });
      }
      const entry = lessonMap.get(meta.leccionNum);
      if (!entry.modulo && meta.modulo) entry.modulo = meta.modulo;
      if (!entry.atomicas.some(x => x.id === a.id)) entry.atomicas.push(a);
    }
  });

  fuentes.forEach(f => {
    const meta = getNoteCurriculumMeta(f, projObj);
    if (meta.leccionNum !== '' && lessonMap.has(meta.leccionNum)) {
      const entry = lessonMap.get(meta.leccionNum);
      if (!entry.modulo && meta.modulo) entry.modulo = meta.modulo;
      if (!entry.fuentes.some(x => x.id === f.id)) entry.fuentes.push(f);
    }
  });

  const scopedMapas = Array.isArray(mapas) && mapas.length > 0
    ? mapas
    : ((state.notes && state.notes.mapa) || []).filter(noteMatchesActiveScope);
  scopedMapas.forEach(m => {
    if (isMasterCourseMap(m)) return;
    const meta = getNoteCurriculumMeta(m, projObj);
    if (meta.leccionNum !== '' && lessonMap.has(meta.leccionNum)) {
      const entry = lessonMap.get(meta.leccionNum);
      if (!entry.modulo && meta.modulo) entry.modulo = meta.modulo;
      if (!entry.mapas.some(x => x.id === m.id)) entry.mapas.push(m);
    }
  });

  const unifiedLessons = Array.from(lessonMap.values()).sort((a, b) => (Number(a.numero) || 0) - (Number(b.numero) || 0));

  const moduleSet = new Set();
  unifiedLessons.forEach(l => { if (l.modulo) moduleSet.add(l.modulo); });
  atomicas.forEach(a => {
    const m = getNoteCurriculumMeta(a, projObj).modulo;
    if (m) moduleSet.add(m);
  });
  fuentes.forEach(f => {
    const m = getNoteCurriculumMeta(f, projObj).modulo;
    if (m) moduleSet.add(m);
  });
  scopedMapas.forEach(m => {
    const mod = getNoteCurriculumMeta(m, projObj).modulo;
    if (mod) moduleSet.add(mod);
  });

  const allModules = Array.from(moduleSet);
  return { unifiedLessons, allModules };
}

function buildHomeProjectFilteredBodyHtml(atomicas, fuentes, mapas, projObj) {
  const { unifiedLessons, allModules } = buildUnifiedProjectCurriculum(atomicas, fuentes, projObj, mapas);
  const modFilter = state.homeModuleFilter || '';
  const lecFilter = state.homeLessonFilter || '';
  const q = (state.homeSearchQuery || '').trim().toLowerCase();
  const hasActiveFilter = Boolean(modFilter || lecFilter || q);

  const noteMatchesCurrFilter = (note) => {
    const meta = getNoteCurriculumMeta(note, projObj);
    if (modFilter === '__unassigned__') {
      if (meta.modulo) return false;
    } else if (modFilter) {
      if (meta.modulo !== modFilter && slugifyClient(meta.modulo) !== slugifyClient(modFilter)) return false;
    }
    if (lecFilter) {
      if (String(meta.leccionNum) !== String(lecFilter)) return false;
    }
    if (q) {
      const title = (note.data?.titulo || note.id || '').toLowerCase();
      const mod = (meta.modulo || '').toLowerCase();
      const lecT = (meta.leccionTitulo || '').toLowerCase();
      const tags = Array.isArray(note.data?.tags) ? note.data.tags.join(' ').toLowerCase() : '';
      if (!title.includes(q) && !mod.includes(q) && !lecT.includes(q) && !tags.includes(q)) return false;
    }
    return true;
  };

  const filteredAtomicas = atomicas.filter(noteMatchesCurrFilter);
  const filteredFuentes = fuentes.filter(noteMatchesCurrFilter);
  const filteredAtomicIdSet = new Set(filteredAtomicas.map(a => a.id));

  const filteredMapas = hasActiveFilter
    ? mapas.filter(m => {
        if (noteMatchesCurrFilter(m)) return true;
        const mTitle = (m.data?.titulo || m.id || '').toLowerCase();
        if (q && mTitle.includes(q)) return true;
        const subtemas = Array.isArray(m.data?.subtemas) ? m.data.subtemas : [];
        return subtemas.some(s => s && filteredAtomicIdSet.has(s.nota_id));
      })
    : mapas;

  // Filtrar lecciones según módulo, tema y búsqueda
  const filteredLessons = unifiedLessons.filter(lec => {
    if (modFilter === '__unassigned__') {
      if (lec.modulo) return false;
    } else if (modFilter) {
      if (lec.modulo !== modFilter && slugifyClient(lec.modulo) !== slugifyClient(modFilter)) return false;
    }
    if (lecFilter && String(lec.numKey) !== String(lecFilter)) return false;
    if (q) {
      const headerMatches = (lec.titulo || '').toLowerCase().includes(q) ||
        (lec.modulo || '').toLowerCase().includes(q) ||
        `${lec.numero}`.includes(q);
      const anyNoteMatches = lec.atomicas.some(noteMatchesCurrFilter) ||
        lec.fuentes.some(noteMatchesCurrFilter) ||
        (lec.mapas || []).some(noteMatchesCurrFilter);
      return headerMatches || anyNoteMatches;
    }
    return true;
  });

  const renderLessonCardHtml = (lec, showModuleBadgeInside = true) => {
    const notesInLec = q ? lec.atomicas.filter(noteMatchesCurrFilter) : lec.atomicas;
    const sourcesInLec = q ? lec.fuentes.filter(noteMatchesCurrFilter) : lec.fuentes;
    const mapsInLec = q ? (lec.mapas || []).filter(noteMatchesCurrFilter) : (lec.mapas || []);
    const noteCount = notesInLec.length || (!q ? (lec.total_atomicas || 0) : 0);
    const collapseKey = `lec:${lec.numKey}`;
    // Plegado por defecto para no saturar la vista, pero se abre automáticamente si el usuario filtra por esta lección o busca texto
    const autoOpenByFilter = Boolean(lecFilter && String(lec.numKey) === String(lecFilter)) || Boolean(q);
    const isOpen = autoOpenByFilter ? true : isHomeKeyExpanded(collapseKey, false);

    const modBadge = (showModuleBadgeInside && lec.modulo)
      ? `<span class="badge-folder" style="font-size:11px; color:var(--accent-primary);">📦 ${escapeHtml(lec.modulo)}</span>`
      : '';

    const firstMapId = mapsInLec.length > 0 ? mapsInLec[0].id : '';
    const firstAtomicaId = notesInLec.length > 0 ? notesInLec[0].id : '';
    const firstFuenteId = sourcesInLec.length > 0 ? sourcesInLec[0].id : '';

    return `
      <details class="home-lesson-card" data-collapse-key="${escapeHtml(collapseKey)}" ${isOpen ? 'open' : ''} ontoggle="handleHomeDetailsToggle(this)">
        <summary class="home-lesson-card-header">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; min-width:0;">
            <span class="home-chevron">▸</span>
            ${modBadge}
            <span class="home-lesson-num">${ui('Tema / Lección', 'Topic / Lesson')} ${escapeHtml(String(lec.numero))}</span>
            <strong style="font-size:14px; color:var(--text-main);">${escapeHtml(lec.titulo || '')}</strong>
          </div>
          <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
            <span style="font-size:11.5px; color:var(--text-muted);">${lec.fecha ? `${escapeHtml(lec.fecha)} · ` : ''}${noteCount} ${ui('notas', 'notes')}${mapsInLec.length > 0 ? ` · ${mapsInLec.length} ${ui('mapas', 'maps')}` : ''}</span>
            <span class="home-collapse-pill">${ui('Estudiar tema ▾', 'Study topic ▾')}</span>
          </div>
        </summary>
        <div class="home-lesson-card-body">
          ${(firstMapId || firstAtomicaId || firstFuenteId) ? `
            <div class="home-lesson-study-actions">
              <span class="hlsa-label">🎓 ${ui('Ruta de estudio de este tema:', 'Study path for this topic:')}</span>
              <div class="hlsa-buttons">
                ${firstFuenteId ? `
                  <button type="button" class="btn-lesson-study-action action-source" onclick="openNoteInStudyStage('fuente', '${escapeHtml(firstFuenteId)}')">
                    1. 📄 ${ui('Leer Resumen Fuente', 'Read Source Summary')}
                  </button>
                ` : ''}
                ${firstAtomicaId ? `
                  <button type="button" class="btn-lesson-study-action action-atomic" onclick="studyLessonNotesFromHome(${inlineArgument(lec.modulo || '')}, ${inlineArgument(lec.titulo || '')}, '${escapeHtml(firstAtomicaId)}')">
                    2. ⚛️ ${ui('Estudiar Conceptos Paso a Paso', 'Study Concepts Step-by-Step')} (${notesInLec.length})
                  </button>
                ` : ''}
                ${firstMapId ? `
                  <button type="button" class="btn-lesson-study-action action-map" onclick="studyLessonMapFromHome('${escapeHtml(firstMapId)}')">
                    3. 🗺️ ${ui('Abrir Mapa del Tema', 'Open Topic Map')}
                  </button>
                ` : ''}
              </div>
            </div>
          ` : ''}

          ${notesInLec.length > 0 ? `
            <div class="home-lesson-notes-chips">
              ${notesInLec.map((a, idx) => `
                <button type="button" class="home-note-chip" onclick="openNoteInStudyStage('atomica', '${escapeHtml(a.id)}')" title="${ui('Abrir concepto en vista de estudio', 'Open concept in study view')}">
                  <span style="opacity:0.65; font-size:11px; font-weight:700;">${String(idx + 1).padStart(2, '0')}.</span> ⚛️ ${escapeHtml(a.data?.titulo || a.id)}
                </button>
              `).join('')}
            </div>
          ` : `
            <div style="font-size:12px; color:var(--text-muted); font-style:italic;">
              ${ui('No hay notas atómicas en este tema que coincidan con el filtro.', 'No atomic notes in this topic match the current filter.')}
            </div>
          `}
          ${mapsInLec.length > 0 ? `
            <div style="margin-top:8px; padding-top:8px; border-top:1px dashed var(--border-subtle); display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              <span style="font-size:11px; color:var(--text-muted); font-weight:600;">${ui('Mapas del tema:', 'Topic maps:')}</span>
              ${mapsInLec.map(m => `
                <button type="button" class="home-note-chip" style="font-size:11.5px; padding:4px 9px;" onclick="studyLessonMapFromHome('${escapeHtml(m.id)}')">
                  🗺️ ${escapeHtml(m.data?.titulo || m.id)} (${(m.data?.subtemas || []).length})
                </button>
              `).join('')}
            </div>
          ` : ''}
          ${sourcesInLec.length > 0 ? `
            <div style="margin-top:8px; padding-top:8px; border-top:1px dashed var(--border-subtle); display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              <span style="font-size:11px; color:var(--text-muted); font-weight:600;">${ui('Fuentes del tema:', 'Topic sources:')}</span>
              ${sourcesInLec.map(f => `
                <button type="button" class="home-note-chip" style="font-size:11.5px; padding:4px 9px;" onclick="openNoteInStudyStage('fuente', '${escapeHtml(f.id)}')">
                  📄 ${escapeHtml(f.data?.titulo || f.id)}
                </button>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </details>
    `;
  };

  let lessonsSectionHtml = '';
  if (filteredLessons.length > 0) {
    const hasNamedModules = allModules.length > 0;
    if (hasNamedModules) {
      // Agrupar lecciones por Módulo para que cada Módulo también se pueda plegar y desplegar
      const groupsMap = new Map();
      filteredLessons.forEach(lec => {
        const mKey = lec.modulo || '__unassigned__';
        if (!groupsMap.has(mKey)) groupsMap.set(mKey, []);
        groupsMap.get(mKey).push(lec);
      });

      lessonsSectionHtml = Array.from(groupsMap.entries()).map(([mKey, modLessons]) => {
        if (mKey === '__unassigned__' && groupsMap.size === 1) {
          return modLessons.map(l => renderLessonCardHtml(l, false)).join('');
        }
        const modTitle = mKey === '__unassigned__'
          ? ui('Temas generales (sin módulo asignado)', 'General Topics (no module assigned)')
          : mKey;
        const modCollapseKey = `mod:${slugifyClient(mKey) || 'unassigned'}`;
        const modOpen = isHomeKeyExpanded(modCollapseKey, true);
        const totalModNotes = modLessons.reduce((acc, l) => acc + (l.atomicas.length || l.total_atomicas || 0), 0);

        return `
          <details class="home-module-group" data-collapse-key="${escapeHtml(modCollapseKey)}" ${modOpen ? 'open' : ''} ontoggle="handleHomeDetailsToggle(this)">
            <summary class="home-module-header">
              <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <span class="home-chevron">▸</span>
                <span style="font-size:13.5px; font-weight:700; color:var(--text-main);">📦 ${escapeHtml(modTitle)}</span>
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:11.5px; color:var(--text-muted); font-weight:600;">
                  ${modLessons.length} ${modLessons.length === 1 ? ui('tema', 'topic') : ui('temas', 'topics')} · ${totalModNotes} ${ui('notas', 'notes')}
                </span>
                <span class="home-collapse-pill">${ui('Módulo desplegable', 'Collapsible module')}</span>
              </div>
            </summary>
            <div class="home-module-body">
              ${modLessons.map(l => renderLessonCardHtml(l, false)).join('')}
            </div>
          </details>
        `;
      }).join('');
    } else {
      lessonsSectionHtml = filteredLessons.map(l => renderLessonCardHtml(l, true)).join('');
    }
  } else if (unifiedLessons.length > 0 && hasActiveFilter) {
    lessonsSectionHtml = `
      <div class="home-empty-project-box" style="padding:14px;">
        <p style="margin:0; font-size:13px; color:var(--text-secondary);">
          ${ui('Ningún módulo o tema coincide con el filtro actual.', 'No module or topic matches the current filter.')}
        </p>
      </div>
    `;
  }

  // Secciones desplegables para Notas Atómicas, Notas Fuente y Mapas de Contenido
  const defaultOpenAtomicas = unifiedLessons.length === 0 || Boolean(q);
  const openAtomicasSec = isHomeKeyExpanded('sec:atomicas', defaultOpenAtomicas);
  const recentNotesHtml = atomicas.length > 0
    ? `
      <details class="home-collapsible-section" data-collapse-key="sec:atomicas" ${openAtomicasSec ? 'open' : ''} ontoggle="handleHomeDetailsToggle(this)">
        <summary class="home-collapsible-section-header">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span class="home-chevron">▸</span>
            <h3 style="margin:0; font-size:15px; font-weight:700; color:var(--text-main);">
              ⚛️ ${ui('Notas Atómicas en este proyecto', 'Atomic Notes in this project')} (${hasActiveFilter ? `${filteredAtomicas.length} / ${atomicas.length}` : atomicas.length})
            </h3>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="home-collapse-pill">${ui('Desplegar / Plegar', 'Expand / Collapse')}</span>
            <button type="button" class="btn-ghost-sm" onclick="event.stopPropagation(); switchView('atomicas')">${ui('Ver todas →', 'View all →')}</button>
          </div>
        </summary>
        <div class="home-collapsible-section-body">
          ${filteredAtomicas.length > 0 ? `
            <div class="home-lesson-notes-chips">
              ${filteredAtomicas.map(a => {
                const meta = getNoteCurriculumMeta(a, projObj);
                const prefixParts = [];
                if (meta.modulo) prefixParts.push(meta.modulo);
                if (meta.leccionNum) prefixParts.push(`L${meta.leccionNum}`);
                const prefixLabel = prefixParts.length > 0 ? `[${escapeHtml(prefixParts.join(' · '))}] ` : '';
                return `
                  <button type="button" class="home-note-chip" onclick="openNoteInStudyStage('atomica', '${escapeHtml(a.id)}')">
                    ⚛️ <span style="opacity:0.72; font-size:11.5px;">${prefixLabel}</span>${escapeHtml(a.data?.titulo || a.id)}
                  </button>
                `;
              }).join('')}
            </div>
          ` : `
            <div style="font-size:12.5px; color:var(--text-muted); font-style:italic;">
              ${ui('No hay notas atómicas que coincidan con el filtro seleccionado.', 'No atomic notes match the selected filter.')}
            </div>
          `}
        </div>
      </details>
    `
    : `
      <div class="home-empty-project-box">
        <p style="margin:0 0 10px 0; color:var(--text-secondary);">
          ${ui('Este proyecto aún no tiene notas importadas. Configura el primer módulo o tema en el Prompt Maestro o importa un archivo .JSON.', 'This project has no notes yet. Configure the first module or topic in the Master Prompt or import a .JSON file.')}
        </p>
        <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
          <button type="button" class="btn-primary" onclick="openPromptStudioForActiveProject()">🤖 ${ui('Configurar Prompt del Tema 1', 'Configure Topic 1 Prompt')}</button>
          <button type="button" class="btn-ghost" onclick="document.getElementById('btn-import-json-trigger')?.click()">📥 ${ui('Importar .JSON', 'Import .JSON')}</button>
        </div>
      </div>
    `;

  const openFuentesSec = isHomeKeyExpanded('sec:fuentes', false);
  const sourcesHtml = fuentes.length > 0
    ? `
      <details class="home-collapsible-section" data-collapse-key="sec:fuentes" ${openFuentesSec ? 'open' : ''} ontoggle="handleHomeDetailsToggle(this)">
        <summary class="home-collapsible-section-header">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span class="home-chevron">▸</span>
            <h3 style="margin:0; font-size:15px; font-weight:700; color:var(--text-main);">
              📄 ${ui('Notas Fuente en este proyecto', 'Source Notes in this project')} (${hasActiveFilter ? `${filteredFuentes.length} / ${fuentes.length}` : fuentes.length})
            </h3>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="home-collapse-pill">${ui('Desplegar / Plegar', 'Expand / Collapse')}</span>
            <button type="button" class="btn-ghost-sm" onclick="event.stopPropagation(); switchView('fuentes')">${ui('Ir a Fuentes →', 'Go to Sources →')}</button>
          </div>
        </summary>
        <div class="home-collapsible-section-body">
          ${filteredFuentes.length > 0 ? `
            <div class="home-lesson-notes-chips">
              ${filteredFuentes.map(f => `
                <button type="button" class="home-note-chip" onclick="openNoteInStudyStage('fuente', '${escapeHtml(f.id)}')">
                  📄 ${escapeHtml(f.data?.titulo || f.id)}
                </button>
              `).join('')}
            </div>
          ` : `
            <div style="font-size:12.5px; color:var(--text-muted); font-style:italic;">
              ${ui('No hay notas fuente para este filtro.', 'No source notes match this filter.')}
            </div>
          `}
        </div>
      </details>
    `
    : '';

  const openMapasSec = isHomeKeyExpanded('sec:mapas', false);
  const mapsHtml = mapas.length > 0
    ? `
      <details class="home-collapsible-section" data-collapse-key="sec:mapas" ${openMapasSec ? 'open' : ''} ontoggle="handleHomeDetailsToggle(this)">
        <summary class="home-collapsible-section-header">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span class="home-chevron">▸</span>
            <h3 style="margin:0; font-size:15px; font-weight:700; color:var(--text-main);">
              🗺️ ${ui('Mapas de Contenido del Proyecto', 'Project Content Maps')} (${hasActiveFilter ? `${filteredMapas.length} / ${mapas.length}` : mapas.length})
            </h3>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="home-collapse-pill">${ui('Desplegar / Plegar', 'Expand / Collapse')}</span>
            <button type="button" class="btn-ghost-sm" onclick="event.stopPropagation(); switchView('mapas')">${ui('Ir a Mapas →', 'Go to Maps →')}</button>
          </div>
        </summary>
        <div class="home-collapsible-section-body">
          ${filteredMapas.length > 0 ? `
            <div class="home-lesson-notes-chips">
              ${filteredMapas.map(m => `
                <button type="button" class="home-note-chip" onclick="studyLessonMapFromHome('${escapeHtml(m.id)}')">
                  🗺️ ${escapeHtml(m.data?.titulo || m.id)} (${(m.data?.subtemas || []).length})
                </button>
              `).join('')}
            </div>
          ` : `
            <div style="font-size:12.5px; color:var(--text-muted); font-style:italic;">
              ${ui('No hay mapas de contenido que coincidan con el filtro.', 'No content maps match the current filter.')}
            </div>
          `}
        </div>
      </details>
    `
    : '';

  // Si el proyecto ya tiene Módulos/Lecciones estructurados, agrupamos los listados globales en un único cajón secundario plegado para evitar duplicar visualmente todo el temario
  if (unifiedLessons.length > 0 && atomicas.length > 0) {
    const openFullIdx = isHomeKeyExpanded('sec:full-index', Boolean(q));
    return `
      ${lessonsSectionHtml}
      <details class="home-collapsible-section home-secondary-index-drawer" data-collapse-key="sec:full-index" ${openFullIdx ? 'open' : ''} ontoggle="handleHomeDetailsToggle(this)" style="margin-top: 18px;">
        <summary class="home-collapsible-section-header">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span class="home-chevron">▸</span>
            <h3 style="margin:0; font-size:14px; font-weight:600; color:var(--text-secondary);">
              🗂️ ${ui('Índice global de elementos del proyecto', 'Complete Project Item Index')} (⚛️ ${atomicas.length} · 📄 ${fuentes.length} · 🗺️ ${mapas.length})
            </h3>
          </div>
          <span class="home-collapse-pill">${ui('Ver listado completo', 'Show full list')}</span>
        </summary>
        <div class="home-collapsible-section-body" style="display:flex; flex-direction:column; gap:10px;">
          ${recentNotesHtml}
          ${sourcesHtml}
          ${mapsHtml}
        </div>
      </details>
    `;
  }

  return `
    ${lessonsSectionHtml}
    ${recentNotesHtml}
    ${sourcesHtml}
    ${mapsHtml}
  `;
}

function renderHomeDynamicSections(atomicas, fuentes, mapas) {
  const guideEl = document.getElementById('home-no-projects-guide');
  const dashboardEl = document.getElementById('home-project-dashboard');
  const allProjects = state.projects || [];

  // 1. Si NO existe ningún proyecto todavía, mostrar la Guía de Proyectos con botón de creación
  if (guideEl) {
    if (allProjects.length === 0) {
      guideEl.style.display = 'block';
      guideEl.innerHTML = `
        <div class="home-guide-header">
          <div>
            <span class="home-guide-badge">🧭 ${ui('GUÍA RÁPIDA DE PROYECTOS', 'QUICK PROJECT GUIDE')}</span>
            <h3>${ui('¿Qué es un Proyecto en NotesApp y cómo empezar?', 'What is a Project in NotesApp & How to Get Started?')}</h3>
            <p>
              ${ui(
                'Un <strong>Proyecto</strong> es un espacio organizado dentro de un <strong>Campo / Área</strong> (por ejemplo: <em>Inteligencia Artificial</em>, <em>Medicina</em> o <em>Economía</em>) diseñado para estructurar un <strong>🎓 Curso</strong>, una <strong>🔬 Investigación</strong>, un <strong>📖 Libro</strong>, seguimiento de <strong>📰 Noticias</strong> o <strong>💼 Trabajo</strong>. A medida que importas módulos o lecciones en formato <code>.json</code>, NotesApp enlaza automáticamente los nuevos conceptos con todo lo aprendido en temas previos.',
                'A <strong>Project</strong> is a dedicated workspace inside a <strong>Field / Domain</strong> (e.g. <em>Artificial Intelligence</em>, <em>Medicine</em>, or <em>Economics</em>) designed to structure a <strong>🎓 Course</strong>, <strong>🔬 Research</strong>, <strong>📖 Book</strong>, <strong>📰 News</strong> tracking, or <strong>💼 Work</strong>. As you import modules or lessons via <code>.json</code>, NotesApp automatically links new concepts with prior topics.'
              )}
            </p>
          </div>
        </div>
        <div class="home-guide-steps">
          <div class="home-guide-step">
            <div class="home-guide-step-num">1</div>
            <strong>${ui('Crea tu primer Proyecto', 'Create your first Project')}</strong>
            <p>${ui('Define el Campo (ej. "Programación"), el nombre del Proyecto (ej. "Curso Python"), su tipo y su descripción. También se puede crear solo al importar un .JSON.', 'Define the Field (e.g. "Programming"), Project name (e.g. "Python Course"), type, and description — or let it auto-create when importing a .JSON.')}</p>
          </div>
          <div class="home-guide-step">
            <div class="home-guide-step-num">2</div>
            <strong>${ui('Categoriza por Módulo o Tema en el Prompt', 'Categorize by Module or Topic in the Prompt')}</strong>
            <p>${ui('En el Asistente LLM puedes indicar el Módulo, Nº de Tema/Lección y Título antes de copiar el Prompt Maestro para tu chatbot IA.', 'In the LLM Assistant, specify the Module, Topic/Lesson #, and Title before copying the Master Prompt for your AI chatbot.')}</p>
          </div>
          <div class="home-guide-step">
            <div class="home-guide-step-num">3</div>
            <strong>${ui('Importa el .JSON y conecta tus ideas', 'Import .JSON & connect your ideas')}</strong>
            <p>${ui('Pega el .JSON generado por la IA. Tus notas fuente, notas atómicas, mapas de contenido y tarjetas SM-2 se crearán y enlazarán solas.', 'Paste the AI-generated .JSON. Your source notes, atomic notes, content maps, and SM-2 flashcards will be created and linked automatically.')}</p>
          </div>
        </div>
        <div class="home-guide-actions">
          <button type="button" class="btn-primary" onclick="openProjectManagerModal(true)">
            ➕ ${ui('Crear mi primer Proyecto', 'Create My First Project')}
          </button>
          <button type="button" class="btn-ghost" onclick="switchView('llm')">
            🤖 ${ui('Configurar Prompt Maestro LLM', 'Configure Master LLM Prompt')}
          </button>
          <button type="button" class="btn-ghost" onclick="openModal('modal-import-json')">
            📥 ${ui('Importar archivo .JSON directo', 'Import .JSON File Directly')}
          </button>
        </div>
      `;
    } else {
      guideEl.style.display = 'none';
      guideEl.innerHTML = '';
    }
  }

  if (!dashboardEl) return;

  // 2. Si hay un PROYECTO ACTIVO seleccionado, mostrar su Temario / Módulos / Lecciones (plegable y filtrable) en Home
  if (state.activeProject) {
    const projObj = findActiveProjectObj();
    const { unifiedLessons, allModules } = buildUnifiedProjectCurriculum(atomicas, fuentes, projObj);

    // Validar que los filtros activos sigan siendo válidos en este proyecto
    if (state.homeModuleFilter && state.homeModuleFilter !== '__unassigned__' && !allModules.includes(state.homeModuleFilter)) {
      state.homeModuleFilter = '';
    }
    const lessonsForSelect = state.homeModuleFilter
      ? unifiedLessons.filter(l => state.homeModuleFilter === '__unassigned__' ? !l.modulo : l.modulo === state.homeModuleFilter)
      : unifiedLessons;
    if (state.homeLessonFilter && !lessonsForSelect.some(l => String(l.numKey) === String(state.homeLessonFilter))) {
      state.homeLessonFilter = '';
    }

    const hasUnassignedWhenModulesExist = allModules.length > 0 && (
      unifiedLessons.some(l => !l.modulo) ||
      atomicas.some(a => !getNoteCurriculumMeta(a, projObj).modulo)
    );
    const anyFilterActive = Boolean(state.homeModuleFilter || state.homeLessonFilter || (state.homeSearchQuery || '').trim());

    const filterBarHtml = (allModules.length > 0 || unifiedLessons.length > 0 || atomicas.length > 0)
      ? `
        <div class="home-curriculum-filter-bar">
          <div class="home-filter-group">
            <select id="home-filter-modulo" class="home-filter-select" onchange="setHomeCurriculumFilter('modulo', this.value)" title="${ui('Filtrar por Módulo o Unidad', 'Filter by Module or Unit')}">
              <option value="">📦 ${ui('Todos los Módulos', 'All Modules')} (${allModules.length})</option>
              ${allModules.map(m => {
                const count = atomicas.filter(a => getNoteCurriculumMeta(a, projObj).modulo === m).length;
                return `<option value="${escapeHtml(m)}" ${state.homeModuleFilter === m ? 'selected' : ''}>📦 ${escapeHtml(m)} (${count})</option>`;
              }).join('')}
              ${hasUnassignedWhenModulesExist ? `<option value="__unassigned__" ${state.homeModuleFilter === '__unassigned__' ? 'selected' : ''}>📂 ${ui('Sin módulo asignado', 'No module assigned')}</option>` : ''}
            </select>
          </div>
          <div class="home-filter-group">
            <select id="home-filter-leccion" class="home-filter-select" onchange="setHomeCurriculumFilter('leccion', this.value)" title="${ui('Filtrar por Tema o Lección', 'Filter by Topic or Lesson')}">
              <option value="">📖 ${ui('Todos los Temas / Lecciones', 'All Topics / Lessons')} (${lessonsForSelect.length})</option>
              ${lessonsForSelect.map(l => {
                const count = l.atomicas.length || l.total_atomicas || 0;
                return `<option value="${escapeHtml(String(l.numKey))}" ${String(state.homeLessonFilter) === String(l.numKey) ? 'selected' : ''}>${ui('Tema / Lección', 'Topic / Lesson')} ${escapeHtml(String(l.numero))}: ${escapeHtml(l.titulo)} (${count})</option>`;
              }).join('')}
            </select>
          </div>
          <div class="home-filter-search-wrap">
            <span class="home-filter-search-icon">🔍</span>
            <input type="text" id="home-filter-search" class="home-filter-search-input" placeholder="${ui('Filtrar notas, módulos o temas...', 'Filter notes, modules or topics...')}" value="${escapeHtml(state.homeSearchQuery || '')}" oninput="setHomeCurriculumFilter('search', this.value)" />
          </div>
          <button type="button" id="btn-home-clear-filters" class="home-filter-clear-btn" style="display:${anyFilterActive ? 'inline-flex' : 'none'}; align-items:center; gap:4px;" onclick="clearHomeCurriculumFilters()">
            ✕ ${ui('Limpiar filtros', 'Clear filters')}
          </button>
        </div>
      `
      : '';

    const filteredBodyHtml = buildHomeProjectFilteredBodyHtml(atomicas, fuentes, mapas, projObj);

    dashboardEl.innerHTML = `
      <div class="home-project-panel">
        <div class="home-section-heading" style="flex-wrap:wrap; gap:10px;">
          <h3>📚 ${ui('Estructura de Módulos, Temas y Progreso', 'Modules, Topics & Progress Structure')}</h3>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <button type="button" class="btn-ghost-sm" onclick="toggleAllHomeSections()" title="${ui('Desplegar o plegar todas las secciones y temas', 'Expand or collapse all sections and topics')}">
              ↕ ${ui('Desplegar / Plegar todo', 'Expand / Collapse all')}
            </button>
            <button type="button" class="btn-ghost-sm" onclick="openPromptStudioForActiveProject()">
              ➕ ${ui('Añadir siguiente Módulo / Tema con IA', 'Add next Module / Topic with AI')}
            </button>
          </div>
        </div>
        ${filterBarHtml}
        <div id="home-project-filtered-body">
          ${filteredBodyHtml}
        </div>
      </div>
    `;
    return;
  }

  // 3. Si NO hay proyecto seleccionado pero SÍ existen proyectos, mostrar las tarjetas de proyectos en Home
  const filteredProjects = state.activeField
    ? allProjects.filter(p => p.campo === state.activeField || slugifyClient(p.campo) === slugifyClient(state.activeField))
    : allProjects;

  if (filteredProjects.length > 0) {
    dashboardEl.innerHTML = `
      <div class="home-project-panel">
        <div class="home-section-heading">
          <h3>🎯 ${state.activeField ? ui(`Proyectos en ${state.activeField}`, `Projects in ${state.activeField}`) : ui('Tus Proyectos y Cursos', 'Your Projects & Courses')} (${filteredProjects.length})</h3>
          <button type="button" class="btn-ghost-sm" onclick="openProjectManagerModal(true)">
            ➕ ${ui('Nuevo Proyecto', 'New Project')}
          </button>
        </div>
        <div class="home-projects-grid">
          ${filteredProjects.map(p => {
            const scopeVal = `proyecto:${p.campo}|${p.proyecto}`;
            const stats = p.stats || {};
            const lessonsCount = (p.lecciones || []).length;
            const desc = (p.descripcion || '').trim() || ui('Sin descripción registrada.', 'No description registered.');
            return `
              <div class="home-project-card" onclick="switchProjectScope('${escapeHtml(scopeVal)}')">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:6px;">
                  <span class="badge-folder" style="font-size:11px;">📂 ${escapeHtml(p.campo)}</span>
                  ${typeof getProjectTypeBadge === 'function' ? getProjectTypeBadge(p.tipo) : ''}
                </div>
                <h4 style="margin:4px 0 6px 0; font-size:15.5px; font-weight:700; color:var(--text-main);">${escapeHtml(p.proyecto)}</h4>
                <p style="margin:0 0 12px 0; font-size:12.5px; color:var(--text-secondary); line-height:1.45; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">
                  ${escapeHtml(desc)}
                </p>
                <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; padding-top:8px; border-top:1px solid var(--border-subtle); font-size:11.5px; color:var(--text-muted);">
                  <span>⚛️ ${stats.atomicas || 0} · 📄 ${stats.fuentes || 0} · 🗺️ ${stats.mapas || 0}${lessonsCount ? ` · 📚 ${lessonsCount} ${ui('temas', 'topics')}` : ''}</span>
                  <span style="color:var(--accent-primary); font-weight:600;">${ui('Abrir →', 'Open →')}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  } else {
    dashboardEl.innerHTML = '';
  }
}

function openPromptStudioForActiveProject() {
  switchView('llm');
  populatePromptCustomizerSelect();
  setTimeout(() => {
    const modInput = document.getElementById('prompt-cfg-modulo');
    const titleInput = document.getElementById('prompt-cfg-leccion-titulo');
    if (modInput && !modInput.value) modInput.focus();
    else titleInput?.focus();
  }, 80);
}
window.openPromptStudioForActiveProject = openPromptStudioForActiveProject;

function openCreateNoteInActiveProject(tipo = 'atomica') {
  if (tipo === 'atomica') {
    switchView('atomicas');
    setTimeout(() => document.getElementById('btn-new-atomica')?.click(), 60);
  } else if (tipo === 'fuente') {
    switchView('fuentes');
    setTimeout(() => document.getElementById('btn-new-fuente')?.click(), 60);
  }
}
window.openCreateNoteInActiveProject = openCreateNoteInActiveProject;

function updateHeaderUserProfile() {
  const elName = document.getElementById('header-user-name');
  if (elName) {
    elName.textContent = state.userName || ui("Identifícate", "Get Started");
  }
}

// -------------------------------------------------------------
// LLM Prompt Studio & Configurador Interactivo de Categorización
// -------------------------------------------------------------
let currentPromptLang = state.lang;

const promptCustomConfig = {
  selectedScope: '', // 'campo|proyecto'
  modulo: '',
  leccionNumero: '',
  leccionTitulo: '',
  tags: '',
  focus: ''
};

function populatePromptCustomizerSelect() {
  const select = document.getElementById('prompt-cfg-project-select');
  if (!select) return;

  const projects = state.projects || [];
  let html = `<option value="">${ui('🌐 (Detectar del documento / Sin proyecto fijo)', '🌐 (Auto-detect from document / No fixed project)')}</option>`;
  projects.forEach(p => {
    const icon = typeof getProjectTypeIcon === 'function' ? getProjectTypeIcon(p.tipo) : '🎯';
    const val = `${p.campo}|${p.proyecto}`;
    html += `<option value="${escapeHtml(val)}">${icon} [${escapeHtml(p.campo)}] ${escapeHtml(p.proyecto)}</option>`;
  });
  select.innerHTML = html;

  if (state.activeField && state.activeProject) {
    const activeVal = `${state.activeField}|${state.activeProject}`;
    select.value = activeVal;
    promptCustomConfig.selectedScope = activeVal;
  } else if (promptCustomConfig.selectedScope && projects.some(p => `${p.campo}|${p.proyecto}` === promptCustomConfig.selectedScope)) {
    select.value = promptCustomConfig.selectedScope;
  } else if (projects.length === 1) {
    const singleVal = `${projects[0].campo}|${projects[0].proyecto}`;
    select.value = singleVal;
    promptCustomConfig.selectedScope = singleVal;
  } else {
    select.value = '';
    promptCustomConfig.selectedScope = '';
  }

  syncPromptCustomizerProjectDefaults();
}
window.populatePromptCustomizerSelect = populatePromptCustomizerSelect;

function syncPromptCustomizerProjectDefaults() {
  const badge = document.getElementById('prompt-cfg-active-badge');
  const numInput = document.getElementById('prompt-cfg-leccion-num');
  const modalNumInput = document.getElementById('modal-prompt-cfg-leccion-num');
  const modInput = document.getElementById('prompt-cfg-modulo');
  const lblMod = document.getElementById('lbl-prompt-cfg-modulo');
  const lblNum = document.getElementById('lbl-prompt-cfg-leccion-num');
  const lblTitle = document.getElementById('lbl-prompt-cfg-leccion-titulo');

  let targetCampo = state.activeField || '';
  let targetProyecto = state.activeProject || '';
  if (promptCustomConfig.selectedScope && promptCustomConfig.selectedScope.includes('|')) {
    const [c, p] = promptCustomConfig.selectedScope.split('|');
    targetCampo = c;
    targetProyecto = p;
  }

  const projObj = (state.projects || []).find(x =>
    x.proyecto === targetProyecto && (!targetCampo || x.campo === targetCampo)
  );

  if (projObj) {
    const tipo = (projObj.tipo || 'curso').toLowerCase();
    const icon = typeof getProjectTypeIcon === 'function' ? getProjectTypeIcon(tipo) : '🎓';
    const nextNum = ((projObj.lecciones || []).length) + 1;
    if (badge) {
      badge.innerHTML = `${icon} ${escapeHtml(projObj.campo)} / <strong>${escapeHtml(projObj.proyecto)}</strong>`;
      badge.style.color = 'var(--accent-primary)';
    }
    if (numInput && !promptCustomConfig.leccionNumero) {
      numInput.placeholder = `${ui('Sugerido:', 'Suggested:')} ${nextNum}`;
    }
    if (modalNumInput && !promptCustomConfig.leccionNumero) {
      modalNumInput.placeholder = String(nextNum);
    }
    const lastWithModulo = [...(projObj.lecciones || [])].reverse().find(l => l && l.modulo);
    if (modInput && lastWithModulo && !promptCustomConfig.modulo) {
      modInput.placeholder = `${ui('Último:', 'Last:')} ${lastWithModulo.modulo}`;
    }

    if (tipo === 'libro') {
      if (lblMod) lblMod.textContent = ui('📦 Parte / Bloque del Libro', '📦 Book Part / Section');
      if (lblNum) lblNum.textContent = ui('🔢 Nº Capítulo', '🔢 Chapter #');
      if (lblTitle) lblTitle.textContent = ui('📑 Título del Capítulo', '📑 Chapter Title');
    } else if (tipo === 'investigacion') {
      if (lblMod) lblMod.textContent = ui('📦 Fase / Línea de Investigación', '📦 Research Phase / Track');
      if (lblNum) lblNum.textContent = ui('🔢 Nº Entrega / Paper', '🔢 Paper / Batch #');
      if (lblTitle) lblTitle.textContent = ui('📑 Título del Paper o Estudio', '📑 Paper or Study Title');
    } else if (tipo === 'noticias') {
      if (lblMod) lblMod.textContent = ui('📦 Categoría / Cobertura', '📦 Coverage Category');
      if (lblNum) lblNum.textContent = ui('🔢 Nº Entrega', '🔢 Update #');
      if (lblTitle) lblTitle.textContent = ui('📑 Titular / Evento', '📑 Headline / Event');
    } else {
      if (lblMod) lblMod.textContent = ui('📦 Módulo / Bloque / Unidad', '📦 Module / Unit');
      if (lblNum) lblNum.textContent = ui('🔢 Nº Tema / Lección', '🔢 Topic / Lesson #');
      if (lblTitle) lblTitle.textContent = ui('📑 Título del Tema / Lección', '📑 Topic / Lesson Title');
    }
  } else {
    if (badge) {
      badge.textContent = ui('🌐 Modo Libre / Auto-detectar del documento', '🌐 Free Mode / Auto-detect from document');
      badge.style.color = 'var(--text-secondary)';
    }
    if (numInput && !promptCustomConfig.leccionNumero) numInput.placeholder = 'Ej. 1';
  }
}

function getContextualLlmPrompt(lang = currentPromptLang) {
  let promptOut = lang === 'en' ? (window.MASTER_LLM_PROMPT_EN || '') : (window.MASTER_LLM_PROMPT_ES || '');
  if (!promptOut) return '';

  // Detectar proyecto desde el selector del Prompt Studio, el modal de importación o el selector global
  let targetCampo = state.activeField || '';
  let targetProyecto = state.activeProject || '';

  if (promptCustomConfig.selectedScope && promptCustomConfig.selectedScope.includes('|')) {
    const [c, p] = promptCustomConfig.selectedScope.split('|');
    targetCampo = c || targetCampo;
    targetProyecto = p || targetProyecto;
  }

  const importModal = document.getElementById('modal-import-json');
  const importSelect = document.getElementById('import-scope-project-select');
  if (importModal?.open && importSelect?.value && importSelect.value.includes('|')) {
    const [c, p] = importSelect.value.split('|');
    targetCampo = c || targetCampo;
    targetProyecto = p || targetProyecto;
  }

  const customModulo = (promptCustomConfig.modulo || '').trim();
  const customLessonNum = (promptCustomConfig.leccionNumero || '').trim();
  const customLessonTitle = (promptCustomConfig.leccionTitulo || '').trim();
  const customTagsRaw = (promptCustomConfig.tags || '').trim();
  const customFocus = (promptCustomConfig.focus || '').trim();

  const hasCustomFields = Boolean(customModulo || customLessonNum || customLessonTitle || customTagsRaw || customFocus);

  if (!targetProyecto && !hasCustomFields) {
    return promptOut;
  }

  const projObj = (state.projects || []).find(x =>
    (x.proyecto === targetProyecto || slugifyClient(x.proyecto) === slugifyClient(targetProyecto)) &&
    (!targetCampo || x.campo === targetCampo || slugifyClient(x.campo) === slugifyClient(targetCampo))
  );
  const resolvedCampo = projObj?.campo || targetCampo || 'General';
  const resolvedProyecto = projObj?.proyecto || targetProyecto;
  const resolvedTipo = projObj?.tipo || 'curso';
  const resolvedDesc = projObj?.descripcion || '';
  const effectiveLessonNum = customLessonNum
    ? (parseInt(customLessonNum, 10) || 1)
    : (((projObj?.lecciones || []).length) + 1);

  const extraTagsList = customTagsRaw
    ? customTagsRaw.split(',').map(t => t.trim()).filter(Boolean)
    : [];

  // Sustituir también los valores de ejemplo dentro del bloque JSON del prompt para que el LLM no copie el proyecto de ejemplo ni invente nombres distintos
  if (resolvedProyecto) {
    promptOut = promptOut
      .replace(/"campo":\s*"(?:Inteligencia Artificial|Artificial Intelligence)"/g, `"campo": ${JSON.stringify(resolvedCampo)}`)
      .replace(/"proyecto":\s*"AI Agents and Automations"/g, `"proyecto": ${JSON.stringify(resolvedProyecto)}`)
      .replace(/"proyecto_tipo":\s*"curso"/g, `"proyecto_tipo": ${JSON.stringify(resolvedTipo)}`);
  }
  if ((resolvedProyecto && resolvedTipo === 'curso') || customLessonNum) {
    promptOut = promptOut.replace(/"leccion_numero":\s*1/g, `"leccion_numero": ${effectiveLessonNum}`);
  }
  if (customLessonTitle) {
    promptOut = promptOut
      .replace(/"leccion_titulo":\s*"(?:Fundamentos del Tema|Topic Fundamentals)"/g, `"leccion_titulo": ${JSON.stringify(customLessonTitle)}`);
  }

  // Obtener las notas atómicas existentes en este proyecto para que el LLM las enlace con [[wikilinks]]
  const targetPSlug = slugifyClient(resolvedProyecto);
  const existingNotes = resolvedProyecto
    ? (state.notes.atomica || []).filter(n => {
        const nProy = n.proyecto || n.data?.proyecto || '';
        return nProy === resolvedProyecto || (targetPSlug && slugifyClient(nProy) === targetPSlug);
      })
    : [];

  const existingListText = existingNotes.length > 0
    ? existingNotes.slice(0, 45).map(n => `  - [[${n.id}]] : "${n.data?.titulo || n.id}"`).join('\n')
    : (lang === 'en' ? '  (No prior atomic notes in this project yet)' : '  (Aún no hay notas atómicas previas en este proyecto)');

  let lines = [];
  if (lang === 'en') {
    lines.push('=================================================================');
    lines.push('ACTIVE PROJECT CONTEXT, MODULE/TOPIC CATEGORIZATION & INCREMENTAL LINKING:');
    if (resolvedProyecto) {
      lines.push(`- CRITICAL: Do NOT alter or append module/lesson names to "proyecto" or "campo". Use the exact strings below.`);
      lines.push(`- You MUST set "campo": "${resolvedCampo}"`);
      lines.push(`- You MUST set "proyecto": "${resolvedProyecto}"`);
      lines.push(`- You MUST set "proyecto_tipo": "${resolvedTipo}"`);
      if (resolvedDesc) lines.push(`- Project description: "${resolvedDesc}"`);
    }
    if (customModulo) {
      lines.push(`- MODULE / UNIT CATEGORIZATION: You MUST set "modulo": "${customModulo}" at the root of the JSON and inside every note object.`);
    }
    if ((resolvedProyecto && resolvedTipo === 'curso') || customLessonNum) {
      lines.push(`- TOPIC / LESSON NUMBER: You MUST set "leccion_numero": ${effectiveLessonNum} at the root of the JSON.`);
    }
    if (customLessonTitle) {
      lines.push(`- TOPIC / LESSON TITLE: You MUST set "leccion_titulo": "${customLessonTitle}" at the root of the JSON, and title the primary Content Map accordingly.`);
    }
    if (extraTagsList.length > 0) {
      lines.push(`- REQUIRED CATEGORY TAGS: Include these tags in every generated note's "tags" array: ${JSON.stringify(extraTagsList)}`);
    }
    if (customFocus) {
      lines.push(`- SPECIAL EXTRACTION FOCUS / USER INSTRUCTIONS: ${customFocus}`);
    }
    if (resolvedProyecto) {
      lines.push(`- Existing Atomic Notes in this project (actively connect your new atomic notes to these IDs using [[slug]] in 'como_se_conecta' and 'enlaces' wherever conceptually relevant):`);
      lines.push(existingListText);
    }
    lines.push('=================================================================');
  } else {
    lines.push('=================================================================');
    lines.push('CONTEXTO DEL PROYECTO, CATEGORIZACIÓN (MÓDULO / TEMA) Y CONEXIÓN INCREMENTAL:');
    if (resolvedProyecto) {
      lines.push(`- CRÍTICO: NO modifiques ni añadas sufijos de módulo/lección al nombre de "proyecto" ni de "campo". Usa literalmente los valores exactos indicados abajo.`);
      lines.push(`- DEBES usar exactamente "campo": "${resolvedCampo}"`);
      lines.push(`- DEBES usar exactamente "proyecto": "${resolvedProyecto}"`);
      lines.push(`- DEBES usar "proyecto_tipo": "${resolvedTipo}"`);
      if (resolvedDesc) lines.push(`- Descripción del proyecto: "${resolvedDesc}"`);
    }
    if (customModulo) {
      lines.push(`- CATEGORIZACIÓN POR MÓDULO / BLOQUE: DEBES incluir "modulo": "${customModulo}" en la raíz del JSON y en cada nota generada.`);
    }
    if ((resolvedProyecto && resolvedTipo === 'curso') || customLessonNum) {
      lines.push(`- NÚMERO DE TEMA / LECCIÓN: DEBES usar "leccion_numero": ${effectiveLessonNum} en la raíz del JSON.`);
    }
    if (customLessonTitle) {
      lines.push(`- TÍTULO DEL TEMA / LECCIÓN: DEBES usar "leccion_titulo": "${customLessonTitle}" en la raíz del JSON y reflejarlo en el título del Mapa de Contenido.`);
    }
    if (extraTagsList.length > 0) {
      lines.push(`- ETIQUETAS DE CATEGORÍA OBLIGATORIAS: Incluye estas etiquetas en el array "tags" de todas las notas generadas: ${JSON.stringify(extraTagsList)}`);
    }
    if (customFocus) {
      lines.push(`- INSTRUCCIONES ESPECÍFICAS / ENFOQUE SOLICITADO POR EL USUARIO: ${customFocus}`);
    }
    if (resolvedProyecto) {
      lines.push(`- Notas Atómicas YA EXISTENTES en este proyecto (conecta deliberadamente las nuevas notas atómicas con estos identificadores usando [[slug]] en 'como_se_conecta' y en el array 'enlaces' siempre que haya relación conceptual):`);
      lines.push(existingListText);
    }
    lines.push('=================================================================');
  }

  const contextBlock = '\n' + lines.join('\n') + '\n\n';

  const markerEs = 'A continuación se adjunta la documentación a procesar:';
  const markerEn = 'Attached is the documentation to process:';
  if (promptOut.includes(markerEs)) {
    return promptOut.replace(markerEs, contextBlock + markerEs);
  }
  if (promptOut.includes(markerEn)) {
    return promptOut.replace(markerEn, contextBlock + markerEn);
  }
  return promptOut + '\n' + contextBlock;
}
window.getContextualLlmPrompt = getContextualLlmPrompt;

function initLlmStudio() {
  const btnPromptEs = document.getElementById('btn-prompt-lang-es');
  const btnPromptEn = document.getElementById('btn-prompt-lang-en');
  const btnCopyStudio = document.getElementById('btn-copy-studio-prompt');

  btnPromptEs?.addEventListener('click', () => {
    currentPromptLang = 'es';
    btnPromptEs.classList.add('active');
    btnPromptEn.classList.remove('active');
    updateStudioPromptText();
  });

  btnPromptEn?.addEventListener('click', () => {
    currentPromptLang = 'en';
    btnPromptEn.classList.add('active');
    btnPromptEs.classList.remove('active');
    updateStudioPromptText();
  });

  btnCopyStudio?.addEventListener('click', async () => {
    const ta = document.getElementById('studio-prompt-textarea');
    const promptText = (ta && ta.value.trim()) ? ta.value : getContextualLlmPrompt(currentPromptLang);
    try {
      await navigator.clipboard.writeText(promptText);
      showToast(state.lang === 'en' ? 'Customized prompt copied to clipboard 📋' : 'Prompt personalizado copiado al portapapeles 📋', 'success');
    } catch (e) {
      if (ta) {
        ta.select();
        document.execCommand('copy');
        showToast(state.lang === 'en' ? 'Prompt copied to clipboard 📋' : 'Prompt copiado al portapapeles 📋', 'success');
      }
    }
  });

  // Modal import prompt buttons
  const btnImportPromptEs = document.getElementById('btn-import-prompt-lang-es');
  const btnImportPromptEn = document.getElementById('btn-import-prompt-lang-en');
  btnImportPromptEs?.addEventListener('click', () => {
    currentPromptLang = 'es';
    btnImportPromptEs.classList.add('active');
    btnImportPromptEn.classList.remove('active');
    updateStudioPromptText();
  });
  btnImportPromptEn?.addEventListener('click', () => {
    currentPromptLang = 'en';
    btnImportPromptEn.classList.add('active');
    btnImportPromptEs.classList.remove('active');
    updateStudioPromptText();
  });

  // Eventos del configurador de categorización del Prompt (Studio + Modal sincronizados)
  const projSelect = document.getElementById('prompt-cfg-project-select');
  projSelect?.addEventListener('change', (e) => {
    promptCustomConfig.selectedScope = e.target.value || '';
    if (promptCustomConfig.selectedScope) {
      switchProjectScope(`proyecto:${promptCustomConfig.selectedScope}`);
    } else {
      syncPromptCustomizerProjectDefaults();
      updateStudioPromptText();
    }
  });

  const bindSyncedInput = (studioId, modalId, configKey, importModalTargetId = null) => {
    const sEl = document.getElementById(studioId);
    const mEl = document.getElementById(modalId);
    const handler = (val) => {
      promptCustomConfig[configKey] = val;
      if (sEl && sEl.value !== val) sEl.value = val;
      if (mEl && mEl.value !== val) mEl.value = val;
      if (importModalTargetId) {
        const targetEl = document.getElementById(importModalTargetId);
        if (targetEl && val) targetEl.value = val;
      }
      updateStudioPromptText();
    };
    sEl?.addEventListener('input', (e) => handler(e.target.value));
    mEl?.addEventListener('input', (e) => handler(e.target.value));
  };

  bindSyncedInput('prompt-cfg-modulo', 'modal-prompt-cfg-modulo', 'modulo', 'import-course-modulo');
  bindSyncedInput('prompt-cfg-leccion-num', 'modal-prompt-cfg-leccion-num', 'leccionNumero', 'import-course-lesson-num');
  bindSyncedInput('prompt-cfg-leccion-titulo', 'modal-prompt-cfg-leccion-titulo', 'leccionTitulo', 'import-course-lesson-title');
  bindSyncedInput('prompt-cfg-tags', 'modal-prompt-cfg-tags', 'tags');
  bindSyncedInput('prompt-cfg-focus', 'modal-prompt-cfg-focus', 'focus');

  document.getElementById('btn-reset-prompt-cfg')?.addEventListener('click', () => {
    promptCustomConfig.modulo = '';
    promptCustomConfig.leccionNumero = '';
    promptCustomConfig.leccionTitulo = '';
    promptCustomConfig.tags = '';
    promptCustomConfig.focus = '';
    ['prompt-cfg-modulo', 'modal-prompt-cfg-modulo', 'prompt-cfg-leccion-num', 'modal-prompt-cfg-leccion-num', 'prompt-cfg-leccion-titulo', 'modal-prompt-cfg-leccion-titulo', 'prompt-cfg-tags', 'modal-prompt-cfg-tags', 'prompt-cfg-focus', 'modal-prompt-cfg-focus'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    syncPromptCustomizerProjectDefaults();
    updateStudioPromptText();
  });

  populatePromptCustomizerSelect();
  updateStudioPromptText();
}

function updateStudioPromptText() {
  for (const prefix of ['btn-prompt-lang-', 'btn-import-prompt-lang-']) {
    for (const lang of ['en', 'es']) {
      const button = document.getElementById(prefix + lang);
      button?.classList.toggle('active', currentPromptLang === lang);
      button?.setAttribute('aria-pressed', String(currentPromptLang === lang));
    }
  }
  syncPromptCustomizerProjectDefaults();
  const promptText = getContextualLlmPrompt(currentPromptLang);
  const studioTa = document.getElementById('studio-prompt-textarea');
  const modalTa = document.getElementById('llm-prompt-textarea');
  if (studioTa) studioTa.value = promptText;
  if (modalTa) modalTa.value = promptText;
}

// -------------------------------------------------------------
// Navegación Principal
// -------------------------------------------------------------
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      switchView(view);
    });
  });

  const headerRepasoBtn = document.getElementById('btn-header-repaso');
  if (headerRepasoBtn) {
    headerRepasoBtn.addEventListener('click', () => {
      switchView('repaso');
    });
  }

  // Filtros de Bandeja
  const filterBtns = document.querySelectorAll('.btn-filter[data-filter]');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.inboxFilter = btn.dataset.filter;
      renderInboxView();
    });
  });

  // Selector de vista en Mapas (Tarjetas vs Matriz)
  document.getElementById('btn-map-cards-view')?.addEventListener('click', () => {
    state.mapViewMode = 'cards';
    document.getElementById('btn-map-cards-view').classList.add('active');
    document.getElementById('btn-map-matrix-view').classList.remove('active');
    renderMapasView();
  });

  document.getElementById('btn-map-matrix-view')?.addEventListener('click', () => {
    state.mapViewMode = 'matrix';
    document.getElementById('btn-map-matrix-view').classList.add('active');
    document.getElementById('btn-map-cards-view').classList.remove('active');
    renderMapasView();
  });

  // Botones de acción general
  document.getElementById('btn-new-atomica')?.addEventListener('click', () => openNewAtomicaModal());
  document.getElementById('btn-new-fuente')?.addEventListener('click', () => openNewFuenteModal());
  document.getElementById('btn-new-mapa')?.addEventListener('click', () => openNewMapaModal());
  document.getElementById('btn-refresh-queue')?.addEventListener('click', () => loadReviewQueue());
  document.getElementById('btn-practice-all')?.addEventListener('click', () => loadReviewQueue(true));
  document.getElementById('btn-refresh-analytics')?.addEventListener('click', () => loadAnalyticsView());
}

function switchView(viewName) {
  const changedView = state.currentView !== viewName;
  if (state.currentView === 'grafo' && viewName !== 'grafo') { stopGraphAnimation(); graphCancelGesture(); }
  state.currentView = viewName;
  if (changedView) {
    const container = document.querySelector('.content-container');
    if (container) container.scrollTop = 0;
  }

  // Actualizar items de menú
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  // Actualizar paneles
  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.classList.remove('active');
  });

  const target = document.getElementById(`view-${viewName}`);
  if (target) target.classList.add('active');

  if (typeof updateStudyCompass === 'function') updateStudyCompass();

  // Lógica específica por vista
  if (viewName === 'inicio') {
    renderHomeView();
  } else if (viewName === 'llm') {
    updateStudioPromptText();
  } else if (viewName === 'repaso') {
    loadReviewQueue();
  } else if (viewName === 'grafo') {
    renderGraph();
  } else if (viewName === 'analitica') {
    loadAnalyticsView();
  }
}
window.switchView = switchView;

window.openNoteInStudyStage = function(tipo, id) {
  if (!id) return;
  if (tipo === 'atomica') {
    switchView('atomicas');
    if (typeof selectExpandedAtomica === 'function') {
      state.activeExpandedAtomicaId = null; // force open
      selectExpandedAtomica(id);
    }
  } else if (tipo === 'fuente') {
    switchView('fuentes');
    if (typeof selectExpandedFuente === 'function') {
      state.activeExpandedFuenteId = null; // force open
      selectExpandedFuente(id);
    }
  } else if (tipo === 'mapa') {
    switchView('mapas');
    if (typeof selectExpandedMapa === 'function') {
      state.activeExpandedMapaId = null; // force open
      selectExpandedMapa(id);
    }
  }
};

window.studyLessonMapFromHome = function(mapId) {
  if (!mapId) return;
  state.mapViewMode = 'cards';
  document.getElementById('btn-map-cards-view')?.classList.add('active');
  document.getElementById('btn-map-matrix-view')?.classList.remove('active');
  state.activeExpandedMapaId = null;
  switchView('mapas');
  if (typeof selectExpandedMapa === 'function') selectExpandedMapa(mapId);
};

window.studyLessonNotesFromHome = function(modulo, leccionTitulo, firstAtomicaId) {
  state.selectedAtomicaModulo = modulo || '';
  state.selectedAtomicaLeccion = leccionTitulo || '';
  state.atomicaSearchQuery = '';
  state.activeExpandedAtomicaId = firstAtomicaId || null;
  state.activeExpandedAtomicaTab = null;
  switchView('atomicas');
  renderAtomicasView();
};


// -------------------------------------------------------------
// -------------------------------------------------------------
// Carga de Datos desde API (Notas, Carpetas y Proyectos)
// -------------------------------------------------------------
async function loadAllData() {
  try {
    const [notesRes, foldersRes, projectsRes] = await Promise.all([
      apiFetch('/api/notes'),
      apiFetch('/api/folders'),
      apiFetch('/api/projects').catch(() => ({ json: () => ({ proyectos: [], campos: [] }) }))
    ]);
    const data = await notesRes.json();
    const folderData = await foldersRes.json();
    const projectsData = await projectsRes.json();
    state.notes = data;
    state.folders = folderData.folders || { atomica: [], fuente: [], mapa: [], bandeja: [] };
    state.foldersMetadata = folderData.metadata || { atomica: {}, fuente: {}, mapa: {}, bandeja: {} };
    state.projects = projectsData.proyectos || [];

    updateBadges();
    populateProjectScopeSelects();
    populateFolderSelects();
    populateTagFilters();
    updateActiveScopeBanner();
    renderHomeView();
    renderInboxView();
    renderAtomicasView();
    renderFuentesView();
    renderMapasView();
    populateSelects();

    checkDueReviews();
  } catch (err) {
    console.error('Error cargando notas:', err);
    showToast(ui("Error conectando con el servidor", "Could not connect to the server"), 'danger');
  }
}

// -------------------------------------------------------------
// Gestión de Campos de Conocimiento y Proyectos / Cursos
// -------------------------------------------------------------
// -------------------------------------------------------------
// Gestión de Campos de Conocimiento y Proyectos / Cursos
// -------------------------------------------------------------
let projectDropdownSearchQuery = '';
let isCreatingProjectLock = false;

function initProjectScoping() {
  const globalSelect = document.getElementById('global-project-select');
  globalSelect?.addEventListener('change', (e) => {
    switchProjectScope(e.target.value);
  });

  const reviewSelect = document.getElementById('review-scope-select');
  reviewSelect?.addEventListener('change', (e) => {
    switchProjectScope(e.target.value);
  });

  document.getElementById('btn-clear-scope')?.addEventListener('click', () => {
    clearProjectScope();
  });

  document.getElementById('btn-pm-edit-save')?.addEventListener('click', () => {
    handleSaveProjectEdit();
  });

  document.getElementById('btn-pm-edit-delete')?.addEventListener('click', () => {
    handleDeleteProject();
  });

  document.getElementById('btn-quick-proj-save')?.addEventListener('click', () => {
    handleQuickProjectSave();
  });

  // Cerrar el menú desplegable de proyectos al hacer clic fuera
  document.addEventListener('click', (e) => {
    const container = document.getElementById('project-scope-container');
    const menu = document.getElementById('project-dropdown-menu');
    if (menu && menu.style.display !== 'none' && container && !container.contains(e.target)) {
      closeProjectDropdown();
    }
  });
}

function getProjectTypeIcon(tipo) {
  const t = (tipo || 'curso').toLowerCase();
  switch (t) {
    case 'curso': return '🎓';
    case 'noticias': return '📰';
    case 'investigacion': return '🔬';
    case 'libro': return '📖';
    case 'trabajo': return '💼';
    default: return '📂';
  }
}

function getProjectTypeLabel(tipo) {
  const t = (tipo || 'curso').toLowerCase();
  switch (t) {
    case 'curso': return ui('Curso', 'Course');
    case 'noticias': return ui('Noticias', 'News');
    case 'investigacion': return ui('Investigación', 'Research');
    case 'libro': return ui('Libro', 'Book');
    case 'trabajo': return ui('Trabajo', 'Work');
    default: return ui('General', 'General');
  }
}

function toggleProjectDropdown(event) {
  if (event) event.stopPropagation();
  const menu = document.getElementById('project-dropdown-menu');
  const trigger = document.getElementById('btn-project-dropdown-trigger');
  if (!menu) return;
  const isOpen = menu.style.display !== 'none';
  if (isOpen) {
    closeProjectDropdown();
  } else {
    projectDropdownSearchQuery = '';
    const searchInput = document.getElementById('pd-search-input');
    if (searchInput) {
      searchInput.value = '';
      searchInput.placeholder = ui('Buscar proyecto o campo...', 'Search projects or fields...');
    }
    renderProjectDropdownMenu();
    menu.style.display = 'flex';
    trigger?.classList.add('open');
    setTimeout(() => searchInput?.focus(), 60);
  }
}
window.toggleProjectDropdown = toggleProjectDropdown;

function closeProjectDropdown() {
  const menu = document.getElementById('project-dropdown-menu');
  const trigger = document.getElementById('btn-project-dropdown-trigger');
  if (menu) menu.style.display = 'none';
  trigger?.classList.remove('open');
}
window.closeProjectDropdown = closeProjectDropdown;

function filterProjectDropdown(query) {
  projectDropdownSearchQuery = (query || '').trim().toLowerCase();
  renderProjectDropdownMenu();
}
window.filterProjectDropdown = filterProjectDropdown;

function updateProjectDropdownTrigger() {
  const iconEl = document.getElementById('pd-trigger-icon');
  const textEl = document.getElementById('pd-trigger-text');
  const countEl = document.getElementById('pd-trigger-count');
  const clearBtn = document.getElementById('btn-clear-scope-inline');
  const container = document.getElementById('project-scope-container');

  const projects = state.projects || [];

  if (state.activeField && state.activeProject) {
    const found = projects.find(p => p.campo === state.activeField && p.proyecto === state.activeProject);
    const icon = found ? getProjectTypeIcon(found.tipo) : '🎯';
    const noteCount = found?.stats?.total ?? 0;
    if (iconEl) iconEl.textContent = icon;
    if (textEl) {
      textEl.removeAttribute('data-i18n');
      textEl.innerHTML = `<span class="pd-trig-field">${escapeHtml(state.activeField)}</span><span class="pd-trig-sep">›</span><span class="pd-trig-proj">${escapeHtml(state.activeProject)}</span>`;
    }
    if (countEl) {
      countEl.textContent = noteCount;
      countEl.style.display = 'inline-flex';
    }
    if (clearBtn) clearBtn.style.display = 'inline-flex';
    container?.classList.add('has-active-scope');
  } else if (state.activeField) {
    const fieldProjects = projects.filter(p => p.campo === state.activeField);
    const totalNotes = fieldProjects.reduce((acc, p) => acc + (p.stats?.total || 0), 0);
    if (iconEl) iconEl.textContent = '📂';
    if (textEl) {
      textEl.removeAttribute('data-i18n');
      textEl.innerHTML = `<span class="pd-trig-field">${ui('Campo', 'Field')}</span><span class="pd-trig-sep">›</span><span class="pd-trig-proj">${escapeHtml(state.activeField)}</span>`;
    }
    if (countEl) {
      countEl.textContent = totalNotes;
      countEl.style.display = 'inline-flex';
    }
    if (clearBtn) clearBtn.style.display = 'inline-flex';
    container?.classList.add('has-active-scope');
  } else {
    if (iconEl) iconEl.textContent = '🌐';
    if (textEl) {
      textEl.textContent = ui('Todos los Proyectos', 'All Projects');
    }
    if (countEl) {
      countEl.textContent = projects.length;
      countEl.style.display = 'inline-flex';
    }
    if (clearBtn) clearBtn.style.display = 'none';
    container?.classList.remove('has-active-scope');
  }
}

function renderProjectDropdownMenu() {
  const body = document.getElementById('pd-menu-body');
  if (!body) return;

  const projects = state.projects || [];
  const totalWorkspaceNotes = (state.notes.atomica?.length || 0) + (state.notes.fuente?.length || 0) + (state.notes.mapa?.length || 0);
  const isAllActive = !state.activeField && !state.activeProject;
  const q = projectDropdownSearchQuery;

  // Agrupar proyectos por campo
  const projectsByCampo = {};
  projects.forEach(p => {
    const c = p.campo || ui('General', 'General');
    if (!projectsByCampo[c]) projectsByCampo[c] = [];
    projectsByCampo[c].push(p);
  });

  const sortedCampos = Object.keys(projectsByCampo).sort((a, b) => a.localeCompare(b));

  let html = '';

  // Opción global: Ver todo
  if (!q) {
    html += `
      <div class="pd-item pd-item-all ${isAllActive ? 'active' : ''}" onclick="switchProjectScope(''); closeProjectDropdown();">
        <div class="pd-item-left">
          <span class="pd-item-icon">🌐</span>
          <div class="pd-item-info">
            <div class="pd-item-title">${ui('Todos los Campos y Proyectos', 'All Fields & Projects')}</div>
            <div class="pd-item-sub">${ui('Mostrar toda tu biblioteca sin filtros', 'Show your entire library unfiltered')}</div>
          </div>
        </div>
        <div class="pd-item-right">
          <span class="pd-count-pill">${totalWorkspaceNotes} ${ui('notas', 'notes')}</span>
          ${isAllActive ? '<span class="pd-check">✓</span>' : ''}
        </div>
      </div>
    `;
  }

  let anyMatch = false;

  sortedCampos.forEach(campo => {
    const projs = projectsByCampo[campo] || [];
    const matchingProjs = q
      ? projs.filter(p =>
          p.proyecto.toLowerCase().includes(q) ||
          p.campo.toLowerCase().includes(q) ||
          (p.descripcion && p.descripcion.toLowerCase().includes(q)) ||
          (p.tipo && p.tipo.toLowerCase().includes(q))
        )
      : projs;

    if (matchingProjs.length === 0 && (!q || !campo.toLowerCase().includes(q))) {
      return;
    }
    anyMatch = true;

    const isFieldOnlyActive = (state.activeField === campo && !state.activeProject);
    const fieldNotesCount = projs.reduce((sum, p) => sum + (p.stats?.total || 0), 0);
    const safeCampoScope = `campo:${campo}`;

    html += `
      <div class="pd-field-group">
        <div class="pd-field-header ${isFieldOnlyActive ? 'active' : ''}">
          <div class="pd-field-title-wrap" onclick="switchProjectScope(${inlineArgument(safeCampoScope)}); closeProjectDropdown();" title="${ui('Filtrar todo este campo', 'Filter entire field')}">
            <span class="pd-field-folder-icon">📂</span>
            <span class="pd-field-name">${escapeHtml(campo)}</span>
          </div>
          <button type="button" class="pd-field-filter-btn ${isFieldOnlyActive ? 'active' : ''}" onclick="switchProjectScope(${inlineArgument(safeCampoScope)}); closeProjectDropdown();">
            ${isFieldOnlyActive ? `✓ ${ui('Campo activo', 'Active field')}` : `${ui('Ver campo', 'View field')} (${fieldNotesCount})`}
          </button>
        </div>
        <div class="pd-field-projects">
    `;

    matchingProjs.forEach(p => {
      const isProjActive = (state.activeField === p.campo && state.activeProject === p.proyecto);
      const scopeVal = `proyecto:${p.campo}|${p.proyecto}`;
      const icon = getProjectTypeIcon(p.tipo);
      const typeLabel = getProjectTypeLabel(p.tipo);
      const noteCount = p.stats?.total || 0;
      const isCourse = (p.tipo === 'curso' || (!p.tipo && p.lecciones?.length));
      const lessonsCount = p.lecciones?.length || 0;

      html += `
        <div class="pd-project-row ${isProjActive ? 'active' : ''}" onclick="switchProjectScope(${inlineArgument(scopeVal)}); closeProjectDropdown();">
          <div class="pd-proj-main">
            <span class="pd-proj-type-icon" title="${escapeHtml(typeLabel)}">${icon}</span>
            <div class="pd-proj-text">
              <div class="pd-proj-title-line">
                <span class="pd-proj-name">${escapeHtml(p.proyecto)}</span>
                <span class="pd-proj-type-tag type-${escapeHtml((p.tipo || 'curso').toLowerCase())}">${escapeHtml(typeLabel)}</span>
              </div>
              ${p.descripcion ? `<div class="pd-proj-desc">${escapeHtml(p.descripcion)}</div>` : ''}
            </div>
          </div>
          <div class="pd-proj-meta">
            ${isCourse && lessonsCount > 0 ? `<span class="pd-lesson-pill" title="${ui('Lecciones importadas', 'Imported lessons')}">🎓 ${lessonsCount}</span>` : ''}
            <span class="pd-count-pill">${noteCount} ${ui('notas', 'notes')}</span>
            <button type="button" class="pd-proj-edit-btn" title="${ui('Editar proyecto', 'Edit project')}" onclick="event.stopPropagation(); closeProjectDropdown(); openProjectEditModal(${inlineArgument(p.campoSlug)}, ${inlineArgument(p.proySlug)});">✏️</button>
            ${isProjActive ? '<span class="pd-check">✓</span>' : ''}
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  });

  if (!anyMatch) {
    html += `
      <div class="pd-empty-state">
        <div class="pd-empty-icon">🎯</div>
        <div class="pd-empty-text">
          ${q
            ? ui(`No se encontraron proyectos para "${escapeHtml(q)}"`, `No projects found matching "${escapeHtml(q)}"`)
            : ui('Aún no has creado ningún proyecto o curso.', 'You have not created any projects or courses yet.')}
        </div>
        <button type="button" class="btn-primary-sm" style="margin-top:8px;" onclick="closeProjectDropdown(); openProjectManagerModal(true);">
          ➕ ${ui('Crear primer proyecto', 'Create first project')}
        </button>
      </div>
    `;
  }

  body.innerHTML = html;
}

function populateProjectScopeSelects() {
  const globalSelect = document.getElementById('global-project-select');
  const reviewSelect = document.getElementById('review-scope-select');
  const datalistCampos = document.getElementById('datalist-campos');
  const datalistProyectos = document.getElementById('datalist-proyectos');

  const camposSet = new Set();
  const proyectosSet = new Set();
  const projectsByCampo = {};

  (state.projects || []).forEach(p => {
    if (p.campo) camposSet.add(p.campo);
    if (p.proyecto) proyectosSet.add(p.proyecto);
    if (!projectsByCampo[p.campo]) projectsByCampo[p.campo] = [];
    projectsByCampo[p.campo].push(p);
  });

  let optionsHtml = `<option value="">${ui("🌐 Todos los Campos y Proyectos", "🌐 All Fields & Projects")}</option>`;
  const sortedCampos = Array.from(camposSet).sort((a, b) => a.localeCompare(b));

  sortedCampos.forEach(c => {
    optionsHtml += `<optgroup label="📂 ${escapeHtml(c)}">`;
    optionsHtml += `<option value="campo:${escapeHtml(c)}">${ui(`📂 Todo el campo: ${c}`, `📂 Entire field: ${c}`)}</option>`;
    const projs = projectsByCampo[c] || [];
    projs.forEach(p => {
      const stats = p.stats || {};
      const noteCount = stats.total || 0;
      const icon = getProjectTypeIcon(p.tipo);
      optionsHtml += `<option value="proyecto:${escapeHtml(p.campo)}|${escapeHtml(p.proyecto)}">${icon} ${escapeHtml(p.proyecto)} (${noteCount} ${ui("notas", "notes")})</option>`;
    });
    optionsHtml += `</optgroup>`;
  });

  const currentVal = getCurrentScopeValue();
  if (globalSelect) {
    globalSelect.innerHTML = optionsHtml;
    globalSelect.value = currentVal;
  }
  if (reviewSelect) {
    reviewSelect.innerHTML = optionsHtml;
    reviewSelect.value = currentVal;
  }

  if (datalistCampos) {
    datalistCampos.innerHTML = sortedCampos.map(c => `<option value="${escapeHtml(c)}">`).join('');
  }
  if (datalistProyectos) {
    datalistProyectos.innerHTML = Array.from(proyectosSet).sort().map(p => `<option value="${escapeHtml(p)}">`).join('');
  }

  updateProjectDropdownTrigger();
  renderProjectDropdownMenu();
  if (typeof populatePromptCustomizerSelect === 'function') populatePromptCustomizerSelect();
  renderHomeView();
}

function getCurrentScopeValue() {
  if (state.activeField && state.activeProject) {
    return `proyecto:${state.activeField}|${state.activeProject}`;
  } else if (state.activeField) {
    return `campo:${state.activeField}`;
  }
  return '';
}

function switchProjectScope(scopeValue) {
  if (!scopeValue) {
    state.activeField = null;
    state.activeProject = null;
    if (typeof promptCustomConfig === 'object') promptCustomConfig.selectedScope = '';
  } else if (scopeValue.startsWith('campo:')) {
    const rawCampo = scopeValue.replace(/^campo:/, '').trim();
    const matchedCampoProj = (state.projects || []).find(p => p.campo === rawCampo || slugifyClient(p.campo) === slugifyClient(rawCampo));
    state.activeField = matchedCampoProj ? matchedCampoProj.campo : rawCampo;
    state.activeProject = null;
    if (typeof promptCustomConfig === 'object') promptCustomConfig.selectedScope = '';
  } else if (scopeValue.startsWith('proyecto:')) {
    const raw = scopeValue.replace(/^proyecto:/, '').trim();
    const parts = raw.split('|');
    const rawC = (parts[0] || '').trim();
    const rawP = (parts[1] || '').trim();
    const matchedProj = (state.projects || []).find(p =>
      (p.proyecto === rawP || slugifyClient(p.proyecto) === slugifyClient(rawP)) &&
      (!rawC || p.campo === rawC || slugifyClient(p.campo) === slugifyClient(rawC))
    ) || (state.projects || []).find(p => p.proyecto === rawP || slugifyClient(p.proyecto) === slugifyClient(rawP));
    state.activeField = matchedProj ? matchedProj.campo : (rawC || null);
    state.activeProject = matchedProj ? matchedProj.proyecto : (rawP || null);
    if (typeof promptCustomConfig === 'object') promptCustomConfig.selectedScope = `${state.activeField || ''}|${state.activeProject || ''}`;
  }

  // Limpiar filtros de subcarpeta/hashtag/módulo/lección que pudieran ocultar las notas del nuevo proyecto seleccionado
  state.selectedAtomicaFolder = '';
  state.selectedFuenteFolder = '';
  state.selectedAtomicaTag = '';
  state.selectedFuenteTag = '';
  state.homeModuleFilter = '';
  state.homeLessonFilter = '';
  state.homeSearchQuery = '';
  state.selectedAtomicaModulo = '';
  state.selectedAtomicaLeccion = '';
  state.atomicaSearchQuery = '';
  state.selectedFuenteModulo = '';
  state.selectedFuenteLeccion = '';
  state.fuenteSearchQuery = '';
  state.selectedMapaModulo = '';
  state.selectedMapaLeccion = '';
  state.mapaSearchQuery = '';
  state.mapaTypeFilter = 'all';
  const afFilter = document.getElementById('atomica-folder-filter');
  if (afFilter) afFilter.value = '';
  const ffFilter = document.getElementById('fuente-folder-filter');
  if (ffFilter) ffFilter.value = '';
  const atFilter = document.getElementById('atomica-tag-filter');
  if (atFilter) atFilter.value = '';
  const ftFilter = document.getElementById('fuente-tag-filter');
  if (ftFilter) ftFilter.value = '';
  document.querySelectorAll('#mapa-type-pills-row .filter-chip-pill').forEach(p => {
    p.classList.toggle('active', p.getAttribute('data-map-type') === 'all');
  });

  const globalSelect = document.getElementById('global-project-select');
  const reviewSelect = document.getElementById('review-scope-select');
  const val = getCurrentScopeValue();
  if (globalSelect) globalSelect.value = val;
  if (reviewSelect) reviewSelect.value = val;

  updateProjectDropdownTrigger();
  renderProjectDropdownMenu();
  updateActiveScopeBanner();
  if (typeof populatePromptCustomizerSelect === 'function') populatePromptCustomizerSelect();
  updateStudioPromptText();
  renderAtomicasView();
  renderFuentesView();
  renderMapasView();
  renderHomeView();
  if (state.currentView === 'repaso') {
    loadReviewQueue();
  } else if (state.currentView === 'grafo') {
    if (typeof renderGraph === 'function') renderGraph();
  }
}

window.switchProjectScope = switchProjectScope;

function clearProjectScope() {
  switchProjectScope('');
}
window.clearProjectScope = clearProjectScope;

function updateActiveScopeBanner() {
  const banner = document.getElementById('active-scope-banner');
  const textEl = document.getElementById('scope-banner-text');
  if (!banner || !textEl) return;

  if (state.activeField || state.activeProject) {
    banner.style.display = 'flex';
    if (state.activeField && state.activeProject) {
      textEl.innerHTML = `<strong>${escapeHtml(state.activeField)}</strong> / <em>${escapeHtml(state.activeProject)}</em>`;
    } else if (state.activeField) {
      textEl.innerHTML = `<strong>${escapeHtml(state.activeField)}</strong> (<em>${ui('Todo el campo', 'Entire field')}</em>)`;
    } else {
      textEl.innerHTML = `<em>${escapeHtml(state.activeProject)}</em>`;
    }
  } else {
    banner.style.display = 'none';
  }
}

function openProjectManagerModal(focusNewInput = false) {
  renderProjectManagerList();
  openModal('modal-project-manager');
  if (focusNewInput) {
    const campoInput = document.getElementById('pm-new-campo');
    if (campoInput && state.activeField && !campoInput.value) {
      campoInput.value = state.activeField;
    }
    setTimeout(() => {
      const target = (campoInput && campoInput.value)
        ? document.getElementById('pm-new-proyecto')
        : campoInput;
      target?.focus();
    }, 100);
  }
}
window.openProjectManagerModal = openProjectManagerModal;

function getProjectTypeBadge(tipo) {
  const t = (tipo || 'curso').toLowerCase();
  switch (t) {
    case 'curso': return `<span class="badge-folder" style="color:var(--accent-primary); border-color:var(--accent-primary); font-size:11px;">🎓 ${ui('Curso', 'Course')}</span>`;
    case 'noticias': return `<span class="badge-folder" style="color:#f59e0b; border-color:#f59e0b; font-size:11px;">📰 ${ui('Noticias', 'News')}</span>`;
    case 'investigacion': return `<span class="badge-folder" style="color:#8b5cf6; border-color:#8b5cf6; font-size:11px;">🔬 ${ui('Investigación', 'Research')}</span>`;
    case 'libro': return `<span class="badge-folder" style="color:#10b981; border-color:#10b981; font-size:11px;">📖 ${ui('Libro', 'Book')}</span>`;
    case 'trabajo': return `<span class="badge-folder" style="color:#ec4899; border-color:#ec4899; font-size:11px;">💼 ${ui('Trabajo', 'Work')}</span>`;
    default: return `<span class="badge-folder" style="color:var(--text-secondary); font-size:11px;">📂 ${ui('General', 'General')}</span>`;
  }
}

function renderProjectManagerList() {
  const container = document.getElementById('pm-projects-list');
  if (!container) return;

  const list = state.projects || [];
  if (list.length === 0) {
    container.innerHTML = `<div class="text-muted" style="grid-column: 1 / -1; padding: 20px; text-align: center;">${ui('Aún no hay proyectos registrados. Crea uno arriba.', 'No projects registered yet. Create one above.')}</div>`;
    return;
  }

  container.innerHTML = list.map(p => {
    const isActive = (state.activeField === p.campo && state.activeProject === p.proyecto);
    const scopeVal = `proyecto:${p.campo}|${p.proyecto}`;
    const stats = p.stats || {};
    const isCompleted = p.estado === 'completado';
    const isCourse = (p.tipo === 'curso' || (!p.tipo && p.lecciones?.length));
    const lessonsCount = p.lecciones?.length || 0;

    return `
      <div class="pm-project-card ${isActive ? 'active-scope' : ''}">
        <div class="pm-card-header">
          <div>
            <div class="pm-card-campo">📁 ${escapeHtml(p.campo)}</div>
            <h4 class="pm-card-title">🎯 ${escapeHtml(p.proyecto)}</h4>
          </div>
          <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
            ${getProjectTypeBadge(p.tipo)}
            ${isActive ? `<span class="badge-project" style="font-size:10px;">${ui('ACTIVO', 'ACTIVE')}</span>` : ''}
            ${isCompleted ? `<span class="badge-folder" style="font-size:10px; color:var(--accent-success); border-color:var(--accent-success);">✓ ${ui('COMPLETADO', 'COMPLETED')}</span>` : ''}
          </div>
        </div>
        ${p.descripcion ? `<p class="pm-card-desc">${escapeHtml(p.descripcion)}</p>` : `<p class="pm-card-desc text-muted" style="font-style:italic;">${ui('(Sin descripción)', '(No description)')}</p>`}
        <div class="pm-card-stats">
          <span class="pm-stat-pill">⚛️ ${stats.atomicas || 0} ${ui('atómicas', 'atomic')}</span>
          <span class="pm-stat-pill">📚 ${stats.fuentes || 0} ${ui('fuentes', 'sources')}</span>
          <span class="pm-stat-pill">🗺️ ${stats.mapas || 0} ${ui('mapas', 'maps')}</span>
          <span class="pm-stat-pill" style="color:var(--accent-primary);">🧠 ${stats.repasosPendientes || 0} ${ui('repasos', 'reviews')}</span>
          ${isCourse ? `<span class="pm-stat-pill" style="color:#3b82f6;">🎓 ${lessonsCount} ${ui('lecciones', 'lessons')}</span>` : ''}
        </div>
        <div class="pm-card-actions" style="display:flex; gap:8px;">
          <button type="button" class="btn-focus-project" style="flex:1;" onclick="switchProjectScope(${inlineArgument(scopeVal)}); closeModal('modal-project-manager');">
            ${isActive ? ui('✓ Enfoque activo', '✓ Active focus') : ui('🎯 Enfocar proyecto', '🎯 Focus project')}
          </button>
          <button type="button" class="btn-ghost" style="padding:6px 12px; font-size:12px;" onclick="openProjectEditModal(${inlineArgument(p.campoSlug)}, ${inlineArgument(p.proySlug)})">
            ✏️ ${ui('Editar', 'Edit')}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

async function handleCreateProject() {
  if (isCreatingProjectLock) return;
  const campoEl = document.getElementById('pm-new-campo');
  const proyectoEl = document.getElementById('pm-new-proyecto');
  const tipoEl = document.getElementById('pm-new-tipo');
  const descEl = document.getElementById('pm-new-desc');
  const btn = document.getElementById('btn-pm-create');

  const campo = campoEl?.value.trim() || '';
  const proyecto = proyectoEl?.value.trim() || '';
  const tipo = tipoEl?.value.trim() || 'curso';
  const descripcion = descEl?.value.trim() || '';

  if (!campo || !proyecto) {
    showToast(ui("El campo y el nombre del proyecto son obligatorios", "Field and Project name are required"), 'warning');
    if (!campo) campoEl?.focus();
    else proyectoEl?.focus();
    return;
  }

  isCreatingProjectLock = true;
  const prevBtnText = btn ? btn.textContent : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = ui('Creando...', 'Creating...');
  }

  try {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campo, proyecto, descripcion, tipo })
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      if (campoEl) campoEl.value = '';
      if (proyectoEl) proyectoEl.value = '';
      if (descEl) descEl.value = '';
      showToast(ui(`✓ Proyecto "${proyecto}" creado exitosamente`, `✓ Project "${proyecto}" created successfully`), 'success');
      await loadAllData();
      renderProjectManagerList();
      populateProjectScopeSelects();
      switchProjectScope(`proyecto:${campo}|${proyecto}`);
    } else {
      showToast(data.error || ui("Error al crear el proyecto", "Could not create the project"), 'danger');
    }
  } catch (e) {
    console.error('Error creating project:', e);
    showToast(ui("Error de conexión con el servidor", "Server connection error"), 'danger');
  } finally {
    isCreatingProjectLock = false;
    if (btn) {
      btn.disabled = false;
      btn.textContent = prevBtnText || ui('Guardar Proyecto', 'Create Project');
    }
  }
}
window.handleCreateProject = handleCreateProject;

function openProjectEditModal(campoSlug, proySlug) {
  const p = (state.projects || []).find(x => x.campoSlug === campoSlug && x.proySlug === proySlug);
  if (!p) return;

  const oldCampoInput = document.getElementById('pm-edit-old-campo-slug');
  const oldProyInput = document.getElementById('pm-edit-old-proy-slug');
  const campoInput = document.getElementById('pm-edit-campo');
  const nombreInput = document.getElementById('pm-edit-nombre');
  const tipoSelect = document.getElementById('pm-edit-tipo');
  const estadoSelect = document.getElementById('pm-edit-estado');
  const descTextarea = document.getElementById('pm-edit-desc');

  if (oldCampoInput) oldCampoInput.value = campoSlug;
  if (oldProyInput) oldProyInput.value = proySlug;
  if (campoInput) campoInput.value = p.campo || '';
  if (nombreInput) nombreInput.value = p.proyecto || '';
  if (tipoSelect) tipoSelect.value = p.tipo || 'curso';
  if (estadoSelect) estadoSelect.value = p.estado || 'activo';
  if (descTextarea) descTextarea.value = p.descripcion || '';

  openModal('modal-project-edit');
}
window.openProjectEditModal = openProjectEditModal;

async function handleSaveProjectEdit() {
  const oldCampoSlug = document.getElementById('pm-edit-old-campo-slug')?.value;
  const oldProySlug = document.getElementById('pm-edit-old-proy-slug')?.value;
  const nuevoCampo = document.getElementById('pm-edit-campo')?.value.trim();
  const nuevoNombre = document.getElementById('pm-edit-nombre')?.value.trim();
  const tipo = document.getElementById('pm-edit-tipo')?.value.trim() || 'curso';
  const estado = document.getElementById('pm-edit-estado')?.value.trim() || 'activo';
  const descripcion = document.getElementById('pm-edit-desc')?.value.trim();

  if (!nuevoCampo || !nuevoNombre) {
    showToast(ui("El campo y el nombre son obligatorios", "Field and Project name are required"), 'warning');
    return;
  }

  try {
    const res = await fetch(`/api/projects/${encodeURIComponent(oldCampoSlug)}/${encodeURIComponent(oldProySlug)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nuevoCampo, nuevoNombre, tipo, estado, descripcion })
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      closeModal('modal-project-edit');
      showToast(ui("✓ Proyecto actualizado con éxito", "✓ Project updated successfully"), 'success');
      await loadAllData();
      renderProjectManagerList();
      populateProjectScopeSelects();
      if (state.activeProject) {
        switchProjectScope(`proyecto:${nuevoCampo}|${nuevoNombre}`);
      }
    } else {
      showToast(data.error || ui("Error al actualizar el proyecto", "Error updating project"), 'danger');
    }
  } catch (e) {
    showToast(ui("Error de conexión", "Connection error"), 'danger');
  }
}
window.handleSaveProjectEdit = handleSaveProjectEdit;

async function handleDeleteProject() {
  const oldCampoSlug = document.getElementById('pm-edit-old-campo-slug')?.value;
  const oldProySlug = document.getElementById('pm-edit-old-proy-slug')?.value;
  if (!oldCampoSlug || !oldProySlug) return;

  const confirmMsg = ui("¿Estás seguro de que deseas eliminar este proyecto de la lista? Sus notas se conservarán.", "Are you sure you want to remove this project? Its notes will remain intact.");
  if (!confirm(confirmMsg)) return;

  try {
    const res = await fetch(`/api/projects/${encodeURIComponent(oldCampoSlug)}/${encodeURIComponent(oldProySlug)}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      closeModal('modal-project-edit');
      showToast(ui("Proyecto eliminado del gestor", "Project removed from manager"), 'info');
      await loadAllData();
      renderProjectManagerList();
      populateProjectScopeSelects();
      clearProjectScope();
    } else {
      showToast(ui("Error al eliminar el proyecto", "Error deleting project"), 'danger');
    }
  } catch (e) {
    showToast(ui("Error de conexión", "Connection error"), 'danger');
  }
}
window.handleDeleteProject = handleDeleteProject;

function openQuickCreateProjectModal(targetNoteType = 'atomica') {
  const hidden = document.getElementById('quick-proj-target-note-type');
  if (hidden) hidden.value = targetNoteType;
  const currentCampo = document.getElementById(`${targetNoteType}-campo`)?.value.trim() || state.activeField || '';
  const campoInput = document.getElementById('quick-proj-campo');
  if (campoInput) campoInput.value = currentCampo;
  const nombreInput = document.getElementById('quick-proj-nombre');
  if (nombreInput) nombreInput.value = '';
  const descInput = document.getElementById('quick-proj-desc');
  if (descInput) descInput.value = '';
  openModal('modal-quick-project');
}
window.openQuickCreateProjectModal = openQuickCreateProjectModal;

async function handleQuickProjectSave() {
  const campo = document.getElementById('quick-proj-campo')?.value.trim();
  const proyecto = document.getElementById('quick-proj-nombre')?.value.trim();
  const tipo = document.getElementById('quick-proj-tipo')?.value.trim() || 'curso';
  const descripcion = document.getElementById('quick-proj-desc')?.value.trim();
  const targetNoteType = document.getElementById('quick-proj-target-note-type')?.value || 'atomica';

  if (!campo || !proyecto) {
    showToast(ui("El campo y el proyecto son obligatorios", "Field and Project name are required"), 'warning');
    return;
  }

  try {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campo, proyecto, descripcion, tipo })
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      closeModal('modal-quick-project');
      showToast(ui(`✓ Proyecto "${proyecto}" registrado`, `✓ Project "${proyecto}" registered`), 'success');
      await loadAllData();
      populateProjectScopeSelects();

      const cEl = document.getElementById(`${targetNoteType}-campo`);
      const pEl = document.getElementById(`${targetNoteType}-proyecto`);
      if (cEl) cEl.value = campo;
      if (pEl) pEl.value = proyecto;
    } else {
      showToast(data.error || ui("Error al crear proyecto", "Error creating project"), 'danger');
    }
  } catch (e) {
    showToast(ui("Error de conexión", "Connection error"), 'danger');
  }
}
window.handleQuickProjectSave = handleQuickProjectSave;

function updateBadges() {
  const pendingInbox = (state.notes.bandeja || []).filter(b => !b.data.procesada).length;
  const badgeInbox = document.getElementById('badge-inbox');
  const badgeAtomicas = document.getElementById('badge-atomicas');
  const badgeFuentes = document.getElementById('badge-fuentes');
  const badgeMapas = document.getElementById('badge-mapas');
  if (badgeInbox) badgeInbox.textContent = pendingInbox;
  if (badgeAtomicas) badgeAtomicas.textContent = (state.notes.atomica || []).length;
  if (badgeFuentes) badgeFuentes.textContent = (state.notes.fuente || []).length;
  if (badgeMapas) badgeMapas.textContent = (state.notes.mapa || []).length;
}

async function checkDueReviews() {
  try {
    const res = await apiFetch('/api/reviews/queue');
    const data = await res.json();
    const count = data.totalDue || 0;
    const badge = document.getElementById('badge-repaso');
    const headerCount = document.getElementById('header-due-count');
    const homeCountDue = document.getElementById('home-count-due');
    if (badge) badge.textContent = count;
    if (headerCount) headerCount.textContent = count;
    if (homeCountDue) homeCountDue.textContent = count;
  } catch (e) {
    console.error(e);
  }
}

function populateSelects() {
  const fuenteSelect = document.getElementById('atomica-fuente-select');
  if (fuenteSelect) {
    fuenteSelect.innerHTML = `<option value="">${ui('(Ninguna)', '(None)')}</option>`;
    (state.notes.fuente || []).forEach(f => {
      const opt = document.createElement('option');
      opt.value = f.id;
      opt.textContent = `${f.data.titulo || f.id} (${f.data.autor || ui("Sin autor", "Unknown author")})`;
      fuenteSelect.appendChild(opt);
    });
  }

  const mapaNotaSelect = document.getElementById('mapa-add-nota-select');
  if (mapaNotaSelect) {
    mapaNotaSelect.innerHTML = `<option value="">${ui('Selecciona nota atómica…', 'Select an atomic note…')}</option>`;
    (state.notes.atomica || []).forEach(a => {
      const opt = document.createElement('option');
      opt.value = a.id;
      opt.textContent = a.data.titulo || a.id;
      mapaNotaSelect.appendChild(opt);
    });
  }
}

function populateFolderSelects() {
  const atomicaFolders = state.folders.atomica || [];
  const fuenteFolders = state.folders.fuente || [];

  // Filtros de barra superior
  const afFilter = document.getElementById('atomica-folder-filter');
  if (afFilter) {
    const curr = afFilter.value;
    afFilter.innerHTML = `<option value="">${ui("📁 Todas las carpetas","All folders")}</option>` +
      atomicaFolders.map(f => `<option value="${escapeHtml(f)}">📁 ${escapeHtml(f)}</option>`).join('');
    afFilter.value = atomicaFolders.includes(curr) ? curr : '';
    state.selectedAtomicaFolder = afFilter.value;
  }

  const ffFilter = document.getElementById('fuente-folder-filter');
  if (ffFilter) {
    const curr = ffFilter.value;
    ffFilter.innerHTML = `<option value="">${ui("📁 Todas las carpetas","All folders")}</option>` +
      fuenteFolders.map(f => `<option value="${escapeHtml(f)}">📁 ${escapeHtml(f)}</option>`).join('');
    ffFilter.value = fuenteFolders.includes(curr) ? curr : '';
    state.selectedFuenteFolder = ffFilter.value;
  }

  // Selects en modales de edición
  const afSelect = document.getElementById('atomica-folder-select');
  if (afSelect) {
    const curr = afSelect.value;
    afSelect.innerHTML = `<option value="">${ui("(Raíz - sin subcarpeta)","(Root — no subfolder)")}</option>` +
      atomicaFolders.map(f => `<option value="${escapeHtml(f)}">📁 ${escapeHtml(f)}</option>`).join('');
    afSelect.value = curr;
  }

  const ffSelect = document.getElementById('fuente-folder-select');
  if (ffSelect) {
    const curr = ffSelect.value;
    ffSelect.innerHTML = `<option value="">${ui("(Raíz - sin subcarpeta)","(Root — no subfolder)")}</option>` +
      fuenteFolders.map(f => `<option value="${escapeHtml(f)}">📁 ${escapeHtml(f)}</option>`).join('');
    ffSelect.value = curr;
  }

  // Sincronizar sidebars verticales
  renderVerticalFoldersSidebar('atomica');
  renderVerticalFoldersSidebar('fuente');
}

function populateTagFilters() {
  const tagSet = new Set();
  (state.notes.atomica || []).forEach(a => {
    (a.data.tags || []).forEach(t => tagSet.add(t));
  });
  (state.notes.fuente || []).forEach(f => {
    (f.data.tags || []).forEach(t => tagSet.add(t));
  });

  const sortedTags = Array.from(tagSet).sort((a, b) => a.localeCompare(b));

  const atFilter = document.getElementById('atomica-tag-filter');
  if (atFilter) {
    const curr = atFilter.value;
    atFilter.innerHTML = `<option value="">${ui("🏷️ Todos los hashtags","All tags")}</option>` +
      sortedTags.map(t => `<option value="${escapeHtml(t)}">#${escapeHtml(t)}</option>`).join('');
    atFilter.value = tagSet.has(curr) ? curr : '';
    state.selectedAtomicaTag = atFilter.value;
  }

  const ftFilter = document.getElementById('fuente-tag-filter');
  if (ftFilter) {
    const curr = ftFilter.value;
    ftFilter.innerHTML = `<option value="">${ui("🏷️ Todos los hashtags","All tags")}</option>` +
      sortedTags.map(t => `<option value="${escapeHtml(t)}">#${escapeHtml(t)}</option>`).join('');
    ftFilter.value = tagSet.has(curr) ? curr : '';
    state.selectedFuenteTag = ftFilter.value;
  }

  const gtFilter = document.getElementById('graph-tag-filter');
  if (gtFilter) {
    const curr = gtFilter.value;
    gtFilter.innerHTML = `<option value="">${ui("🏷️ Todos los hashtags","All tags")}</option>` +
      sortedTags.map(t => `<option value="${escapeHtml(t)}">#${escapeHtml(t)}</option>`).join('');
    gtFilter.value = tagSet.has(curr) ? curr : '';
    state.selectedGraphTag = gtFilter.value;
  }
}

function initFolderAndTagControls() {
  document.getElementById('atomica-folder-filter')?.addEventListener('change', (e) => {
    state.selectedAtomicaFolder = e.target.value;
    renderAtomicasView();
  });
  document.getElementById('atomica-tag-filter')?.addEventListener('change', (e) => {
    state.selectedAtomicaTag = e.target.value;
    renderAtomicasView();
  });
  document.getElementById('fuente-folder-filter')?.addEventListener('change', (e) => {
    state.selectedFuenteFolder = e.target.value;
    renderFuentesView();
  });
  document.getElementById('fuente-tag-filter')?.addEventListener('change', (e) => {
    state.selectedFuenteTag = e.target.value;
    renderFuentesView();
  });

  document.getElementById('btn-submit-new-folder')?.addEventListener('click', async () => {
    const tipo = document.getElementById('new-folder-tipo').value;
    const nombre = document.getElementById('new-folder-name').value.trim();
    const parentFolder = document.getElementById('new-folder-parent')?.value || '';
    const color = document.getElementById('new-folder-selected-color')?.value || '#8b5cf6';
    if (!nombre) {
      showToast(ui("Por favor escribe un nombre para la carpeta", "Please enter a folder name"), 'warning');
      return;
    }
    try {
      const res = await apiFetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, nombre, parentFolder, color })
      });
      if (res.ok) {
        closeModal('modal-create-folder');
        showToast(ui(`📁 Carpeta "${nombre}" creada con éxito`, `📁 Folder "${nombre}" created successfully`), 'success');
        await loadAllData();
      } else {
        const err = await res.json();
        showToast(err.error || ui("Error al crear la carpeta", "Could not create the folder"), 'danger');
      }
    } catch (e) {
      showToast(ui("Error de conexión", "Connection error"), 'danger');
    }
  });
}

window.copyNoteLink = function(tipo, id) {
  const url = `${window.location.origin}/#${tipo}/${id}`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      showToast(ui(`📋 Enlace copiado al portapapeles`, `📋 Link copied to clipboard`), 'success');
    }).catch(() => {
      showToast(`ID: ${id}`, 'info');
    });
  } else {
    showToast(`ID: ${id}`, 'info');
  }
};

window.setFuenteTypeFilter = function(type) {
  state.fuenteTypeFilter = type;
  const pills = document.querySelectorAll('#fuente-type-pills-row .filter-chip-pill');
  pills.forEach(p => {
    if (p.getAttribute('data-type') === type) p.classList.add('active');
    else p.classList.remove('active');
  });
  renderFuentesView();
};

window.setAtomicaFilter = function(filter) {
  state.atomicaTypeFilter = filter;
  const pills = document.querySelectorAll('#atomica-type-pills-row .filter-chip-pill');
  pills.forEach(p => {
    if (p.getAttribute('data-filter') === filter) p.classList.add('active');
    else p.classList.remove('active');
  });
  renderAtomicasView();
};

window.setNotesLayoutMode = function(tipo, mode) {
  state[tipo + 'LayoutMode'] = mode;
  const btnGrid = document.getElementById(`btn-${tipo}-layout-grid`);
  const btnList = document.getElementById(`btn-${tipo}-layout-list`);
  if (btnGrid && btnList) {
    if (mode === 'grid') {
      btnGrid.classList.add('active');
      btnList.classList.remove('active');
    } else {
      btnList.classList.add('active');
      btnGrid.classList.remove('active');
    }
  }
  const listEl = document.getElementById(tipo === 'fuente' ? 'fuentes-list' : 'atomicas-list');
  if (listEl) {
    if (mode === 'list') {
      listEl.classList.add('source-cards-list-view');
    } else {
      listEl.classList.remove('source-cards-list-view');
    }
  }
};

window.selectFolderFilter = function(tipo, folderPath) {
  if (tipo === 'fuente') {
    state.selectedFuenteFolder = folderPath;
    if (!folderPath) {
      state.selectedFuenteModulo = '';
      state.selectedFuenteLeccion = '';
    }
    const selectEl = document.getElementById('fuente-folder-filter');
    if (selectEl) selectEl.value = folderPath;
    renderVerticalFoldersSidebar('fuente');
    renderFuentesView();
  } else {
    state.selectedAtomicaFolder = folderPath;
    if (!folderPath) {
      state.selectedAtomicaModulo = '';
      state.selectedAtomicaLeccion = '';
    }
    const selectEl = document.getElementById('atomica-folder-filter');
    if (selectEl) selectEl.value = folderPath;
    renderVerticalFoldersSidebar('atomica');
    renderAtomicasView();
  }
};

window.selectSidebarCurriculumFilter = function(tipo, moduloName, leccionName) {
  if (tipo === 'fuente') {
    state.selectedFuenteModulo = moduloName || '';
    state.selectedFuenteLeccion = leccionName || '';
    renderFuentesView();
  } else {
    state.selectedAtomicaModulo = moduloName || '';
    state.selectedAtomicaLeccion = leccionName || '';
    renderAtomicasView();
  }
};

window.filterFoldersTree = function(tipo) {
  const input = document.getElementById(`${tipo}-folder-search-input`);
  const q = (input ? input.value : '').toLowerCase().trim();
  const items = document.querySelectorAll(`#${tipo}-folders-tree-list .nvs-folder-item`);
  items.forEach(el => {
    const text = el.textContent.toLowerCase();
    el.style.display = (!q || text.includes(q)) ? 'flex' : 'none';
  });
};

const FOLDER_COLOR_PALETTE = [
  { hex: '#8b5cf6', name: 'Purple' },
  { hex: '#3b82f6', name: 'Blue' },
  { hex: '#10b981', name: 'Green' },
  { hex: '#f59e0b', name: 'Amber' },
  { hex: '#ec4899', name: 'Pink' },
  { hex: '#ef4444', name: 'Red' },
  { hex: '#06b6d4', name: 'Cyan' },
  { hex: '#f97316', name: 'Orange' },
  { hex: '#6366f1', name: 'Indigo' },
  { hex: '#64748b', name: 'Slate' }
];

function getFolderColor(tipo, folderPath, fallbackIndex = 0) {
  if (state.foldersMetadata && state.foldersMetadata[tipo] && state.foldersMetadata[tipo][folderPath] && state.foldersMetadata[tipo][folderPath].color) {
    return state.foldersMetadata[tipo][folderPath].color;
  }
  return FOLDER_COLOR_PALETTE[fallbackIndex % FOLDER_COLOR_PALETTE.length].hex;
}

function getFolderSvg(hexColor, size = 16) {
  return `<svg class="nvs-folder-svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${hexColor}" style="filter: drop-shadow(0 1px 2px ${hexColor}40); flex-shrink: 0;"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`;
}

window.renderVerticalFoldersSidebar = function(tipo) {
  const container = document.getElementById(`${tipo}-folders-tree-list`);
  if (!container) return;

  const rawNotes = (state.notes && state.notes[tipo]) || [];
  const notes = rawNotes.filter(noteMatchesActiveScope);
  const totalCount = notes.length;
  const selectedFolder = tipo === 'fuente' ? (state.selectedFuenteFolder || '') : (state.selectedAtomicaFolder || '');
  const selectedMod = tipo === 'fuente' ? (state.selectedFuenteModulo || '') : (state.selectedAtomicaModulo || '');
  const selectedLec = tipo === 'fuente' ? (state.selectedFuenteLeccion || '') : (state.selectedAtomicaLeccion || '');

  const folderCounts = {};
  notes.forEach(n => {
    const f = (n.data && n.data.carpeta) || n.carpeta || '';
    if (f) {
      folderCounts[f] = (folderCounts[f] || 0) + 1;
      const parts = f.split('/');
      if (parts.length > 1) {
        folderCounts[parts[0]] = (folderCounts[parts[0]] || 0) + 1;
      }
    }
  });

  const registeredFolders = (state.folders && state.folders[tipo]) || [];
  registeredFolders.forEach(f => {
    if (folderCounts[f] === undefined) folderCounts[f] = 0;
  });

  const allFolders = Object.keys(folderCounts).sort((a, b) => a.localeCompare(b));
  const rootFolders = [];
  const subfoldersByParent = {};

  allFolders.forEach(f => {
    const parts = f.split('/');
    if (parts.length === 1) {
      if (!rootFolders.includes(f)) rootFolders.push(f);
    } else {
      const parent = parts[0];
      if (!rootFolders.includes(parent)) rootFolders.push(parent);
      if (!subfoldersByParent[parent]) subfoldersByParent[parent] = [];
      subfoldersByParent[parent].push({ path: f, subName: parts.slice(1).join('/') });
    }
  });

  let html = `
    <div class="nvs-folder-item ${(!selectedFolder && !selectedMod && !selectedLec) ? 'active' : ''}" onclick="selectFolderFilter('${tipo}', '')">
      <div class="nvs-folder-left">
        ${getFolderSvg('#3b82f6', 16)}
        <span class="nvs-folder-name">${tipo === 'fuente' ? ui("Todas las Fuentes", "All Sources") : ui("Todas las Notas", "All Notes")}</span>
      </div>
      <span class="nvs-folder-badge">${totalCount}</span>
    </div>
  `;

  rootFolders.forEach((root, idx) => {
    const folderColor = getFolderColor(tipo, root, idx);
    const subs = subfoldersByParent[root] || [];
    const count = folderCounts[root] || 0;
    const isRootActive = selectedFolder === root;
    const hasSubs = subs.length > 0;
    const displayName = humanizeSlug(root);

    html += `
      <div class="nvs-folder-group">
        <div class="nvs-folder-item ${isRootActive ? 'active' : ''}" onclick="selectFolderFilter('${tipo}', '${escapeHtml(root)}')">
          <div class="nvs-folder-left">
            ${hasSubs ? `<span class="nvs-chevron">▾</span>` : ''}
            ${getFolderSvg(folderColor, 16)}
            <span class="nvs-folder-name" title="${escapeHtml(root)}">${escapeHtml(displayName)}</span>
          </div>
          <div class="nvs-folder-right">
            <span class="nvs-folder-badge">${count}</span>
            <div class="nvs-folder-actions-row" onclick="event.stopPropagation();">
              <button type="button" class="nvs-folder-btn-action" title="${ui('Nueva subcarpeta', 'New subfolder')}" onclick="openCreateSubfolder('${tipo}', '${escapeHtml(root)}')">+</button>
              <button type="button" class="nvs-folder-btn-action" title="${ui('Opciones de carpeta', 'Folder options')}" onclick="openFolderOptionsModal('${tipo}', '${escapeHtml(root)}')">⚙️</button>
            </div>
          </div>
        </div>
    `;

    if (hasSubs) {
      html += `<div class="nvs-subfolder-list">`;
      subs.forEach((s, subIdx) => {
        const subColor = getFolderColor(tipo, s.path, idx + subIdx + 1);
        const isSubActive = selectedFolder === s.path;
        const subCount = folderCounts[s.path] || 0;
        const subDisplayName = humanizeSlug(s.subName);
        html += `
          <div class="nvs-folder-item nvs-subfolder-item ${isSubActive ? 'active' : ''}" onclick="selectFolderFilter('${tipo}', '${escapeHtml(s.path)}')">
            <div class="nvs-folder-left">
              ${getFolderSvg(subColor, 15)}
              <span class="nvs-folder-name" title="${escapeHtml(s.path)}">${escapeHtml(subDisplayName)}</span>
            </div>
            <div class="nvs-folder-right">
              <span class="nvs-folder-badge">${subCount}</span>
              <div class="nvs-folder-actions-row" onclick="event.stopPropagation();">
                <button type="button" class="nvs-folder-btn-action" title="${ui('Opciones de carpeta', 'Folder options')}" onclick="openFolderOptionsModal('${tipo}', '${escapeHtml(s.path)}')">⚙️</button>
              </div>
            </div>
          </div>
        `;
      });
      html += `</div>`;
    }

    html += `</div>`;
  });

  // Árbol interactivo de Módulos y Temas en la barra lateral
  const projObj = findActiveProjectObj();
  const currTree = new Map(); // modKey -> { name, count, topics: Map<lecKey, { name, count }> }

  const ensureModEntry = (mName) => {
    const key = (mName || '__general__').toLowerCase();
    if (!currTree.has(key)) {
      currTree.set(key, {
        name: mName || ui('Sin módulo asignado', 'Unassigned module'),
        rawMod: mName || '',
        count: 0,
        topics: new Map()
      });
    }
    return currTree.get(key);
  };

  if (projObj && Array.isArray(projObj.lecciones)) {
    projObj.lecciones.forEach(l => {
      const mName = String(l.modulo || '').trim();
      const lName = String(l.titulo || '').trim();
      if (mName || lName) {
        const modEntry = ensureModEntry(mName);
        if (lName) {
          const lKey = lName.toLowerCase();
          if (!modEntry.topics.has(lKey)) {
            modEntry.topics.set(lKey, { name: lName, num: l.numero, count: 0 });
          }
        }
      }
    });
  }

  notes.forEach(n => {
    const meta = getNoteCurriculumMeta(n, projObj);
    if (meta.modulo || meta.leccion) {
      const modEntry = ensureModEntry(meta.modulo);
      modEntry.count += 1;
      if (meta.leccion) {
        const lKey = meta.leccion.toLowerCase();
        if (!modEntry.topics.has(lKey)) {
          modEntry.topics.set(lKey, { name: meta.leccion, num: meta.leccionNum, count: 0 });
        }
        modEntry.topics.get(lKey).count += 1;
      }
    }
  });

  if (currTree.size > 0) {
    html += `
      <div class="nvs-curriculum-section">
        <div class="nvs-curriculum-title">
          <span>📚 ${ui('Módulos y Temas', 'Modules & Topics')}</span>
          ${(selectedMod || selectedLec) ? `<button type="button" class="nvs-curriculum-clear-link" onclick="clearNotesViewFilters('${tipo}')">${ui('Limpiar', 'Clear')}</button>` : ''}
        </div>
    `;

    Array.from(currTree.values()).forEach(modEntry => {
      const isModSelected = Boolean(selectedMod && modEntry.rawMod && selectedMod.toLowerCase() === modEntry.rawMod.toLowerCase() && !selectedLec);
      const topicsList = Array.from(modEntry.topics.values());
      html += `
        <div class="nvs-folder-group">
          ${modEntry.rawMod ? `
            <div class="nvs-folder-item ${isModSelected ? 'active' : ''}" onclick="selectSidebarCurriculumFilter('${tipo}', ${inlineArgument(modEntry.rawMod)}, '')">
              <div class="nvs-folder-left">
                ${topicsList.length > 0 ? `<span class="nvs-chevron">▾</span>` : ''}
                <span class="nvs-folder-icon">📦</span>
                <span class="nvs-folder-name" title="${escapeHtml(modEntry.name)}">${escapeHtml(modEntry.name)}</span>
              </div>
              <span class="nvs-folder-badge">${modEntry.count}</span>
            </div>
          ` : ''}
          ${topicsList.length > 0 ? `
            <div class="${modEntry.rawMod ? 'nvs-subfolder-list' : ''}">
              ${topicsList.map(tObj => {
                const isTopicSelected = Boolean(selectedLec && selectedLec.toLowerCase() === tObj.name.toLowerCase());
                const labelText = tObj.num ? `${tObj.num}. ${tObj.name}` : tObj.name;
                return `
                  <div class="nvs-folder-item ${modEntry.rawMod ? 'nvs-subfolder-item' : ''} ${isTopicSelected ? 'active' : ''}" onclick="selectSidebarCurriculumFilter('${tipo}', ${inlineArgument(modEntry.rawMod || '')}, ${inlineArgument(tObj.name)})">
                    <div class="nvs-folder-left">
                      <span class="nvs-folder-icon">📖</span>
                      <span class="nvs-folder-name" title="${escapeHtml(labelText)}">${escapeHtml(labelText)}</span>
                    </div>
                    <span class="nvs-folder-badge">${tObj.count}</span>
                  </div>
                `;
              }).join('')}
            </div>
          ` : ''}
        </div>
      `;
    });

    html += `</div>`;
  }

  container.innerHTML = html;
};

window.openCreateFolderModal = function(tipo = 'atomica', parentFolder = '') {
  const tipoSelect = document.getElementById('new-folder-tipo');
  if (tipoSelect) tipoSelect.value = tipo;
  const nameInput = document.getElementById('new-folder-name');
  if (nameInput) nameInput.value = '';

  updateCreateFolderParentOptions(parentFolder);
  renderCreateFolderColorSwatches();
  openModal('modal-create-folder');
};

window.openCreateSubfolder = function(tipo, parentFolder) {
  openCreateFolderModal(tipo, parentFolder);
};

window.updateCreateFolderParentOptions = function(selectedParent = '') {
  const tipo = document.getElementById('new-folder-tipo')?.value || 'atomica';
  const parentSelect = document.getElementById('new-folder-parent');
  if (!parentSelect) return;
  const registered = (state.folders && state.folders[tipo]) || [];
  let html = `<option value="">${ui("Raíz (sin carpeta superior)", "Root (no parent folder)")}</option>`;
  registered.forEach(f => {
    html += `<option value="${escapeHtml(f)}" ${f === selectedParent ? 'selected' : ''}>📁 ${escapeHtml(f)}</option>`;
  });
  parentSelect.innerHTML = html;
};

window.renderCreateFolderColorSwatches = function() {
  const container = document.getElementById('new-folder-color-swatches');
  if (!container) return;
  const current = document.getElementById('new-folder-selected-color')?.value || '#8b5cf6';
  container.innerHTML = FOLDER_COLOR_PALETTE.map(c => `
    <button type="button" class="folder-color-swatch-btn ${c.hex === current ? 'active' : ''}" style="background-color: ${c.hex};" title="${c.name}" onclick="selectCreateFolderColor('${c.hex}', this)"></button>
  `).join('');
};

window.selectCreateFolderColor = function(hex, btn) {
  const hiddenInput = document.getElementById('new-folder-selected-color');
  if (hiddenInput) hiddenInput.value = hex;
  document.querySelectorAll('#new-folder-color-swatches .folder-color-swatch-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
};

// Modal de Opciones de Carpeta
window.openFolderOptionsModal = function(tipo, folderPath) {
  const modal = document.getElementById('modal-folder-options');
  if (!modal) return;

  document.getElementById('folder-options-tipo').value = tipo;
  document.getElementById('folder-options-path').value = folderPath;
  document.getElementById('folder-options-title').textContent = `${ui("Carpeta", "Folder")}: ${folderPath}`;
  document.getElementById('folder-rename-input').value = folderPath.split('/').pop();

  const currentColor = getFolderColor(tipo, folderPath, 0);
  document.getElementById('folder-options-icon-preview').innerHTML = getFolderSvg(currentColor, 22);

  const swatchesContainer = document.getElementById('folder-color-swatches');
  if (swatchesContainer) {
    swatchesContainer.innerHTML = FOLDER_COLOR_PALETTE.map(c => `
      <button type="button" class="folder-color-swatch-btn ${c.hex.toLowerCase() === currentColor.toLowerCase() ? 'active' : ''}" style="background-color: ${c.hex};" title="${c.name}" onclick="submitFolderColor('${c.hex}')"></button>
    `).join('');
  }

  const moveSelect = document.getElementById('folder-move-target-select');
  if (moveSelect) {
    const registered = (state.folders && state.folders[tipo]) || [];
    let html = `<option value="">${ui("Raíz (sin carpeta superior)", "Root (no parent folder)")}</option>`;
    registered.forEach(f => {
      if (f !== folderPath && !f.startsWith(folderPath + '/')) {
        html += `<option value="${escapeHtml(f)}">📁 ${escapeHtml(f)}</option>`;
      }
    });
    moveSelect.innerHTML = html;
  }

  openModal('modal-folder-options');
};

window.submitFolderColor = async function(colorHex) {
  const tipo = document.getElementById('folder-options-tipo').value;
  const folderPath = document.getElementById('folder-options-path').value;
  try {
    const res = await apiFetch('/api/folders/color', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, folderPath, color: colorHex })
    });
    if (res.ok) {
      if (!state.foldersMetadata) state.foldersMetadata = {};
      if (!state.foldersMetadata[tipo]) state.foldersMetadata[tipo] = {};
      if (!state.foldersMetadata[tipo][folderPath]) state.foldersMetadata[tipo][folderPath] = {};
      state.foldersMetadata[tipo][folderPath].color = colorHex;

      document.getElementById('folder-options-icon-preview').innerHTML = getFolderSvg(colorHex, 22);
      document.querySelectorAll('#folder-color-swatches .folder-color-swatch-btn').forEach(b => {
        b.classList.toggle('active', b.style.backgroundColor === colorHex || b.getAttribute('title') === colorHex);
      });
      renderVerticalFoldersSidebar(tipo);
      showToast(ui("Color de carpeta actualizado con éxito", "Folder color updated successfully"), 'success');
    }
  } catch (e) {
    showToast(ui("Error de conexión", "Connection error"), 'danger');
  }
};

window.submitFolderRename = async function() {
  const tipo = document.getElementById('folder-options-tipo').value;
  const oldPath = document.getElementById('folder-options-path').value;
  const newName = document.getElementById('folder-rename-input').value.trim();
  if (!newName) {
    showToast(ui("Por favor introduce un nombre", "Please enter a name"), 'warning');
    return;
  }
  try {
    const res = await apiFetch('/api/folders/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, oldPath, newName })
    });
    const data = await res.json();
    if (res.ok) {
      closeModal('modal-folder-options');
      showToast(ui("Carpeta renombrada con éxito", "Folder renamed successfully"), 'success');
      if (tipo === 'atomica' && state.selectedAtomicaFolder === oldPath) state.selectedAtomicaFolder = data.newPath;
      if (tipo === 'fuente' && state.selectedFuenteFolder === oldPath) state.selectedFuenteFolder = data.newPath;
      await loadAllData();
    } else {
      showToast(data.error || ui("Error al renombrar", "Could not rename folder"), 'danger');
    }
  } catch (e) {
    showToast(ui("Error de conexión", "Connection error"), 'danger');
  }
};

window.submitFolderMove = async function() {
  const tipo = document.getElementById('folder-options-tipo').value;
  const folderPath = document.getElementById('folder-options-path').value;
  const targetParent = document.getElementById('folder-move-target-select').value;
  try {
    const res = await apiFetch('/api/folders/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, folderPath, targetParent })
    });
    const data = await res.json();
    if (res.ok) {
      closeModal('modal-folder-options');
      showToast(ui("Carpeta movida con éxito", "Folder moved successfully"), 'success');
      if (tipo === 'atomica' && state.selectedAtomicaFolder === folderPath) state.selectedAtomicaFolder = data.newPath;
      if (tipo === 'fuente' && state.selectedFuenteFolder === folderPath) state.selectedFuenteFolder = data.newPath;
      await loadAllData();
    } else {
      showToast(data.error || ui("Error al mover", "Could not move folder"), 'danger');
    }
  } catch (e) {
    showToast(ui("Error de conexión", "Connection error"), 'danger');
  }
};

window.submitFolderDelete = async function() {
  const tipo = document.getElementById('folder-options-tipo').value;
  const folderPath = document.getElementById('folder-options-path').value;
  if (!confirm(ui("¿Seguro que deseas eliminar esta carpeta? Las notas se conservarán y se moverán a la raíz.", "Are you sure you want to delete this folder? Notes will be preserved and moved to root."))) {
    return;
  }
  try {
    const res = await apiFetch('/api/folders', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, folderPath, keepNotes: true })
    });
    if (res.ok) {
      closeModal('modal-folder-options');
      showToast(ui("Carpeta eliminada con éxito", "Folder deleted successfully"), 'success');
      if (tipo === 'atomica' && state.selectedAtomicaFolder === folderPath) state.selectedAtomicaFolder = '';
      if (tipo === 'fuente' && state.selectedFuenteFolder === folderPath) state.selectedFuenteFolder = '';
      await loadAllData();
    } else {
      const data = await res.json();
      showToast(data.error || ui("Error al eliminar", "Could not delete folder"), 'danger');
    }
  } catch (e) {
    showToast(ui("Error de conexión", "Connection error"), 'danger');
  }
};

window.filterByTag = function(tag) {
  if (state.currentView === 'fuentes') {
    const el = document.getElementById('fuente-tag-filter');
    if (el) el.value = tag;
    state.selectedFuenteTag = tag;
    renderFuentesView();
  } else if (state.currentView === 'grafo') {
    const el = document.getElementById('graph-tag-filter');
    if (el) el.value = tag;
    state.selectedGraphTag = tag;
    renderGraph();
  } else {
    switchView('atomicas');
    const el = document.getElementById('atomica-tag-filter');
    if (el) el.value = tag;
    state.selectedAtomicaTag = tag;
    renderAtomicasView();
  }
};

// -------------------------------------------------------------
// Preview-First: Modal de Lectura y Vista Previa Formateada
// -------------------------------------------------------------
function parseAtomicNotePillars(rawContent) {
  if (!rawContent) return { structured: false, raw: '' };
  let cleaned = String(rawContent)
    .replace(/^#\s+[^\n]+\n+/, '')
    .replace(/(?:\n---\s*)?\n###\s+(?:Pregunta de Autoevaluaci[oó]n|Self-Assessment Question)[\s\S]*$/i, '')
    .trim();

  const ideaMatch = cleaned.match(/##\s+(?:Idea\s*\(con mis palabras\)|Idea\s*\(in my own words\)|Idea)\s*\n([\s\S]*?)(?=##\s+(?:¿?Por qu[eé] importa|Why it matters|¿?C[oó]mo se conecta|How it connects)|$)/i);
  const porqueMatch = cleaned.match(/##\s+(?:¿?Por qu[eé] importa\??|Why it matters\??)\s*\n([\s\S]*?)(?=##\s+(?:¿?C[oó]mo se conecta|How it connects)|$)/i);
  const conectaMatch = cleaned.match(/##\s+(?:¿?C[oó]mo se conecta(?:\s+con lo que ya s[eé])?\??|How it connects(?:\s+with what I already know)?\??)\s*\n([\s\S]*?)$/i);

  if (ideaMatch || porqueMatch || conectaMatch) {
    return {
      structured: true,
      idea: ideaMatch ? ideaMatch[1].trim() : '',
      porque: porqueMatch ? porqueMatch[1].trim() : '',
      conecta: conectaMatch ? conectaMatch[1].trim() : ''
    };
  }
  return { structured: false, raw: cleaned };
}

function parseSourceNotePillars(rawContent) {
  if (!rawContent) return { structured: false, raw: '' };
  let cleaned = String(rawContent)
    .replace(/^#\s+[^\n]+\n+/, '')
    .trim();

  const puntosMatch = cleaned.match(/##\s+(?:Puntos clave\s*(?:\(parafraseados,?\s*no copiados\))?|Key points\s*(?:\(paraphrased,?\s*not copied\))?)\s*\n([\s\S]*?)(?=##\s+(?:Citas textuales|Relevant verbatim quotations|Quotations|Ideas propias|Ideas it sparks|My own ideas)|$)/i);
  const citasMatch = cleaned.match(/##\s+(?:Citas textuales(?: relevantes)?|Relevant verbatim quotations|Quotations)\s*\n([\s\S]*?)(?=##\s+(?:Ideas propias|Ideas it sparks|My own ideas)|$)/i);
  const ideasMatch = cleaned.match(/##\s+(?:Ideas propias(?: que dispara)?|Ideas it sparks|My own ideas)\s*\n([\s\S]*?)$/i);

  if (puntosMatch || citasMatch || ideasMatch) {
    return {
      structured: true,
      puntos: puntosMatch ? puntosMatch[1].trim() : '',
      citas: citasMatch ? citasMatch[1].trim() : '',
      ideas: ideasMatch ? ideasMatch[1].trim() : ''
    };
  }
  return { structured: false, raw: cleaned };
}

window.toggleAtomicReaderAnswer = function() {
  const ansBox = document.getElementById('atomic-split-answer-box');
  const btn = document.getElementById('btn-toggle-atomic-answer');
  if (!ansBox) return;
  const isHidden = ansBox.classList.toggle('is-collapsed');
  if (btn) {
    btn.innerHTML = isHidden
      ? `👁️ ${ui("Mostrar respuesta", "Show answer")}`
      : `🙈 ${ui("Ocultar respuesta", "Hide answer")}`;
  }
};

window.openReaderModal = async function(tipo, id) {
  try {
    state.activeReaderNote = { tipo, id };
    const res = await apiFetch(`/api/notes/${tipo}/${id}`);
    if (!res.ok) throw new Error(ui("Nota no encontrada", "Note not found"));
    const note = await res.json();

    const modalEl = document.getElementById('modal-reader');
    if (modalEl) {
      modalEl.classList.toggle('modal-reader-split-mode', tipo === 'atomica' || tipo === 'fuente');
    }

    const typeLabels = { atomica: t('navAtomicas'), fuente: t('navFuentes'), mapa: t('navMapas'), bandeja: t('navInbox') };
    const typeColors = { atomica: 'var(--accent-success)', fuente: 'var(--accent-info)', mapa: '#8b5cf6', bandeja: 'var(--text-muted)' };

    document.getElementById('reader-type-tag').textContent = typeLabels[tipo] || tipo;
    document.getElementById('reader-type-tag').style.color = typeColors[tipo] || 'var(--text-main)';

    const noteCampo = note.campo || (note.data && note.data.campo);
    const noteProyecto = note.proyecto || (note.data && note.data.proyecto);

    const folderEl = document.getElementById('reader-folder-badge');
    if (folderEl) {
      if (!noteProyecto && !noteCampo && note.data && note.data.carpeta) {
        folderEl.textContent = `📁 ${note.data.carpeta}`;
        folderEl.style.display = 'inline-flex';
      } else {
        folderEl.style.display = 'none';
      }
    }

    const projectEl = document.getElementById('reader-project-badge');
    if (projectEl) {
      if (noteProyecto) {
        projectEl.textContent = `🎯 ${noteProyecto}`;
        projectEl.title = noteCampo || '';
        projectEl.style.display = 'inline-flex';
      } else if (noteCampo) {
        projectEl.textContent = `📁 ${noteCampo}`;
        projectEl.title = '';
        projectEl.style.display = 'inline-flex';
      } else {
        projectEl.style.display = 'none';
      }
    }

    document.getElementById('reader-date').textContent = (note.data && note.data.creado) || '';
    document.getElementById('reader-title').textContent = (note.data && note.data.titulo) || id;

    const googleQuery = (note.data && (note.data.busqueda_google || note.data.titulo)) || note.titulo || id;
    const gBtn = document.getElementById('btn-reader-google');
    if (gBtn) {
      gBtn.href = `https://www.google.com/search?q=${encodeURIComponent(googleQuery)}`;
      gBtn.title = `${ui("Buscar en Google:", "Search on Google:")} ${googleQuery}`;
    }

    // Botón editar abre el modal de edición correspondiente
    const editBtn = document.getElementById('btn-reader-edit');
    if (editBtn) {
      editBtn.onclick = () => {
        closeModal('modal-reader');
        if (tipo === 'atomica') openAtomicaModal(id);
        else if (tipo === 'fuente') openFuenteModal(id);
        else if (tipo === 'mapa') openMapaModal(id);
      };
    }

    // Hashtags
    const tagsBar = document.getElementById('reader-tags-bar');
    const tags = note.data && Array.isArray(note.data.tags) ? note.data.tags : [];
    if (tags.length > 0) {
      tagsBar.innerHTML = tags.map(t => `<span class="badge-hashtag" onclick="filterByTag(${inlineArgument(t)})">#${escapeHtml(t)}</span>`).join(' ');
      tagsBar.style.display = 'flex';
    } else {
      tagsBar.innerHTML = '';
      tagsBar.style.display = 'none';
    }

    // Contenido Markdown / Estructura Conceptual
    const contentEl = document.getElementById('reader-content');
    const qaCard = document.getElementById('reader-qa-card');

    if (tipo === 'mapa') {
      const subtemas = note.subtemasDetalle || (note.data && note.data.subtemas) || [];
      const markdownBody = (note.content || '').trim();
      const isMaster = isMasterCourseMap(note);
      const currMeta = getNoteCurriculumMeta(note);
      const connectedFuente = note.connectedFuente || null;

      // Buscar otros mapas del mismo proyecto para enlazar desde el Mapa Maestro
      const siblingMaps = isMaster
        ? ((state.notes && state.notes.mapa) || []).filter(m =>
            m.id !== id &&
            !isMasterCourseMap(m) &&
            noteProyecto &&
            slugifyClient(m.proyecto || (m.data && m.data.proyecto) || '') === slugifyClient(noteProyecto)
          )
        : [];

      contentEl.innerHTML = `
        <div class="reader-map-container">
          <div class="reader-map-banner">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
              <div>
                <span class="reader-map-badge">${isMaster ? ui("🎓 Mapa Maestro del Curso", "🎓 Course Master Map") : ui("🗺️ Guía Temática y Mapa de Contenido", "🗺️ Topic Guide & Content Map")}</span>
                <div style="font-size:13px; opacity: 0.95; margin-top:4px;">
                  ${isMaster
                    ? ui("Índice global acumulativo que conecta todos los conceptos y temas del proyecto.", "Cumulative master index connecting all concepts and topics across the project.")
                    : ui("Índice estructurado que reúne conceptos clave y los articula en un temario coherente.", "Structured index gathering key concepts into a coherent topic outline.")}
                </div>
              </div>
              <a href="/api/export/study-guide/${encodeURIComponent(id)}?lang=${state.lang}" download class="btn-primary" style="font-size:12px; padding:6px 14px; text-decoration:none; display:inline-flex; align-items:center; gap:6px;">
                ${ui("📥 Descargar Guía de Estudio (.md)", "Download study guide (.md)")}
              </a>
            </div>
          </div>

          ${(currMeta.modulo || currMeta.leccionDisplay || connectedFuente) ? `
            <div class="reader-concept-toolbar" style="margin-bottom:12px;">
              <div class="reader-concept-toolbar-left" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                ${currMeta.modulo ? `<span class="mapa-curr-pill">📦 ${escapeHtml(currMeta.modulo)}</span>` : ''}
                ${currMeta.leccionDisplay ? `<span class="mapa-curr-pill">📖 ${escapeHtml(currMeta.leccionDisplay)}</span>` : ''}
                ${connectedFuente ? `
                  <button type="button" class="mapa-source-pill" onclick="openReaderModal('fuente', '${escapeHtml(connectedFuente.id)}')">
                    📄 ${ui("Fuente:", "Source:")} ${escapeHtml(connectedFuente.titulo || connectedFuente.id)} ↗
                  </button>
                ` : ''}
              </div>
            </div>
          ` : ''}

          ${markdownBody ? `<div class="reader-markdown-content" style="margin: 8px 0 14px 0;">${renderMarkdown(markdownBody)}</div>` : ''}

          ${siblingMaps.length > 0 ? `
            <div class="mapa-related-maps-bar" style="margin-bottom:16px;">
              <span class="mapa-related-maps-title">🗺️ ${ui("Mapas Temáticos de este Curso / Proyecto", "Topic Maps in this Course / Project")} (${siblingMaps.length})</span>
              <div class="mapa-related-maps-chips">
                ${siblingMaps.map(sm => `
                  <button type="button" class="mapa-related-chip" onclick="openReaderModal('mapa', '${escapeHtml(sm.id)}')">
                    🗺️ ${escapeHtml((sm.data && sm.data.titulo) || sm.id)} (${((sm.data && sm.data.subtemas) || []).length})
                  </button>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <div class="reader-map-subtemas-section">
            <h3 style="font-size:15px; margin-bottom:10px; display:flex; align-items:center; gap:8px;">
              <span>${ui("📚 Conceptos y Capítulos Incluidos", "Included Concepts & Chapters")}</span>
              <span class="count-badge" style="background:var(--accent-primary); color:white;">${subtemas.length}</span>
            </h3>
            <div class="reader-map-subtemas-grid">
              ${subtemas.map((s, idx) => {
                const subCurr = (s.modulo || s.leccion_titulo)
                  ? `${s.modulo ? s.modulo : ''}${s.modulo && s.leccion_titulo ? ' · ' : ''}${s.leccion_titulo || ''}`
                  : '';
                return `
                  <div class="reader-subtema-card">
                    <div class="reader-subtema-header">
                      <span class="subtema-index-badge">${idx + 1}</span>
                      <a href="#" class="wikilink-badge" onclick="event.preventDefault(); openReaderModal('atomica', '${escapeHtml(s.nota_id)}')">
                        ⚛️ ${escapeHtml(s.titulo || s.nota_id)}
                      </a>
                      ${subCurr ? `<span class="mapa-curr-pill" style="font-size:10.5px;">📖 ${escapeHtml(subCurr)}</span>` : (s.carpeta ? `<span class="badge-folder" style="font-size:11px;">📁 ${escapeHtml(s.carpeta)}</span>` : '')}
                      <a href="https://www.google.com/search?q=${encodeURIComponent(s.busqueda_google || s.titulo || s.nota_id)}" target="_blank" rel="noopener noreferrer" class="btn-google-pill" style="font-size:11px; margin-left:auto;" title="${ui("Buscar concepto en Google", "Search concept on Google")}">
                        🔍 Google
                      </a>
                    </div>
                    <div class="reader-subtema-reason">
                      <span class="reason-label">${ui("Relación con este tema:", "Connection to this topic:")}</span>
                      <span>${escapeHtml(s.razon || ui("Concepto integrante", "Included concept"))}</span>
                    </div>
                    ${s.idea ? `<div class="reader-subtema-idea"><strong>${ui("Idea clave:", "Key idea:")}</strong> ${escapeHtml(s.idea)}</div>` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      `;
      qaCard.style.display = 'none';
    } else if (tipo === 'fuente') {
      const typeIcons = { video: '🎬', libro: '📖', articulo: '📄', podcast: '🎙️', curso: '🎓', web: '🌐', otro: '📑' };
      const rawTipo = ((note.data && note.data.tipo_fuente) || 'otro').toLowerCase();
      const typeIcon = typeIcons[rawTipo] || '📑';
      const typeLabelsMap = {
        video: ui('Video', 'Video'),
        libro: ui('Libro', 'Book'),
        articulo: ui('Artículo', 'Article'),
        podcast: ui('Podcast', 'Podcast'),
        curso: ui('Curso', 'Course'),
        web: ui('Sitio Web', 'Website'),
        otro: ui('Fuente', 'Source')
      };
      const typeLabel = typeLabelsMap[rawTipo] || (note.data && note.data.tipo_fuente) || ui('Fuente', 'Source');
      const autor = (note.data && note.data.autor) || '';
      const url = (note.data && note.data.url) || '';
      const currMeta = getNoteCurriculumMeta(note);
      const connectedMapas = Array.isArray(note.connectedMapas) ? note.connectedMapas : [];

      // Resolver notas atómicas conectadas
      let connectedAtomicas = Array.isArray(note.connectedAtomicas) ? note.connectedAtomicas : [];
      if (connectedAtomicas.length === 0 && state.notes && state.notes.atomica) {
        const seenIds = new Set();
        const ideasList = Array.isArray(note.data && note.data.ideas_disparadas) ? note.data.ideas_disparadas : [];
        ideasList.forEach(aId => {
          if (aId && !seenIds.has(aId)) {
            seenIds.add(aId);
            const found = (state.notes.atomica || []).find(a => a.id === aId);
            let idea = '';
            if (found && found.content) {
              const m = found.content.match(/## (?:Idea \(con mis palabras\)|Idea \(in my own words\)|Idea)([\s\S]*?)(##|$)/i);
              idea = m ? m[1].trim() : found.content.substring(0, 160);
            }
            connectedAtomicas.push({
              id: aId,
              titulo: (found && found.data && found.data.titulo) || humanizeSlug(aId.replace(/^atomica-/, '')),
              busqueda_google: (found && found.data && found.data.busqueda_google) || '',
              idea: idea || (found && found.data && found.data.titulo) || ''
            });
          }
        });

        (state.notes.atomica || []).forEach(a => {
          const aFuente = (a.data && a.data.fuente) || a.fuente;
          if (aFuente === id && !seenIds.has(a.id)) {
            seenIds.add(a.id);
            let idea = '';
            if (a.content) {
              const m = a.content.match(/## (?:Idea \(con mis palabras\)|Idea \(in my own words\)|Idea)([\s\S]*?)(##|$)/i);
              idea = m ? m[1].trim() : a.content.substring(0, 160);
            }
            connectedAtomicas.push({
              id: a.id,
              titulo: (a.data && a.data.titulo) || humanizeSlug(a.id.replace(/^atomica-/, '')),
              busqueda_google: (a.data && a.data.busqueda_google) || '',
              idea: idea || (a.data && a.data.titulo) || ''
            });
          }
        });
      }

      const noteTitle = (note.data && note.data.titulo) || id;
      const noteDate = (note.data && note.data.creado) || '';
      const noteCarpeta = (note.data && note.data.carpeta) || note.carpeta || '';
      const totalSourceConns = connectedAtomicas.length + connectedMapas.length;
      const markdownBody = (note.content || '').trim();
      const sourcePillars = parseSourceNotePillars(markdownBody);

      contentEl.innerHTML = `
        <div class="atomic-split-workspace source-split-workspace">
          <!-- ============================================================
               PESTAÑA 1 (GRANDE / PRINCIPAL): SÍNTESIS Y LECTURA DE LA FUENTE
               ============================================================ -->
          <section class="atomic-split-main-window source-split-main-window" aria-label="${ui('Lectura de Nota Fuente', 'Source Note Reader')}">
            <header class="atomic-main-header">
              <div class="atomic-main-meta-left">
                <span class="atomic-pane-tab-badge source-pane-tab-badge">
                  <span class="atomic-pane-dot source-pane-dot"></span>
                  ${typeIcon} ${ui("NOTA FUENTE · SÍNTESIS DOCUMENTAL", "SOURCE NOTE · DOCUMENT SYNTHESIS")}
                </span>
                ${noteProyecto ? `<span class="badge-project">🎯 ${escapeHtml(noteProyecto)}</span>` : (noteCampo ? `<span class="badge-folder">📁 ${escapeHtml(noteCampo)}</span>` : '')}
                ${currMeta.modulo ? `<span class="mapa-curr-pill">📦 ${escapeHtml(currMeta.modulo)}</span>` : ''}
                ${currMeta.leccionDisplay ? `<span class="mapa-curr-pill">📖 ${escapeHtml(currMeta.leccionDisplay)}</span>` : ''}
                ${noteDate ? `<span class="card-date">${escapeHtml(noteDate)}</span>` : ''}
              </div>
              <div class="atomic-main-actions-right">
                ${url ? `
                  <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="btn-google-pill" title="${ui('Abrir enlace original', 'Open original source URL')}">
                    <span>🔗</span> <span>${ui("Enlace", "Source Link")}</span>
                  </a>
                ` : ''}
                <a href="https://www.google.com/search?q=${encodeURIComponent(googleQuery)}" target="_blank" rel="noopener noreferrer" class="btn-google-pill" title="${ui('Buscar en Google:', 'Search on Google:')} ${escapeHtml(googleQuery)}">
                  <span>🔍</span> <span>Google</span>
                </a>
                <button type="button" class="btn-primary" style="padding: 6px 13px; font-size: 12.5px;" onclick="closeModal('modal-reader'); openFuenteModal('${escapeHtml(id)}')">
                  ✏️ ${ui("Editar fuente", "Edit source")}
                </button>
                <button type="button" class="btn-close atomic-mobile-close" onclick="closeModal('modal-reader')" title="${ui('Cerrar', 'Close')}">✕</button>
              </div>
            </header>

            <div class="atomic-main-scroll-body">
              <div class="source-editorial-title-block">
                <h1 class="atomic-editorial-title" style="border-bottom: none; padding-bottom: 4px;">${escapeHtml(noteTitle)}</h1>
                <div class="source-editorial-byline">
                  <span class="source-byline-pill">${typeIcon} ${escapeHtml(typeLabel)}</span>
                  ${autor ? `<span class="source-byline-author">👤 <strong>${escapeHtml(autor)}</strong></span>` : ''}
                  <span class="source-byline-stat">⚛️ ${connectedAtomicas.length} ${connectedAtomicas.length === 1 ? ui("concepto destilado", "distilled concept") : ui("conceptos destilados", "distilled concepts")}</span>
                </div>
              </div>

              ${sourcePillars.structured ? `
                <div class="atomic-pillars-stack">
                  ${sourcePillars.puntos ? `
                    <article class="atomic-pillar-card pillar-source-points">
                      <div class="atomic-pillar-header">
                        <span class="atomic-pillar-icon">📌</span>
                        <span class="atomic-pillar-title">${ui("Puntos clave (parafraseados, no copiados)", "Key points (paraphrased, not copied)")}</span>
                        <span class="atomic-pillar-tag">${ui("Síntesis Principal", "Core Synthesis")}</span>
                      </div>
                      <div class="atomic-pillar-body atomic-editorial-prose">
                        ${renderMarkdown(sourcePillars.puntos)}
                      </div>
                    </article>
                  ` : ''}

                  ${sourcePillars.citas ? `
                    <article class="atomic-pillar-card pillar-source-quotes">
                      <div class="atomic-pillar-header">
                        <span class="atomic-pillar-icon">💬</span>
                        <span class="atomic-pillar-title">${ui("Citas textuales relevantes", "Relevant verbatim quotations")}</span>
                        <span class="atomic-pillar-tag">${ui("Evidencia Textual", "Verbatim Quotes")}</span>
                      </div>
                      <div class="atomic-pillar-body source-quotes-body">
                        ${renderMarkdown(sourcePillars.citas)}
                      </div>
                    </article>
                  ` : ''}

                  ${sourcePillars.ideas ? `
                    <article class="atomic-pillar-card pillar-source-sparks">
                      <div class="atomic-pillar-header">
                        <span class="atomic-pillar-icon">⚡</span>
                        <span class="atomic-pillar-title">${ui("Ideas propias que dispara", "Ideas it sparks")}</span>
                        <span class="atomic-pillar-tag">${ui("Semillas Conceptuales", "Concept Seeds")}</span>
                      </div>
                      <div class="atomic-pillar-body">
                        ${renderMarkdown(sourcePillars.ideas)}
                      </div>
                    </article>
                  ` : ''}
                </div>
              ` : `
                <article class="atomic-pillar-card pillar-source-points">
                  <div class="atomic-pillar-body atomic-editorial-prose">
                    ${renderMarkdown(markdownBody || ui("(Sin contenido adicional)", "(No additional content)"))}
                  </div>
                </article>
              `}
            </div>

            <footer class="atomic-main-footer">
              <span class="atomic-footer-id">🆔 <code>${escapeHtml(id)}</code></span>
              <button type="button" class="btn-ghost" onclick="closeModal('modal-reader')">${ui("Cerrar vista (Esc)", "Close view (Esc)")}</button>
            </footer>
          </section>

          <!-- ============================================================
               PESTAÑA 2 (COMPLEMENTARIA / LATERAL): DESTILACIÓN Y RED DE LA FUENTE
               ============================================================ -->
          <aside class="atomic-split-side-window source-split-side-window" aria-label="${ui('Destilación y Red de la Fuente', 'Source Distillation & Network')}">
            <header class="atomic-side-header">
              <div class="atomic-side-title-group">
                <span class="atomic-side-tab-badge source-side-tab-badge">
                  🧭 ${ui("DESTILACIÓN Y RED", "DISTILLATION & NETWORK")}
                </span>
                <span class="atomic-side-count-pill">
                  ${totalSourceConns} ${totalSourceConns === 1 ? ui("elemento", "item") : ui("elementos", "items")}
                </span>
              </div>
              <button type="button" class="btn-close" onclick="closeModal('modal-reader')" title="${ui('Cerrar (Esc)', 'Close (Esc)')}">✕</button>
            </header>

            <div class="atomic-side-scroll-body">
              <!-- BLOQUE 1: NOTAS ATÓMICAS DESTILADAS DE ESTA FUENTE -->
              <div class="atomic-inspector-block">
                <div class="atomic-inspector-block-header">
                  <span class="inspector-header-label">⚛️ ${ui("Notas Atómicas Destiladas", "Distilled Atomic Notes")}</span>
                  <span class="inspector-header-count">${connectedAtomicas.length}</span>
                </div>
                ${connectedAtomicas.length === 0 ? `
                  <div class="inspector-empty-box">
                    ${ui("No hay notas atómicas vinculadas directamente a esta fuente todavía.", "No atomic notes connected to this source yet.")}
                  </div>
                ` : `
                  <div class="inspector-cards-stack">
                    ${connectedAtomicas.map((a, idx) => `
                      <div class="inspector-card inspector-card-atomic">
                        <div class="inspector-card-top-row">
                          <span class="inspector-type-chip chip-atomic">
                            ⚛️ ${ui("Concepto", "Concept")} #${idx + 1}
                          </span>
                        </div>
                        <a href="#" class="inspector-card-title" onclick="event.preventDefault(); openReaderModal('atomica', '${escapeHtml(a.id)}')">
                          ${escapeHtml(a.titulo || a.id)}
                        </a>
                        ${a.idea ? `
                          <p class="inspector-atomic-idea-text">${escapeHtml(a.idea)}</p>
                        ` : ''}
                        <div class="inspector-card-actions">
                          <a href="https://www.google.com/search?q=${encodeURIComponent(a.busqueda_google || a.titulo || a.id)}" target="_blank" rel="noopener noreferrer" class="btn-google-pill" style="font-size:11px;">
                            🔍 Google
                          </a>
                          <button type="button" class="inspector-action-btn" onclick="openReaderModal('atomica', '${escapeHtml(a.id)}')">
                            ${ui("Abrir Nota →", "Open Note →")}
                          </button>
                        </div>
                      </div>
                    `).join('')}
                  </div>
                `}
              </div>

              <!-- BLOQUE 2: MAPAS DE CONTENIDO GENERADOS DESDE ESTA FUENTE -->
              <div class="atomic-inspector-block">
                <div class="atomic-inspector-block-header">
                  <span class="inspector-header-label">🗺️ ${ui("Mapas de Contenido", "Content Maps")}</span>
                  <span class="inspector-header-count">${connectedMapas.length}</span>
                </div>
                ${connectedMapas.length === 0 ? `
                  <div class="inspector-empty-box">
                    ${ui("Sin mapas de contenido asociados a esta fuente.", "No content maps linked to this source.")}
                  </div>
                ` : `
                  <div class="inspector-cards-stack">
                    ${connectedMapas.map(cm => {
                      const isMasterMap = (cm.id && cm.id.startsWith('mapa-curso-')) || cm.tipo_mapa === 'curso';
                      return `
                        <div class="inspector-card inspector-card-map">
                          <div class="inspector-card-top-row">
                            <span class="inspector-type-chip ${isMasterMap ? 'chip-master' : 'chip-topic'}">
                              ${isMasterMap ? ui("🎓 Mapa Maestro", "🎓 Master Map") : ui("🗺️ Mapa Temático", "🗺️ Topic Map")}
                            </span>
                            ${cm.total_subtemas ? `<span style="font-size:11px; color:var(--text-muted); font-weight:600;">${cm.total_subtemas} ${ui("conceptos", "concepts")}</span>` : ''}
                          </div>
                          <a href="#" class="inspector-card-title" onclick="event.preventDefault(); openReaderModal('mapa', '${escapeHtml(cm.id)}')">
                            ${escapeHtml(cm.titulo || cm.id)}
                          </a>
                          <div class="inspector-card-actions">
                            <a href="https://www.google.com/search?q=${encodeURIComponent(cm.titulo || cm.id)}" target="_blank" rel="noopener noreferrer" class="btn-google-pill" style="font-size:11px;">
                              🔍 Google
                            </a>
                            <button type="button" class="inspector-action-btn" onclick="openReaderModal('mapa', '${escapeHtml(cm.id)}')">
                              ${ui("Ver Mapa →", "View Map →")}
                            </button>
                          </div>
                        </div>
                      `;
                    }).join('')}
                  </div>
                `}
              </div>

              <!-- BLOQUE 3: FICHA BIBLIOGRÁFICA, CURRICULAR Y ETIQUETAS -->
              <div class="atomic-inspector-block">
                <div class="atomic-inspector-block-header">
                  <span class="inspector-header-label">🏷️ ${ui("Ficha Bibliográfica y Tags", "Source Dossier & Tags")}</span>
                  <span class="inspector-header-count">${tags.length}</span>
                </div>
                <div class="inspector-meta-dossier">
                  <div class="inspector-dossier-row">
                    <span class="dossier-key">${ui("Tipo:", "Type:")}</span>
                    <span class="dossier-val">${typeIcon} ${escapeHtml(typeLabel)}</span>
                  </div>
                  ${autor ? `
                    <div class="inspector-dossier-row">
                      <span class="dossier-key">${ui("Autor:", "Author:")}</span>
                      <span class="dossier-val">👤 ${escapeHtml(autor)}</span>
                    </div>
                  ` : ''}
                  ${noteProyecto ? `
                    <div class="inspector-dossier-row">
                      <span class="dossier-key">${ui("Proyecto:", "Project:")}</span>
                      <span class="dossier-val">🎯 ${escapeHtml(noteProyecto)}</span>
                    </div>
                  ` : ''}
                  ${currMeta.modulo ? `
                    <div class="inspector-dossier-row">
                      <span class="dossier-key">${ui("Módulo:", "Module:")}</span>
                      <span class="dossier-val">📦 ${escapeHtml(currMeta.modulo)}</span>
                    </div>
                  ` : ''}
                  ${currMeta.leccionDisplay ? `
                    <div class="inspector-dossier-row">
                      <span class="dossier-key">${ui("Tema:", "Topic:")}</span>
                      <span class="dossier-val">📖 ${escapeHtml(currMeta.leccionDisplay)}</span>
                    </div>
                  ` : ''}
                  ${noteCarpeta ? `
                    <div class="inspector-dossier-row">
                      <span class="dossier-key">${ui("Carpeta:", "Folder:")}</span>
                      <span class="dossier-val">📁 ${escapeHtml(noteCarpeta)}</span>
                    </div>
                  ` : ''}
                  ${url ? `
                    <div class="inspector-dossier-row">
                      <span class="dossier-key">URL:</span>
                      <span class="dossier-val"><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent-primary); text-decoration:underline;">${ui("Abrir enlace ↗", "Open link ↗")}</a></span>
                    </div>
                  ` : ''}
                  ${tags.length > 0 ? `
                    <div class="inspector-tags-cloud">
                      ${tags.map(t => `
                        <button type="button" class="badge-hashtag inspector-tag-pill" onclick="closeModal('modal-reader'); filterByTag(${inlineArgument(t)})">
                          #${escapeHtml(t)}
                        </button>
                      `).join('')}
                    </div>
                  ` : `
                    <div class="inspector-empty-box" style="margin-top:6px;">
                      ${ui("Sin etiquetas asignadas", "No tags assigned")}
                    </div>
                  `}
                </div>
              </div>
            </div>
          </aside>
        </div>
      `;
      qaCard.style.display = 'none';
    } else if (tipo === 'atomica') {
      const connectedFuente = note.connectedFuente;
      const connectedMapas = Array.isArray(note.connectedMapas) ? note.connectedMapas : [];
      let connectedAtomicas = Array.isArray(note.connectedAtomicas) ? note.connectedAtomicas : [];

      // Fallback si no vinieron en la respuesta, consultar state.notes.atomica
      if (connectedAtomicas.length === 0 && state.notes && state.notes.atomica) {
        const seen = new Set();
        const explicitLinks = Array.isArray(note.data && note.data.enlaces) ? note.data.enlaces : [];
        const wikilinks = ((note.content || '').match(/\[\[([a-zA-Z0-9_-]+)\]\]/g) || []).map(m => m.replace(/\[\[|\]\]/g, ''));
        [...explicitLinks, ...wikilinks].forEach(aId => {
          if (aId && aId !== id && !seen.has(aId)) {
            seen.add(aId);
            const foundA = (state.notes.atomica || []).find(a => a.id === aId);
            let idea = '';
            if (foundA && foundA.content) {
              const m = foundA.content.match(/## (?:Idea \(con mis palabras\)|Idea \(in my own words\)|Idea)([\s\S]*?)(##|$)/i);
              idea = m ? m[1].trim() : foundA.content.substring(0, 140);
            }
            connectedAtomicas.push({
              id: aId,
              titulo: (foundA && foundA.data && foundA.data.titulo) || humanizeSlug(aId.replace(/^atomica-/, '')),
              busqueda_google: (foundA && foundA.data && foundA.data.busqueda_google) || '',
              idea: idea || (foundA && foundA.data && foundA.data.titulo) || ''
            });
          }
        });
      }

      // Integrar backlinks entrantes de otras notas atómicas si no están ya en connectedAtomicas
      const seenAtomicIds = new Set(connectedAtomicas.map(a => a.id));
      const allConnectedAtomicas = [...connectedAtomicas];
      if (Array.isArray(note.backlinks)) {
        note.backlinks.forEach(b => {
          if (b.sourceType === 'atomica' && b.sourceId && b.sourceId !== id && !seenAtomicIds.has(b.sourceId)) {
            seenAtomicIds.add(b.sourceId);
            const foundB = (state.notes && state.notes.atomica || []).find(a => a.id === b.sourceId);
            let bIdea = '';
            if (foundB && foundB.content) {
              const m = foundB.content.match(/## (?:Idea \(con mis palabras\)|Idea \(in my own words\)|Idea)([\s\S]*?)(##|$)/i);
              bIdea = m ? m[1].trim() : foundB.content.substring(0, 140);
            }
            allConnectedAtomicas.push({
              id: b.sourceId,
              titulo: b.sourceTitle || (foundB && foundB.data && foundB.data.titulo) || humanizeSlug(b.sourceId.replace(/^atomica-/, '')),
              busqueda_google: (foundB && foundB.data && foundB.data.busqueda_google) || '',
              idea: bIdea,
              isBacklink: true
            });
          }
        });
      }

      const currMeta = getNoteCurriculumMeta(note);
      const noteTitle = (note.data && note.data.titulo) || id;
      const noteDate = (note.data && note.data.creado) || '';
      const noteCarpeta = (note.data && note.data.carpeta) || note.carpeta || '';
      const totalConns = (connectedFuente ? 1 : 0) + connectedMapas.length + allConnectedAtomicas.length;
      const markdownBody = (note.content || '').trim();
      const pillars = parseAtomicNotePillars(markdownBody);

      const hasQA = !!(note.pregunta && note.pregunta.pregunta);
      const qaStatsText = hasQA
        ? `${ui('Intervalo', 'Interval')}: ${note.pregunta.intervalo_dias || 1}d · Ease: ${note.pregunta.ease_factor || 2.5} · ${ui('Repasos', 'Reviews')}: ${(note.pregunta.historial || []).length}`
        : '';

      // Mantener sincronizados los nodos ocultos de QA por compatibilidad
      if (hasQA) {
        qaCard.style.display = 'none';
        document.getElementById('reader-q-text').innerHTML = renderMarkdown(note.pregunta.pregunta);
        document.getElementById('reader-a-text').innerHTML = renderMarkdown(note.pregunta.respuesta || ui("(Sin respuesta)", "(No answer)"));
        document.getElementById('reader-qa-stats').textContent = `${ui('Intervalo', 'Interval')}: ${note.pregunta.intervalo_dias || 1}d | Ease: ${note.pregunta.ease_factor || 2.5} | ${ui('Repasos', 'Reviews')}: ${(note.pregunta.historial || []).length}`;
      } else {
        qaCard.style.display = 'none';
      }

      contentEl.innerHTML = `
        <div class="atomic-split-workspace">
          <!-- ============================================================
               PESTAÑA 1 (GRANDE / PRINCIPAL): LECTURA PROFUNDA Y NÚCLEO COGNITIVO
               ============================================================ -->
          <section class="atomic-split-main-window" aria-label="${ui('Lectura de Nota Atómica', 'Atomic Note Reader')}">
            <header class="atomic-main-header">
              <div class="atomic-main-meta-left">
                <span class="atomic-pane-tab-badge">
                  <span class="atomic-pane-dot"></span>
                  ⚛️ ${ui("NOTA ATÓMICA · LECTURA PROFUNDA", "ATOMIC NOTE · DEEP READING")}
                </span>
                ${noteProyecto ? `<span class="badge-project">🎯 ${escapeHtml(noteProyecto)}</span>` : (noteCampo ? `<span class="badge-folder">📁 ${escapeHtml(noteCampo)}</span>` : '')}
                ${currMeta.modulo ? `<span class="mapa-curr-pill">📦 ${escapeHtml(currMeta.modulo)}</span>` : ''}
                ${currMeta.leccionDisplay ? `<span class="mapa-curr-pill">📖 ${escapeHtml(currMeta.leccionDisplay)}</span>` : ''}
                ${noteDate ? `<span class="card-date">${escapeHtml(noteDate)}</span>` : ''}
              </div>
              <div class="atomic-main-actions-right">
                <a href="https://www.google.com/search?q=${encodeURIComponent(googleQuery)}" target="_blank" rel="noopener noreferrer" class="btn-google-pill" title="${ui('Buscar en Google:', 'Search on Google:')} ${escapeHtml(googleQuery)}">
                  <span>🔍</span> <span>Google</span>
                </a>
                <button type="button" class="btn-primary" style="padding: 6px 13px; font-size: 12.5px;" onclick="closeModal('modal-reader'); openAtomicaModal('${escapeHtml(id)}')">
                  ✏️ ${ui("Editar nota", "Edit note")}
                </button>
                <button type="button" class="btn-close atomic-mobile-close" onclick="closeModal('modal-reader')" title="${ui('Cerrar', 'Close')}">✕</button>
              </div>
            </header>

            <div class="atomic-main-scroll-body">
              <h1 class="atomic-editorial-title">${escapeHtml(noteTitle)}</h1>

              ${pillars.structured ? `
                <div class="atomic-pillars-stack">
                  ${pillars.idea ? `
                    <article class="atomic-pillar-card pillar-idea">
                      <div class="atomic-pillar-header">
                        <span class="atomic-pillar-icon">💡</span>
                        <span class="atomic-pillar-title">${ui("Idea (con mis palabras)", "Idea (in my own words)")}</span>
                        <span class="atomic-pillar-tag">${ui("Núcleo Conceptual", "Core Concept")}</span>
                      </div>
                      <div class="atomic-pillar-body atomic-editorial-prose">
                        ${renderMarkdown(pillars.idea)}
                      </div>
                    </article>
                  ` : ''}

                  ${pillars.porque ? `
                    <article class="atomic-pillar-card pillar-why">
                      <div class="atomic-pillar-header">
                        <span class="atomic-pillar-icon">🎯</span>
                        <span class="atomic-pillar-title">${ui("¿Por qué importa?", "Why it matters")}</span>
                        <span class="atomic-pillar-tag">${ui("Relevancia e Impacto", "Relevance & Impact")}</span>
                      </div>
                      <div class="atomic-pillar-body">
                        ${renderMarkdown(pillars.porque)}
                      </div>
                    </article>
                  ` : ''}

                  ${pillars.conecta ? `
                    <article class="atomic-pillar-card pillar-connect">
                      <div class="atomic-pillar-header">
                        <span class="atomic-pillar-icon">🔗</span>
                        <span class="atomic-pillar-title">${ui("¿Cómo se conecta con lo que ya sé?", "How it connects with what I already know")}</span>
                        <span class="atomic-pillar-tag">${ui("Anclaje Asociativo", "Associative Synthesis")}</span>
                      </div>
                      <div class="atomic-pillar-body">
                        ${renderMarkdown(pillars.conecta)}
                      </div>
                    </article>
                  ` : ''}
                </div>
              ` : `
                <article class="atomic-pillar-card pillar-idea">
                  <div class="atomic-pillar-body atomic-editorial-prose">
                    ${renderMarkdown(markdownBody || ui("(Sin contenido adicional)", "(No additional content)"))}
                  </div>
                </article>
              `}

              ${hasQA ? `
                <section class="atomic-split-qa-card">
                  <div class="atomic-split-qa-header">
                    <div class="atomic-split-qa-title-wrap">
                      <span class="atomic-split-qa-icon">🧠</span>
                      <div>
                        <div class="atomic-split-qa-title">${ui("Autoevaluación · Recuperación Activa", "Self-Assessment · Active Retrieval")}</div>
                        <div class="atomic-split-qa-stats">${escapeHtml(qaStatsText)}</div>
                      </div>
                    </div>
                    <button type="button" id="btn-toggle-atomic-answer" class="btn-ghost atomic-qa-toggle-btn" onclick="toggleAtomicReaderAnswer()">
                      🙈 ${ui("Ocultar respuesta", "Hide answer")}
                    </button>
                  </div>
                  <div class="atomic-split-q-box">
                    <span class="atomic-split-qa-label q-label">${ui("PREGUNTA (P):", "QUESTION (Q):")}</span>
                    <div class="atomic-split-q-text">${renderMarkdown(note.pregunta.pregunta)}</div>
                  </div>
                  <div class="atomic-split-a-box" id="atomic-split-answer-box">
                    <span class="atomic-split-qa-label a-label">${ui("RESPUESTA CLAVE (R):", "KEY ANSWER (A):")}</span>
                    <div class="atomic-split-a-text">${renderMarkdown(note.pregunta.respuesta || ui("(Sin respuesta)", "(No answer)"))}</div>
                  </div>
                </section>
              ` : ''}
            </div>

            <footer class="atomic-main-footer">
              <span class="atomic-footer-id">🆔 <code>${escapeHtml(id)}</code></span>
              <button type="button" class="btn-ghost" onclick="closeModal('modal-reader')">${ui("Cerrar vista (Esc)", "Close view (Esc)")}</button>
            </footer>
          </section>

          <!-- ============================================================
               PESTAÑA 2 (COMPLEMENTARIA / LATERAL): ATLAS DE CONTEXTO Y RED
               ============================================================ -->
          <aside class="atomic-split-side-window" aria-label="${ui('Contexto y Red Conceptual', 'Context & Concept Network')}">
            <header class="atomic-side-header">
              <div class="atomic-side-title-group">
                <span class="atomic-side-tab-badge">
                  🧭 ${ui("ATLAS DE CONTEXTO Y RED", "CONTEXT & NETWORK ATLAS")}
                </span>
                <span class="atomic-side-count-pill" title="${ui('Conexiones totales en el grafo', 'Total connections in the graph')}">
                  ${totalConns} ${totalConns === 1 ? ui("conexión", "link") : ui("conexiones", "links")}
                </span>
              </div>
              <button type="button" class="btn-close" onclick="closeModal('modal-reader')" title="${ui('Cerrar (Esc)', 'Close (Esc)')}">✕</button>
            </header>

            <div class="atomic-side-scroll-body">
              <!-- BLOQUE 1: FUENTE DE ORIGEN -->
              <div class="atomic-inspector-block">
                <div class="atomic-inspector-block-header">
                  <span class="inspector-header-label">📖 ${ui("Fuente de Origen", "Source of Origin")}</span>
                  <span class="inspector-header-count">${connectedFuente ? '1' : '0'}</span>
                </div>
                ${connectedFuente ? `
                  <div class="inspector-card inspector-card-source">
                    <a href="#" class="inspector-card-title" onclick="event.preventDefault(); openReaderModal('fuente', '${escapeHtml(connectedFuente.id)}')">
                      ${escapeHtml(connectedFuente.titulo || connectedFuente.id)}
                    </a>
                    <div class="inspector-card-meta">
                      ${connectedFuente.autor ? `<span>👤 ${escapeHtml(connectedFuente.autor)}</span>` : `<span>${ui("Material de referencia", "Reference source")}</span>`}
                    </div>
                    <div class="inspector-card-actions">
                      <a href="https://www.google.com/search?q=${encodeURIComponent(connectedFuente.busqueda_google || connectedFuente.titulo || connectedFuente.id)}" target="_blank" rel="noopener noreferrer" class="btn-google-pill" style="font-size:11px;">
                        🔍 Google
                      </a>
                      <button type="button" class="inspector-action-btn" onclick="openReaderModal('fuente', '${escapeHtml(connectedFuente.id)}')">
                        ${ui("Abrir Fuente →", "Open Source →")}
                      </button>
                    </div>
                  </div>
                ` : `
                  <div class="inspector-empty-box">
                    ${ui("Sin nota fuente vinculada directamente.", "No source note directly linked.")}
                  </div>
                `}
              </div>

              <!-- BLOQUE 2: MAPAS DE CONTENIDO -->
              <div class="atomic-inspector-block">
                <div class="atomic-inspector-block-header">
                  <span class="inspector-header-label">🗺️ ${ui("Mapas de Contenido", "Content Maps")}</span>
                  <span class="inspector-header-count">${connectedMapas.length}</span>
                </div>
                ${connectedMapas.length === 0 ? `
                  <div class="inspector-empty-box">
                    ${ui("Aún no forma parte de ningún mapa temático.", "Not yet included in any content map.")}
                  </div>
                ` : `
                  <div class="inspector-cards-stack">
                    ${connectedMapas.map(m => {
                      const isMasterMap = (m.id && m.id.startsWith('mapa-curso-')) || m.tipo_mapa === 'curso';
                      return `
                        <div class="inspector-card inspector-card-map">
                          <div class="inspector-card-top-row">
                            <span class="inspector-type-chip ${isMasterMap ? 'chip-master' : 'chip-topic'}">
                              ${isMasterMap ? ui("🎓 Mapa Maestro", "🎓 Master Map") : ui("🗺️ Mapa Temático", "🗺️ Topic Map")}
                            </span>
                          </div>
                          <a href="#" class="inspector-card-title" onclick="event.preventDefault(); openReaderModal('mapa', '${escapeHtml(m.id)}')">
                            ${escapeHtml(m.titulo || m.id)}
                          </a>
                          ${m.razon ? `
                            <div class="inspector-map-reason-box">
                              <span class="inspector-reason-label">${ui("Rol en este mapa:", "Role in this map:")}</span>
                              <p class="inspector-reason-text">${escapeHtml(m.razon)}</p>
                            </div>
                          ` : ''}
                          <div class="inspector-card-actions">
                            <a href="https://www.google.com/search?q=${encodeURIComponent(m.busqueda_google || m.titulo || m.id)}" target="_blank" rel="noopener noreferrer" class="btn-google-pill" style="font-size:11px;">
                              🔍 Google
                            </a>
                            <button type="button" class="inspector-action-btn" onclick="openReaderModal('mapa', '${escapeHtml(m.id)}')">
                              ${ui("Ver Mapa →", "View Map →")}
                            </button>
                          </div>
                        </div>
                      `;
                    }).join('')}
                  </div>
                `}
              </div>

              <!-- BLOQUE 3: CONCEPTOS ATÓMICOS CONECTADOS -->
              <div class="atomic-inspector-block">
                <div class="atomic-inspector-block-header">
                  <span class="inspector-header-label">⚛️ ${ui("Conceptos Conectados", "Connected Concepts")}</span>
                  <span class="inspector-header-count">${allConnectedAtomicas.length}</span>
                </div>
                ${allConnectedAtomicas.length === 0 ? `
                  <div class="inspector-empty-box">
                    ${ui("Usa [[slug]] en el texto para enlazar con otros conceptos.", "Use [[slug]] in the text to link with other concepts.")}
                  </div>
                ` : `
                  <div class="inspector-cards-stack">
                    ${allConnectedAtomicas.map(a => `
                      <div class="inspector-card inspector-card-atomic">
                        <div class="inspector-card-top-row">
                          <span class="inspector-type-chip chip-atomic">
                            ${a.isBacklink ? `↩️ ${ui("Referencia entrante", "Incoming link")}` : `↔️ ${ui("Concepto enlazado", "Linked concept")}`}
                          </span>
                        </div>
                        <a href="#" class="inspector-card-title" onclick="event.preventDefault(); openReaderModal('atomica', '${escapeHtml(a.id)}')">
                          ${escapeHtml(a.titulo || a.id)}
                        </a>
                        ${a.idea ? `
                          <p class="inspector-atomic-idea-text">${escapeHtml(a.idea)}</p>
                        ` : ''}
                        <div class="inspector-card-actions">
                          <a href="https://www.google.com/search?q=${encodeURIComponent(a.busqueda_google || a.titulo || a.id)}" target="_blank" rel="noopener noreferrer" class="btn-google-pill" style="font-size:11px;">
                            🔍 Google
                          </a>
                          <button type="button" class="inspector-action-btn" onclick="openReaderModal('atomica', '${escapeHtml(a.id)}')">
                            ${ui("Abrir Nota →", "Open Note →")}
                          </button>
                        </div>
                      </div>
                    `).join('')}
                  </div>
                `}
              </div>

              <!-- BLOQUE 4: FICHA CURRICULAR Y ETIQUETAS (#HASHTAGS) -->
              <div class="atomic-inspector-block">
                <div class="atomic-inspector-block-header">
                  <span class="inspector-header-label">🏷️ ${ui("Ficha y Etiquetas", "Metadata & Tags")}</span>
                  <span class="inspector-header-count">${tags.length}</span>
                </div>
                <div class="inspector-meta-dossier">
                  ${noteProyecto ? `
                    <div class="inspector-dossier-row">
                      <span class="dossier-key">${ui("Proyecto:", "Project:")}</span>
                      <span class="dossier-val">🎯 ${escapeHtml(noteProyecto)}</span>
                    </div>
                  ` : ''}
                  ${currMeta.modulo ? `
                    <div class="inspector-dossier-row">
                      <span class="dossier-key">${ui("Módulo:", "Module:")}</span>
                      <span class="dossier-val">📦 ${escapeHtml(currMeta.modulo)}</span>
                    </div>
                  ` : ''}
                  ${currMeta.leccionDisplay ? `
                    <div class="inspector-dossier-row">
                      <span class="dossier-key">${ui("Tema:", "Topic:")}</span>
                      <span class="dossier-val">📖 ${escapeHtml(currMeta.leccionDisplay)}</span>
                    </div>
                  ` : ''}
                  ${noteCarpeta ? `
                    <div class="inspector-dossier-row">
                      <span class="dossier-key">${ui("Carpeta:", "Folder:")}</span>
                      <span class="dossier-val">📁 ${escapeHtml(noteCarpeta)}</span>
                    </div>
                  ` : ''}
                  ${tags.length > 0 ? `
                    <div class="inspector-tags-cloud">
                      ${tags.map(t => `
                        <button type="button" class="badge-hashtag inspector-tag-pill" onclick="closeModal('modal-reader'); filterByTag(${inlineArgument(t)})">
                          #${escapeHtml(t)}
                        </button>
                      `).join('')}
                    </div>
                  ` : `
                    <div class="inspector-empty-box" style="margin-top:6px;">
                      ${ui("Sin etiquetas asignadas", "No tags assigned")}
                    </div>
                  `}
                </div>
              </div>
            </div>
          </aside>
        </div>
      `;
    } else {
      contentEl.innerHTML = `<div class="reader-markdown-content">${renderMarkdown(note.content || ui("(Sin contenido adicional)", "(No additional content)"))}</div>`;

      // Tarjeta de Autoevaluación para notas con pregunta
      if (note.pregunta && note.pregunta.pregunta) {
        qaCard.style.display = 'block';
        document.getElementById('reader-q-text').innerHTML = renderMarkdown(note.pregunta.pregunta);
        document.getElementById('reader-a-text').innerHTML = renderMarkdown(note.pregunta.respuesta || ui("(Sin respuesta)", "(No answer)"));
        document.getElementById('reader-qa-stats').textContent = `${ui('Intervalo', 'Interval')}: ${note.pregunta.intervalo_dias || 1}d | Ease: ${note.pregunta.ease_factor || 2.5} | ${ui('Repasos', 'Reviews')}: ${(note.pregunta.historial || []).length}`;
      } else {
        qaCard.style.display = 'none';
      }
    }

    // Backlinks entrantes (solo para tipos sin sección integrada de conexiones)
    const backlinksBox = document.getElementById('reader-backlinks-box');
    const backlinksList = document.getElementById('reader-backlinks-list');
    if (tipo !== 'atomica' && tipo !== 'fuente' && tipo !== 'mapa' && note.backlinks && note.backlinks.length > 0) {
      backlinksBox.style.display = 'block';
      backlinksList.innerHTML = note.backlinks.map(b => `
        <a href="#" class="wikilink-badge" onclick="event.preventDefault(); openReaderModal('${b.sourceType}', '${b.sourceId}')">
          🔗 ${escapeHtml(b.sourceTitle || b.sourceId)}
        </a>
      `).join(' ');
    } else {
      backlinksBox.style.display = 'none';
    }

    openModal('modal-reader');
  } catch (e) {
    console.error(e);
    showToast(ui("Error cargando vista previa de la nota", "Could not load the note preview"), 'danger');
  }
};

// -------------------------------------------------------------
// 1. Bandeja de Entrada (Captura Rápida)
// -------------------------------------------------------------
function initQuickCapture() {
  const input = document.getElementById('quick-capture-input');
  const btn = document.getElementById('quick-capture-btn');

  async function handleCapture() {
    const text = input.value.trim();
    if (!text) return;

    try {
      const res = await apiFetch('/api/inbox/quick-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contenido: text })
      });
      if (res.ok) {
        input.value = '';
        showToast(ui("Idea capturada en Bandeja de Entrada con fricción cero ⚡", "Thought saved to your inbox"), 'success');
        await loadAllData();
      }
    } catch (e) {
      showToast(ui("Error al capturar idea", "Could not capture the thought"), 'danger');
    }
  }

  btn?.addEventListener('click', handleCapture);
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleCapture();
  });
}

function renderInboxView() {
  const container = document.getElementById('inbox-list');
  if (!container) return;

  let items = state.notes.bandeja || [];
  if (state.inboxFilter === 'pendientes') {
    items = items.filter(i => !i.data.procesada);
  } else if (state.inboxFilter === 'procesadas') {
    items = items.filter(i => i.data.procesada);
  }

  if (items.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-icon">📭</div>
        <h3>${ui("No hay notas en esta categoría", "No notes in this category")}</h3>
        <p>${ui("Usa la barra superior para capturar cualquier idea sin fricción.", "Use the capture bar above to save a thought.")}</p>
      </div>`;
    return;
  }

  container.innerHTML = items.map(item => `
    <div class="note-card" data-id="${item.id}">
      <div class="card-top">
        <span class="card-type-tag">${ui("Bandeja", "Inbox")}</span>
        <span class="card-date">${item.data.creado || ''}</span>
      </div>
      <h3>${escapeHtml(item.data.titulo || item.id)}</h3>
      <div class="card-snippet">${escapeHtml(getCardSnippet(item.content) || ui("(Sin contenido)", "(No content)"))}</div>
      <div class="card-footer">
        <span class="meta-pill ${item.data.procesada ? 'label-success' : ''}">
          ${item.data.procesada ? ui("✓ Procesada", "Processed") : ui("⏳ Pendiente", "Pending")}
        </span>
        ${!item.data.procesada ? `
          <button class="btn-process" onclick="openProcessModal('${item.id}')">
            ${ui("Procesar nota", "Process note")}
          </button>` : `
          <button class="btn-ghost" style="padding: 4px 8px; font-size: 11px;" onclick="openProcessModal('${item.id}')">
            ${ui("Ver detalle", "View details")}
          </button>`
        }
      </div>
    </div>
  `).join('');
}

// -------------------------------------------------------------
// Flujo "Procesar" Bandeja
// -------------------------------------------------------------
window.openProcessModal = function(id) {
  const item = (state.notes.bandeja || []).find(b => b.id === id);
  if (!item) return;
  state.activeInboxItem = item;

  document.getElementById('process-original-text').textContent = item.content || item.data.titulo;
  document.getElementById('proc-a-titulo').value = item.data.titulo || '';
  document.getElementById('proc-a-idea').value = '';
  document.getElementById('proc-a-porque').value = '';
  document.getElementById('proc-a-conecta').value = '';
  document.getElementById('proc-q-pregunta').value = '';
  document.getElementById('proc-q-respuesta').value = '';

  document.getElementById('proc-f-titulo').value = '';
  document.getElementById('proc-f-autor').value = '';
  document.getElementById('proc-f-puntos').value = '';

  const procCampo = document.getElementById('proc-campo');
  const procProyecto = document.getElementById('proc-proyecto');
  if (procCampo) procCampo.value = state.activeField || '';
  if (procProyecto) procProyecto.value = state.activeProject || '';

  const fuenteCheck = document.getElementById('proc-create-fuente');
  const fuenteFields = document.getElementById('proc-fuente-fields');
  fuenteCheck.checked = true;
  fuenteFields.style.display = 'flex';

  fuenteCheck.onchange = () => {
    fuenteFields.style.display = fuenteCheck.checked ? 'flex' : 'none';
  };

  openModal('modal-process-inbox');
};

document.getElementById('btn-submit-process')?.addEventListener('click', async () => {
  if (!state.activeInboxItem) return;

  const aTitulo = document.getElementById('proc-a-titulo').value.trim();
  const aIdea = document.getElementById('proc-a-idea').value.trim();
  const campo = document.getElementById('proc-campo')?.value.trim() || null;
  const proyecto = document.getElementById('proc-proyecto')?.value.trim() || null;

  if (!aTitulo) {
    showToast(ui("El título de la nota atómica es obligatorio", "An atomic note title is required"), 'warning');
    return;
  }
  if (!aIdea) {
    showToast(ui("Debes redactar la Idea con tus propias palabras (Efecto de generación)", "Write the idea in your own words (generation effect)"), 'warning');
    return;
  }

  const createFuente = document.getElementById('proc-create-fuente').checked;
  let fuenteData = null;
  if (createFuente) {
    const fTitulo = document.getElementById('proc-f-titulo').value.trim();
    if (fTitulo) {
      fuenteData = {
        titulo: fTitulo,
        autor: document.getElementById('proc-f-autor').value.trim(),
        tipo_fuente: document.getElementById('proc-f-tipo').value,
        puntosClave: document.getElementById('proc-f-puntos').value.trim(),
        campo,
        proyecto
      };
    }
  }

  const atomicasData = [{
    titulo: aTitulo,
    idea: aIdea,
    porQueImporta: document.getElementById('proc-a-porque').value.trim(),
    comoSeConecta: document.getElementById('proc-a-conecta').value.trim(),
    pregunta: document.getElementById('proc-q-pregunta').value.trim(),
    respuesta: document.getElementById('proc-q-respuesta').value.trim(),
    campo,
    proyecto
  }];

  try {
    const res = await apiFetch('/api/inbox/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inboxId: state.activeInboxItem.id,
        fuenteData,
        atomicasData,
        campo,
        proyecto
      })
    });

    if (res.ok) {
      closeModal('modal-process-inbox');
      showToast(ui("¡Nota procesada con éxito! Se ha generado tu nota atómica.", "Note processed. Your atomic note has been created."), 'success');
      await loadAllData();
      switchView('atomicas');
    } else {
      const err = await res.json();
      showToast(err.error || ui("Error al procesar la nota", "Could not process the note"), 'danger');
    }
  } catch (e) {
    showToast(ui("Error de red al procesar la nota", "Network error while processing the note"), 'danger');
  }
});

// -------------------------------------------------------------
// 2. Notas Atómicas
// -------------------------------------------------------------
window.handleNotesCurriculumFilter = function(type, filterField, value) {
  if (type === 'atomica') {
    if (filterField === 'modulo') {
      state.selectedAtomicaModulo = value || '';
      state.selectedAtomicaLeccion = '';
    } else if (filterField === 'leccion') {
      state.selectedAtomicaLeccion = value || '';
    } else if (filterField === 'search') {
      state.atomicaSearchQuery = value || '';
    }
    renderAtomicasView();
  } else if (type === 'fuente') {
    if (filterField === 'modulo') {
      state.selectedFuenteModulo = value || '';
      state.selectedFuenteLeccion = '';
    } else if (filterField === 'leccion') {
      state.selectedFuenteLeccion = value || '';
    } else if (filterField === 'search') {
      state.fuenteSearchQuery = value || '';
    }
    renderFuentesView();
  } else if (type === 'mapa') {
    if (filterField === 'modulo') {
      state.selectedMapaModulo = value || '';
      state.selectedMapaLeccion = '';
    } else if (filterField === 'leccion') {
      state.selectedMapaLeccion = value || '';
    } else if (filterField === 'search') {
      state.mapaSearchQuery = value || '';
    }
    renderMapasView();
  }
};

window.clearNotesViewFilters = function(type) {
  if (type === 'atomica') {
    state.selectedAtomicaModulo = '';
    state.selectedAtomicaLeccion = '';
    state.atomicaSearchQuery = '';
    state.selectedAtomicaFolder = '';
    state.selectedAtomicaTag = '';
    state.atomicaTypeFilter = 'all';
    const sInput = document.getElementById('atomica-search-input');
    if (sInput) sInput.value = '';
    const fSel = document.getElementById('atomica-folder-filter');
    if (fSel) fSel.value = '';
    const tSel = document.getElementById('atomica-tag-filter');
    if (tSel) tSel.value = '';
    document.querySelectorAll('#atomica-type-pills-row .filter-chip-pill').forEach(p => {
      p.classList.toggle('active', p.getAttribute('data-filter') === 'all');
    });
    renderAtomicasView();
  } else if (type === 'fuente') {
    state.selectedFuenteModulo = '';
    state.selectedFuenteLeccion = '';
    state.fuenteSearchQuery = '';
    state.selectedFuenteFolder = '';
    state.selectedFuenteTag = '';
    state.fuenteTypeFilter = 'all';
    const sInput = document.getElementById('fuente-search-input');
    if (sInput) sInput.value = '';
    const fSel = document.getElementById('fuente-folder-filter');
    if (fSel) fSel.value = '';
    const tSel = document.getElementById('fuente-tag-filter');
    if (tSel) tSel.value = '';
    document.querySelectorAll('#fuente-type-pills-row .filter-chip-pill').forEach(p => {
      p.classList.toggle('active', p.getAttribute('data-type') === 'all');
    });
    renderFuentesView();
  } else if (type === 'mapa') {
    state.selectedMapaModulo = '';
    state.selectedMapaLeccion = '';
    state.mapaSearchQuery = '';
    state.mapaTypeFilter = 'all';
    const sInput = document.getElementById('mapa-search-input');
    if (sInput) sInput.value = '';
    document.querySelectorAll('#mapa-type-pills-row .filter-chip-pill').forEach(p => {
      p.classList.toggle('active', p.getAttribute('data-map-type') === 'all');
    });
    renderMapasView();
  }
};

function populateAndApplyNotesCurriculumFilters(type, scopedNotes) {
  const projObj = findActiveProjectObj();
  const modWrap = document.getElementById(`${type}-modulo-filter-wrap`);
  const modSelect = document.getElementById(`${type}-modulo-filter`);
  const lecWrap = document.getElementById(`${type}-leccion-filter-wrap`);
  const lecSelect = document.getElementById(`${type}-leccion-filter`);
  const clearBtn = document.getElementById(`${type}-clear-filters-btn`);
  const searchInput = document.getElementById(`${type}-search-input`);

  const selectedMod = type === 'atomica'
    ? (state.selectedAtomicaModulo || '')
    : (type === 'fuente' ? (state.selectedFuenteModulo || '') : (state.selectedMapaModulo || ''));
  const selectedLec = type === 'atomica'
    ? (state.selectedAtomicaLeccion || '')
    : (type === 'fuente' ? (state.selectedFuenteLeccion || '') : (state.selectedMapaLeccion || ''));
  const searchQuery = (type === 'atomica'
    ? (state.atomicaSearchQuery || '')
    : (type === 'fuente' ? (state.fuenteSearchQuery || '') : (state.mapaSearchQuery || ''))).trim().toLowerCase();

  if (searchInput && document.activeElement !== searchInput) {
    const rawQ = type === 'atomica'
      ? (state.atomicaSearchQuery || '')
      : (type === 'fuente' ? (state.fuenteSearchQuery || '') : (state.mapaSearchQuery || ''));
    if (searchInput.value !== rawQ) searchInput.value = rawQ;
  }

  const modSet = new Map();
  const lecSet = new Map();
  let hasUnassignedMod = false;

  // Gather from active project syllabus if available, or all projects when in Global view
  const projectsToScan = projObj ? [projObj] : (state.projects || []).filter(p => !state.activeField || slugifyClient(p.campo) === slugifyClient(state.activeField));
  projectsToScan.forEach(p => {
    const syllabus = Array.isArray(p.lecciones) ? p.lecciones : [];
    syllabus.forEach(l => {
      const mName = String(l.modulo || '').trim();
      const lName = String(l.titulo || '').trim();
      if (mName) modSet.set(mName.toLowerCase(), mName);
      if (lName) {
        if (!selectedMod || (selectedMod === '__unassigned__' ? !mName : mName.toLowerCase() === selectedMod.toLowerCase())) {
          lecSet.set(lName.toLowerCase(), lName);
        }
      }
    });
  });

  // Also gather from notes themselves
  scopedNotes.forEach(n => {
    const meta = getNoteCurriculumMeta(n, projObj);
    if (meta.modulo) {
      modSet.set(meta.modulo.toLowerCase(), meta.modulo);
    } else {
      hasUnassignedMod = true;
    }
    if (meta.leccion) {
      if (!selectedMod || (selectedMod === '__unassigned__' ? !meta.modulo : (meta.modulo && meta.modulo.toLowerCase() === selectedMod.toLowerCase()))) {
        lecSet.set(meta.leccion.toLowerCase(), meta.leccion);
      }
    }
  });

  if (modWrap) modWrap.style.display = 'inline-block';
  if (modSelect) {
    modSelect.style.display = 'inline-block';
    const opts = [`<option value="">📦 ${ui("Todos los módulos", "All modules")}${modSet.size > 0 ? ` (${modSet.size})` : ''}</option>`];
    Array.from(modSet.values()).forEach(m => {
      const isSel = selectedMod && m.toLowerCase() === selectedMod.toLowerCase();
      opts.push(`<option value="${escapeHtml(m)}" ${isSel ? 'selected' : ''}>📦 ${escapeHtml(m)}</option>`);
    });
    if (hasUnassignedMod && modSet.size > 0) {
      opts.push(`<option value="__unassigned__" ${selectedMod === '__unassigned__' ? 'selected' : ''}>📭 ${ui("Sin módulo asignado", "Unassigned module")}</option>`);
    }
    modSelect.innerHTML = opts.join('');
  }

  if (lecWrap) lecWrap.style.display = 'inline-block';
  if (lecSelect) {
    lecSelect.style.display = 'inline-block';
    const opts = [`<option value="">📖 ${ui("Todos los temas", "All topics")}${lecSet.size > 0 ? ` (${lecSet.size})` : ''}</option>`];
    Array.from(lecSet.values()).forEach(l => {
      const isSel = selectedLec && l.toLowerCase() === selectedLec.toLowerCase();
      opts.push(`<option value="${escapeHtml(l)}" ${isSel ? 'selected' : ''}>📖 ${escapeHtml(l)}</option>`);
    });
    lecSelect.innerHTML = opts.join('');
  }

  const hasExtraFilter = type === 'atomica'
    ? Boolean(state.selectedAtomicaFolder || state.selectedAtomicaTag || (state.atomicaTypeFilter && state.atomicaTypeFilter !== 'all'))
    : (type === 'fuente'
      ? Boolean(state.selectedFuenteFolder || state.selectedFuenteTag || (state.fuenteTypeFilter && state.fuenteTypeFilter !== 'all'))
      : Boolean(state.mapaTypeFilter && state.mapaTypeFilter !== 'all'));

  if (clearBtn) {
    clearBtn.style.display = (selectedMod || selectedLec || searchQuery || hasExtraFilter) ? 'inline-flex' : 'none';
  }

  let filtered = scopedNotes;
  if (selectedMod) {
    filtered = filtered.filter(n => {
      if (type === 'mapa' && isMasterCourseMap(n)) {
        // El Mapa Maestro del Curso incluye conceptos de distintos módulos: comprobar si alguno pertenece al módulo filtrado
        const meta = getNoteCurriculumMeta(n, projObj);
        if (selectedMod === '__unassigned__') return !meta.modulo;
        if (meta.modulo && meta.modulo.toLowerCase() === selectedMod.toLowerCase()) return true;
        const subs = Array.isArray(n.data && n.data.subtemas) ? n.data.subtemas : [];
        const allAtomicas = (state.notes && state.notes.atomica) || [];
        return subs.some(s => {
          const foundA = allAtomicas.find(a => a.id === s.nota_id);
          if (!foundA) return false;
          const aMeta = getNoteCurriculumMeta(foundA, projObj);
          return aMeta.modulo && aMeta.modulo.toLowerCase() === selectedMod.toLowerCase();
        });
      }
      const meta = getNoteCurriculumMeta(n, projObj);
      if (selectedMod === '__unassigned__') return !meta.modulo;
      return meta.modulo && meta.modulo.toLowerCase() === selectedMod.toLowerCase();
    });
  }
  if (selectedLec) {
    filtered = filtered.filter(n => {
      if (type === 'mapa' && isMasterCourseMap(n)) {
        const meta = getNoteCurriculumMeta(n, projObj);
        if (meta.leccion && meta.leccion.toLowerCase() === selectedLec.toLowerCase()) return true;
        const subs = Array.isArray(n.data && n.data.subtemas) ? n.data.subtemas : [];
        const allAtomicas = (state.notes && state.notes.atomica) || [];
        return subs.some(s => {
          const foundA = allAtomicas.find(a => a.id === s.nota_id);
          if (!foundA) return false;
          const aMeta = getNoteCurriculumMeta(foundA, projObj);
          return aMeta.leccion && aMeta.leccion.toLowerCase() === selectedLec.toLowerCase();
        });
      }
      const meta = getNoteCurriculumMeta(n, projObj);
      return meta.leccion && meta.leccion.toLowerCase() === selectedLec.toLowerCase();
    });
  }
  if (searchQuery) {
    filtered = filtered.filter(n => {
      const meta = getNoteCurriculumMeta(n, projObj);
      const title = String((n.data && n.data.titulo) || n.id || '').toLowerCase();
      const body = String(n.content || '').toLowerCase();
      const mod = String(meta.modulo || '').toLowerCase();
      const lec = String(meta.leccionDisplay || meta.leccion || '').toLowerCase();
      const tags = Array.isArray(n.data && n.data.tags) ? n.data.tags.join(' ').toLowerCase() : '';
      const autor = String((n.data && n.data.autor) || '').toLowerCase();
      if (title.includes(searchQuery) || body.includes(searchQuery) || mod.includes(searchQuery) || lec.includes(searchQuery) || tags.includes(searchQuery) || autor.includes(searchQuery)) {
        return true;
      }
      if (type === 'mapa' && Array.isArray(n.data && n.data.subtemas)) {
        return n.data.subtemas.some(s =>
          String(s.nota_id || '').toLowerCase().includes(searchQuery) ||
          String(s.razon || '').toLowerCase().includes(searchQuery)
        );
      }
      return false;
    });
  }
  return filtered;
}

function renderAtomicasView() {
  const container = document.getElementById('atomicas-list');
  if (!container) return;

  const rawAtomicas = state.notes.atomica || [];
  
  // Count scoped before type filter
  let countScoped = rawAtomicas.filter(noteMatchesActiveScope);
  if (state.selectedAtomicaFolder) {
    countScoped = countScoped.filter(i => {
      const f = (i.data && i.data.carpeta) || i.carpeta || '';
      return f === state.selectedAtomicaFolder || f.startsWith(state.selectedAtomicaFolder + '/');
    });
  }

  countScoped = populateAndApplyNotesCurriculumFilters('atomica', countScoped);

  const elAll = document.getElementById('count-pill-atomicas-all');
  const elFlash = document.getElementById('count-pill-atomicas-flashcard');
  const elConn = document.getElementById('count-pill-atomicas-connected');
  if (elAll) elAll.textContent = countScoped.length;
  if (elFlash) elFlash.textContent = countScoped.filter(n => !!n.pregunta).length;
  if (elConn) elConn.textContent = countScoped.filter(n => {
    const hasBacklinks = n.backlinks && n.backlinks.length > 0;
    const hasFuente = !!((n.data && n.data.fuente) || n.fuente);
    const hasExplicit = Array.isArray(n.data && n.data.enlaces) && n.data.enlaces.length > 0;
    return hasBacklinks || hasFuente || hasExplicit;
  }).length;

  let items = countScoped;
  if (state.selectedAtomicaTag) {
    items = items.filter(i => i.data && Array.isArray(i.data.tags) && i.data.tags.includes(state.selectedAtomicaTag));
  }

  // Filter by atomic filter
  if (state.atomicaTypeFilter === 'flashcard') {
    items = items.filter(n => !!n.pregunta);
  } else if (state.atomicaTypeFilter === 'connected') {
    items = items.filter(n => {
      const hasBacklinks = n.backlinks && n.backlinks.length > 0;
      const hasFuente = !!((n.data && n.data.fuente) || n.fuente);
      const hasExplicit = Array.isArray(n.data && n.data.enlaces) && n.data.enlaces.length > 0;
      return hasBacklinks || hasFuente || hasExplicit;
    });
  }

  // Sorting
  const sortVal = document.getElementById('atomica-sort-select')?.value || 'newest';
  if (sortVal === 'oldest') {
    items.sort((a, b) => (a.data.creado || a.id).localeCompare(b.data.creado || b.id));
  } else if (sortVal === 'title') {
    items.sort((a, b) => (a.data.titulo || a.id).localeCompare(b.data.titulo || b.id));
  } else {
    items.sort((a, b) => (b.data.creado || b.id).localeCompare(a.data.creado || a.id));
  }

  renderVerticalFoldersSidebar('atomica');

  if (items.length === 0) {
    container.classList.remove('atomicas-stage-active');
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-icon">⚛️</div>
        <h3>${ui("No hay notas atómicas que coincidan", "No matching atomic notes")}</h3>
        <p>${ui("Prueba cambiando el filtro de carpeta, módulo, tema o proyecto, o crea una nueva nota atómica.", "Change the folder, module, topic, or project filter, or create an atomic note.")}</p>
      </div>`;
    return;
  }

  const allFuentes = state.notes.fuente || [];
  const allMapas = state.notes.mapa || [];
  const allAtomicas = state.notes.atomica || [];
  const atomicaMap = {};
  allAtomicas.forEach(a => { atomicaMap[a.id] = a; });
  const fuenteMap = {};
  allFuentes.forEach(f => { fuenteMap[f.id] = f; });

  const typeIcons = { video: '🎬', libro: '📖', articulo: '📄', podcast: '🎙️', curso: '🎓', web: '🌐', otro: '📑' };
  const activeProjObj = findActiveProjectObj();

  const itemsWithMeta = items.map(item => {
    let ideaText = '';
    const match = item.content.match(/## (?:Idea \(con mis palabras\)|Idea \(in my own words\)|Idea)([\s\S]*?)(##|$)/i);
    if (match) ideaText = match[1].trim();
    else ideaText = item.content || '';
    ideaText = ideaText.replace(/^#+\s+.*$/gm, '').replace(/^-+\s*/gm, '').trim();
    const snippetText = getCardSnippet(ideaText || ui("(Sin contenido)", "(No content)"), 150);

    const itemCampo = item.campo || (item.data && item.data.campo);
    const itemProyecto = item.proyecto || (item.data && item.data.proyecto);
    const itemCurrMeta = getNoteCurriculumMeta(item, activeProjObj);

    // Fuente conectada
    const fuenteId = (item.data && item.data.fuente) || item.fuente;
    let sourceConn = null;
    if (fuenteId) {
      const foundF = fuenteMap[fuenteId];
      const rawTipo = (foundF && foundF.data && foundF.data.tipo_fuente ? foundF.data.tipo_fuente : 'otro').toLowerCase();
      sourceConn = {
        id: fuenteId,
        titulo: (foundF && foundF.data && foundF.data.titulo) || humanizeSlug(fuenteId.replace(/^fuente-/, '')),
        icon: typeIcons[rawTipo] || '📖'
      };
    } else if (item.backlinks) {
      const fBl = item.backlinks.find(b => b.sourceType === 'fuente');
      if (fBl) {
        sourceConn = {
          id: fBl.sourceId,
          titulo: fBl.sourceTitle || humanizeSlug(fBl.sourceId.replace(/^fuente-/, '')),
          icon: '📖'
        };
      }
    }

    // Mapas donde aparece (priorizando Mapas Temáticos específicos en la vista previa)
    const mapConns = [];
    allMapas.forEach(m => {
      const subtemas = Array.isArray(m.data && m.data.subtemas) ? m.data.subtemas : [];
      if (subtemas.some(s => s && s.nota_id === item.id)) {
        mapConns.push({
          id: m.id,
          titulo: (m.data && m.data.titulo) || humanizeSlug(m.id.replace(/^mapa-/, '')),
          isMaster: isMasterCourseMap(m)
        });
      }
    });
    mapConns.sort((a, b) => (a.isMaster ? 1 : 0) - (b.isMaster ? 1 : 0));

    // Notas atómicas conectadas
    const connectedAtomicIds = new Set();
    const explicitLinks = Array.isArray(item.data && item.data.enlaces) ? item.data.enlaces : [];
    explicitLinks.forEach(e => { if (e && e !== item.id) connectedAtomicIds.add(e); });
    const wikilinks = (item.content.match(/\[\[([a-zA-Z0-9_-]+)\]\]/g) || []).map(m => m.replace(/\[\[|\]\]/g, ''));
    wikilinks.forEach(w => { if (w && w !== item.id) connectedAtomicIds.add(w); });
    if (item.backlinks) {
      item.backlinks.forEach(b => {
        if (b.sourceType === 'atomica' && b.sourceId && b.sourceId !== item.id) {
          connectedAtomicIds.add(b.sourceId);
        }
      });
    }

    const atomicConns = Array.from(connectedAtomicIds).map(aId => {
      const foundA = atomicaMap[aId];
      return {
        id: aId,
        titulo: (foundA && foundA.data && foundA.data.titulo) || humanizeSlug(aId.replace(/^atomica-/, ''))
      };
    });

    const totalConnections = mapConns.length + atomicConns.length;

    const previewItems = [];
    mapConns.slice(0, 1).forEach(m => previewItems.push({ type: 'map', ...m }));
    atomicConns.slice(0, 3 - previewItems.length).forEach(a => previewItems.push({ type: 'atomic', ...a }));

    // Topic pill
    let topicName = itemProyecto || itemCampo || (item.data.tags && item.data.tags[0]) || '';
    if (topicName.startsWith('atomica-') || topicName.startsWith('fuente-')) {
      topicName = humanizeSlug(topicName);
    }
    let topicColorClass = 'pill-topic-blue';
    const lowerTopic = topicName.toLowerCase();
    if (lowerTopic.includes('ai') || lowerTopic.includes('llm') || lowerTopic.includes('agent')) {
      topicColorClass = 'pill-topic-purple';
    } else if (lowerTopic.includes('product') || lowerTopic.includes('habit')) {
      topicColorClass = 'pill-topic-green';
    } else if (lowerTopic.includes('strat') || lowerTopic.includes('business')) {
      topicColorClass = 'pill-topic-yellow';
    } else if (lowerTopic.includes('person') || lowerTopic.includes('red')) {
      topicColorClass = 'pill-topic-pink';
    }

    // En la tarjeta de cuadrícula mostramos solo el nombre corto del Módulo (o Tema si no hay módulo) para no saturar
    const shortModuleLabel = itemCurrMeta.modulo || itemCurrMeta.leccion || '';
    const shortTopicName = topicName.length > 28 ? topicName.slice(0, 26) + '…' : topicName;
    const shortModPill = shortModuleLabel.length > 28 ? shortModuleLabel.slice(0, 26) + '…' : shortModuleLabel;
    const calmSnippet = getCardSnippet(ideaText || ui("(Sin contenido)", "(No content)"), 115);

    return {
      item,
      ideaText,
      snippetText: calmSnippet,
      itemCampo,
      itemProyecto,
      itemCurrMeta,
      sourceConn,
      mapConns,
      atomicConns,
      totalConnections,
      topicName,
      shortTopicName,
      topicColorClass,
      shortModuleLabel,
      shortModPill
    };
  });

  // Verificar si hay una nota atómica activa en modo Split-Stage
  const expandedEntry = state.activeExpandedAtomicaId
    ? itemsWithMeta.find(entry => entry.item.id === state.activeExpandedAtomicaId) || null
    : null;
  const viewAtomicasEl = document.getElementById('view-atomicas');
  if (viewAtomicasEl) {
    viewAtomicasEl.classList.toggle('has-expanded-stage', Boolean(expandedEntry));
    viewAtomicasEl.classList.toggle('show-folders-drawer', Boolean(state.showAtomicasFoldersDrawer && !expandedEntry));
  }
  const folderBtn = document.getElementById('btn-toggle-atomica-folders');
  if (folderBtn) {
    folderBtn.classList.toggle('active', Boolean(state.showAtomicasFoldersDrawer && !expandedEntry));
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MODO 1: CUADRÍCULA CALMADA Y RESPIRABLE (CERO SATURACIÓN VISUAL)
  // Muestra únicamente los 5 elementos clave con textos breves y limpios:
  // 1. Proyecto (corto), 2. Módulo (corto), 3. Título, 4. Source, 5. Resumen de 2 líneas
  // ══════════════════════════════════════════════════════════════════════════
  if (!expandedEntry) {
    container.classList.remove('atomicas-stage-active');
    container.innerHTML = itemsWithMeta.map(({ item, snippetText, itemProyecto, sourceConn, topicName, shortTopicName, topicColorClass, shortModuleLabel, shortModPill }) => `
      <div class="source-modern-card atomic-modern-card atomic-redbox-card" onclick="selectExpandedAtomica('${escapeHtml(item.id)}')" title="${ui('Haz clic para abrir esta nota atómica', 'Click to open this atomic note')}">
        <div class="smc-header-row atomic-clean-header">
          <div class="smc-badges-left">
            ${shortTopicName ? `<span class="smc-pill ${topicColorClass}" title="${escapeHtml(topicName)}">${escapeHtml(shortTopicName)}</span>` : ''}
            ${shortModPill ? `<span class="smc-pill pill-topic-green" title="${escapeHtml(shortModuleLabel)}">📦 ${escapeHtml(shortModPill)}</span>` : ''}
          </div>
        </div>

        <div class="smc-title-media-row">
          <div class="smc-title-col smc-title-fullwidth">
            <h3 class="smc-title-text" title="${escapeHtml(item.data.titulo || item.id)}">${escapeHtml(item.data.titulo || item.id)}</h3>
            ${sourceConn ? `
              <div class="smc-author-line atomic-calm-source-line">
                <span class="smc-author-avatar">${sourceConn.icon}</span>
                <span class="smc-author-name">${escapeHtml(sourceConn.titulo)}</span>
              </div>
            ` : (itemProyecto ? `
              <div class="smc-author-line atomic-calm-source-line">
                <span class="smc-author-avatar">🎯</span>
                <span class="smc-author-name">${escapeHtml(itemProyecto)}</span>
              </div>
            ` : '')}
          </div>
        </div>

        <div class="smc-snippet-text atomic-clean-snippet">
          ${escapeHtml(snippetText)}
        </div>
      </div>
    `).join('');
    return;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MODO 2: ESCENARIO EXPANDIDO CON REVELACIÓN PROGRESIVA (PROGRESSIVE DISCLOSURE)
  // - Riel Izquierdo Ultra-Limpio: Solo título + módulo sutil (sin repetir píldoras)
  // - Lienzo Derecho: Solo Idea Central + Por Qué Importa a la vista, y 3 pestañas
  //   plegables bajo demanda (Self-Test, Connections & Maps, Context & Tags)
  // ══════════════════════════════════════════════════════════════════════════
  container.classList.add('atomicas-stage-active');

  const railHtml = itemsWithMeta.map(({ item, shortModPill }) => {
    const isCurrent = item.id === expandedEntry.item.id;
    return `
      <div class="atomica-mini-rail-card ${isCurrent ? 'is-active-stage' : ''}" onclick="selectExpandedAtomica('${escapeHtml(item.id)}')" title="${isCurrent ? ui('Haz clic para cerrar y volver a la cuadrícula', 'Click to close and return to grid') : ui('Abrir esta nota atómica', 'Open this atomic note')}">
        <h4 class="atomica-mini-title">${escapeHtml(item.data.titulo || item.id)}</h4>
        ${shortModPill ? `<span class="atomica-mini-mod-sub">📦 ${escapeHtml(shortModPill)}</span>` : ''}
      </div>
    `;
  }).join('');

  const {
    item: activeNote,
    itemCampo,
    itemProyecto,
    itemCurrMeta,
    sourceConn,
    mapConns,
    atomicConns,
    totalConnections,
    topicName,
    shortTopicName,
    topicColorClass,
    shortModuleLabel,
    shortModPill
  } = expandedEntry;

  const pillars = typeof parseAtomicNotePillars === 'function'
    ? parseAtomicNotePillars(activeNote.content || '')
    : { idea: activeNote.content || '', porque: '', conecta: '', extra: '' };

  const noteTags = Array.isArray(activeNote.data?.tags) ? activeNote.data.tags : [];
  const folderName = (activeNote.data && activeNote.data.carpeta) || activeNote.carpeta || '';
  const hasFlashcard = Boolean(activeNote.pregunta && activeNote.pregunta.pregunta);
  const activeDrawerTab = state.activeExpandedAtomicaTab || null; // 'recall' | 'connections' | 'details' | null

  const currentIdx = itemsWithMeta.findIndex(e => e.item.id === activeNote.id);
  const prevItem = currentIdx > 0 ? itemsWithMeta[currentIdx - 1].item : null;
  const nextItem = (currentIdx >= 0 && currentIdx < itemsWithMeta.length - 1) ? itemsWithMeta[currentIdx + 1].item : null;

  container.innerHTML = `
    <div class="atomicas-split-stage-workspace">
      <!-- COLUMNA IZQUIERDA: ÍNDICE COMPACTO Y SILENCIOSO DE NOTAS -->
      <aside class="atomicas-compact-rail">
        <div class="mapas-rail-header">
          <span class="mapas-rail-title">⚛️ ${ui("Notas", "Notes")} (${itemsWithMeta.length})</span>
          <button type="button" class="btn-rail-collapse-all" onclick="selectExpandedAtomica(null)" title="${ui('Cerrar nota y volver a la cuadrícula original', 'Close note and return to original grid')}">
            ⊞ ${ui("Cuadrícula", "Grid View")}
          </button>
        </div>
        <div class="atomicas-rail-list" id="atomicas-rail-scroll-list">
          ${railHtml}
        </div>
      </aside>

      <!-- COLUMNA DERECHA: LECTURA SERENA Y REVELACIÓN PROGRESIVA -->
      <section class="atomica-expanded-spotlight atomica-calm-stage">
        <!-- 1. CABECERA LIMPIA CON NAVEGACIÓN SECUENCIAL DE ESTUDIO -->
        <header class="atomica-spotlight-header">
          <div class="atomica-spotlight-top-bar">
            <div class="smc-badges-left">
              ${shortTopicName ? `<span class="smc-pill ${topicColorClass}" title="${escapeHtml(topicName)}">${escapeHtml(shortTopicName)}</span>` : ''}
              ${shortModPill ? `<span class="smc-pill pill-topic-green" title="${escapeHtml(shortModuleLabel)}">📦 ${escapeHtml(shortModPill)}</span>` : ''}
            </div>

            <div class="mapa-spotlight-actions">
              <div class="study-seq-nav">
                <button type="button" class="btn-seq-step" ${prevItem ? `onclick="selectExpandedAtomica('${escapeHtml(prevItem.id)}')"` : 'disabled'} title="${prevItem ? escapeHtml(prevItem.data?.titulo || prevItem.id) : ui('Primera nota', 'First note')}">
                  ← ${ui("Anterior", "Prev")}
                </button>
                <span class="study-seq-counter">${currentIdx + 1} / ${itemsWithMeta.length}</span>
                <button type="button" class="btn-seq-step" ${nextItem ? `onclick="selectExpandedAtomica('${escapeHtml(nextItem.id)}')"` : 'disabled'} title="${nextItem ? escapeHtml(nextItem.data?.titulo || nextItem.id) : ui('Última nota', 'Last note')}">
                  ${ui("Siguiente", "Next")} →
                </button>
              </div>
              <button type="button" class="btn-ghost" style="padding: 6px 12px; font-size: 12px;" onclick="openAtomicaModal('${escapeHtml(activeNote.id)}')">
                ${ui("✏️ Editar", "✏️ Edit")}
              </button>
              <button type="button" class="btn-spotlight-close" onclick="selectExpandedAtomica(null)" title="${ui('Cerrar nota y volver a la cuadrícula', 'Close note and return to grid')}">
                ✕ ${ui("Cerrar", "Close")}
              </button>
            </div>
          </div>

          <h2 class="atomica-spotlight-title">${escapeHtml(activeNote.data.titulo || activeNote.id)}</h2>

          ${sourceConn ? `
            <div class="atomica-spotlight-source-bar">
              <button type="button" class="mapa-source-pill" onclick="openNoteInStudyStage('fuente', '${escapeHtml(sourceConn.id)}')" title="${ui('Abrir Nota Fuente de origen', 'Open origin Source Note')}">
                <span>${sourceConn.icon}</span>
                <span><strong>${ui("Fuente:", "Source:")}</strong> ${escapeHtml(sourceConn.titulo)} ↗</span>
              </button>
            </div>
          ` : ''}
        </header>

        <!-- 2. NÚCLEO DE LECTURA ESENCIAL (SIEMPRE VISIBLE, AMPLIO Y DESCANSADO) -->
        <div class="atomica-calm-core-reading">
          <article class="atomic-pillar-card pillar-idea">
            <div class="atomic-calm-section-label">💡 ${ui("Idea Central", "Core Idea")}</div>
            <div class="atomic-pillar-body reader-markdown-content">
              ${renderMarkdown(pillars.idea || activeNote.content || ui("(Sin desarrollo registrado)", "(No content recorded)"))}
            </div>
          </article>

          ${pillars.porque ? `
            <article class="atomic-pillar-card pillar-why">
              <div class="atomic-calm-section-label">🎯 ${ui("¿Por qué importa?", "Why It Matters")}</div>
              <div class="atomic-pillar-body reader-markdown-content">
                ${renderMarkdown(pillars.porque)}
              </div>
            </article>
          ` : ''}
        </div>

        <!-- 3. REVELACIÓN PROGRESIVA: PESTAÑAS BAJO DEMANDA PARA NO SATURAR LA PANTALLA -->
        <div class="atomica-progressive-dock">
          <div class="atomica-dock-tabs-bar">
            <span class="atomica-dock-hint">${ui("Explorar más detalles:", "Explore deeper:")}</span>
            ${hasFlashcard ? `
              <button type="button" class="atomica-dock-tab-btn ${activeDrawerTab === 'recall' ? 'active' : ''}" onclick="switchExpandedAtomicaTab('recall')">
                🧠 ${ui("Autoevaluación", "Self-Test Question")}
                <span class="dock-chevron">${activeDrawerTab === 'recall' ? '▴' : '▾'}</span>
              </button>
            ` : ''}
            <button type="button" class="atomica-dock-tab-btn ${activeDrawerTab === 'connections' ? 'active' : ''}" onclick="switchExpandedAtomicaTab('connections')">
              🔗 ${ui("Conexiones y Mapas", "Connections & Maps")} (${totalConnections})
              <span class="dock-chevron">${activeDrawerTab === 'connections' ? '▴' : '▾'}</span>
            </button>
            <button type="button" class="atomica-dock-tab-btn ${activeDrawerTab === 'details' ? 'active' : ''}" onclick="switchExpandedAtomicaTab('details')">
              🧭 ${ui("Ficha y Etiquetas", "Context & Tags")}
              <span class="dock-chevron">${activeDrawerTab === 'details' ? '▴' : '▾'}</span>
            </button>
          </div>

          <!-- CONTENIDO DEL CAJÓN DESPLEGADO (SOLO SE MUESTRA SI EL USUARIO ELIGE UNA PESTAÑA) -->
          ${activeDrawerTab === 'recall' && hasFlashcard ? `
            <div class="atomica-dock-panel">
              <article class="atomic-pillar-card pillar-recall" style="margin:0;">
                <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; margin-bottom:10px;">
                  <div class="atomic-calm-section-label" style="margin:0;">
                    🧠 ${ui("Pregunta de Recuperación Activa", "Active Recall Question")}
                    <span class="text-muted" style="font-weight:500; font-size:11.5px; margin-left:8px;">
                      (${ui("Intervalo", "Interval")}: ${activeNote.pregunta.intervalo_dias || 1}d · ${ui("Repasos", "Reviews")}: ${(activeNote.pregunta.historial || []).length})
                    </span>
                  </div>
                  <button type="button" class="btn-outline-pill" id="btn-inline-atomic-toggle-ans" onclick="toggleInlineAtomicStageAnswer()" style="font-size: 11.5px; padding: 5px 12px;">
                    👁️ ${ui("Mostrar Respuesta", "Show Answer")}
                  </button>
                </div>
                <div class="atomic-recall-q-box">
                  <span class="atomic-recall-badge q-badge">Q</span>
                  <div class="atomic-recall-text reader-markdown-content">${renderMarkdown(activeNote.pregunta.pregunta)}</div>
                </div>
                <div class="atomic-recall-a-box" id="inline-atomic-stage-answer" style="display: none;">
                  <span class="atomic-recall-badge a-badge">A</span>
                  <div class="atomic-recall-text reader-markdown-content">${renderMarkdown(activeNote.pregunta.respuesta || ui("(Sin respuesta)", "(No answer)"))}</div>
                </div>
              </article>
            </div>
          ` : ''}

          ${activeDrawerTab === 'connections' ? `
            <div class="atomica-dock-panel">
              <div class="atomica-connections-drawer-grid">
                ${pillars.conecta ? `
                  <article class="atomic-pillar-card pillar-connect" style="margin:0;">
                    <div class="atomic-calm-section-label">🔗 ${ui("¿Cómo se conecta con lo que ya sé?", "How It Connects With What I Know")}</div>
                    <div class="atomic-pillar-body reader-markdown-content">
                      ${renderMarkdown(pillars.conecta)}
                    </div>
                  </article>
                ` : ''}

                <div class="atomica-connections-lists-row">
                  <div class="atomic-inspector-card">
                    <div class="inspector-card-title">⚛️ ${ui("Notas Atómicas Conectadas", "Linked Atomic Notes")} (${atomicConns.length})</div>
                    ${atomicConns.length === 0 ? `
                      <p class="text-muted" style="font-size: 12px; margin: 0;">${ui("Sin notas atómicas enlazadas.", "No linked atomic notes.")}</p>
                    ` : `
                      <div class="inspector-conn-list">
                        ${atomicConns.map(ac => `
                          <div class="inspector-conn-pill atomic-conn-pill" onclick="selectExpandedAtomica('${escapeHtml(ac.id)}')" title="${ui('Ir a esta nota atómica', 'Switch to this atomic note')}">
                            <span class="icp-icon">⚛️</span>
                            <span class="icp-text">${escapeHtml(ac.titulo)}</span>
                            <span class="icp-arrow">→</span>
                          </div>
                        `).join('')}
                      </div>
                    `}
                  </div>

                  <div class="atomic-inspector-card">
                    <div class="inspector-card-title">🗺️ ${ui("Mapas de Contenido", "Content Maps")} (${mapConns.length})</div>
                    ${mapConns.length === 0 ? `
                      <p class="text-muted" style="font-size: 12px; margin: 0;">${ui("No incluida en mapas todavía.", "Not in any content map yet.")}</p>
                    ` : `
                      <div class="inspector-conn-list">
                        ${mapConns.map(mc => `
                          <div class="inspector-conn-pill map-conn-pill" onclick="openReaderModal('mapa', '${escapeHtml(mc.id)}')">
                            <span class="icp-icon">${mc.isMaster ? '🎓' : '🗺️'}</span>
                            <span class="icp-text">${escapeHtml(mc.titulo)}</span>
                            <span class="icp-arrow">↗</span>
                          </div>
                        `).join('')}
                      </div>
                    `}
                  </div>
                </div>
              </div>
            </div>
          ` : ''}

          ${activeDrawerTab === 'details' ? `
            <div class="atomica-dock-panel">
              <div class="atomic-inspector-card">
                <div class="inspector-card-title">🧭 ${ui("Ubicación Curricular y Metadatos", "Curriculum Location & Metadata")}</div>
                <div class="inspector-meta-list">
                  ${itemProyecto ? `<div class="inspector-meta-row"><span class="im-lbl">${ui("Proyecto", "Project")}</span><span class="im-val">🎯 ${escapeHtml(itemProyecto)}</span></div>` : ''}
                  ${itemCampo ? `<div class="inspector-meta-row"><span class="im-lbl">${ui("Campo", "Field")}</span><span class="im-val">🌐 ${escapeHtml(itemCampo)}</span></div>` : ''}
                  ${itemCurrMeta.modulo ? `<div class="inspector-meta-row"><span class="im-lbl">${ui("Módulo", "Module")}</span><span class="im-val">📦 ${escapeHtml(itemCurrMeta.modulo)}</span></div>` : ''}
                  ${itemCurrMeta.leccionDisplay ? `<div class="inspector-meta-row"><span class="im-lbl">${ui("Tema", "Topic")}</span><span class="im-val">📖 ${escapeHtml(itemCurrMeta.leccionDisplay)}</span></div>` : ''}
                  ${folderName ? `<div class="inspector-meta-row"><span class="im-lbl">${ui("Carpeta", "Folder")}</span><span class="im-val">📁 ${escapeHtml(folderName)}</span></div>` : ''}
                  ${activeNote.data?.creado ? `<div class="inspector-meta-row"><span class="im-lbl">${ui("Creado", "Created")}</span><span class="im-val">📅 ${escapeHtml(activeNote.data.creado)}</span></div>` : ''}
                </div>
                ${noteTags.length > 0 ? `
                  <div class="inspector-tags-wrap" style="margin-top: 12px; display:flex; gap:6px; flex-wrap:wrap;">
                    ${noteTags.map(t => `<span class="badge-hashtag" onclick="filterByTag('${escapeHtml(t)}')">#${escapeHtml(t)}</span>`).join('')}
                  </div>
                ` : ''}
              </div>
            </div>
          ` : ''}
        </div>
      </section>
    </div>
  `;
}

window.toggleAtomicasFoldersDrawer = function() {
  state.showAtomicasFoldersDrawer = !state.showAtomicasFoldersDrawer;
  renderAtomicasView();
};

window.switchExpandedAtomicaTab = function(tabName) {
  if (state.activeExpandedAtomicaTab === tabName) {
    state.activeExpandedAtomicaTab = null;
  } else {
    state.activeExpandedAtomicaTab = tabName;
  }
  renderAtomicasView();
};

window.selectExpandedAtomica = function(atomicaId) {
  if (!atomicaId || state.activeExpandedAtomicaId === atomicaId) {
    state.activeExpandedAtomicaId = null;
    state.activeExpandedAtomicaTab = null;
  } else {
    state.activeExpandedAtomicaId = atomicaId;
    state.activeExpandedAtomicaTab = null;
  }
  renderAtomicasView();
  if (state.activeExpandedAtomicaId) {
    setTimeout(() => {
      const activeRailEl = document.querySelector('#atomicas-rail-scroll-list .atomica-mini-rail-card.is-active-stage');
      if (activeRailEl && typeof activeRailEl.scrollIntoView === 'function') {
        activeRailEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }, 30);
  }
};

window.toggleInlineAtomicStageAnswer = function() {
  const ansBox = document.getElementById('inline-atomic-stage-answer');
  const btn = document.getElementById('btn-inline-atomic-toggle-ans');
  if (!ansBox) return;
  const isHidden = ansBox.style.display === 'none';
  ansBox.style.display = isHidden ? 'flex' : 'none';
  if (btn) {
    btn.innerHTML = isHidden
      ? `🙈 ${ui("Ocultar Respuesta", "Hide Answer")}`
      : `👁️ ${ui("Mostrar Respuesta", "Show Answer")}`;
  }
};

window.openNewAtomicaModal = function() {
  document.getElementById('modal-atomica-title').textContent = ui("Nueva Nota Atómica", "New atomic note");
  document.getElementById('atomica-edit-id').value = '';
  document.getElementById('atomica-titulo').value = '';
  const cEl = document.getElementById('atomica-campo');
  const pEl = document.getElementById('atomica-proyecto');
  if (cEl) cEl.value = state.activeField || '';
  if (pEl) pEl.value = state.activeProject || '';
  document.getElementById('atomica-folder-select').value = state.selectedAtomicaFolder || '';
  document.getElementById('atomica-tags-input').value = state.selectedAtomicaTag ? `#${state.selectedAtomicaTag}` : '';
  document.getElementById('atomica-fuente-select').value = '';
  document.getElementById('atomica-idea').value = '';
  document.getElementById('atomica-porque').value = '';
  document.getElementById('atomica-conecta').value = '';
  document.getElementById('atomica-q-p').value = '';
  document.getElementById('atomica-q-r').value = '';
  document.getElementById('atomica-q-stats').innerHTML = '';
  document.getElementById('atomica-backlinks-list').innerHTML = `<span class="text-muted">${ui("Guarda la nota para calcular backlinks.", "Save the note to see incoming links.")}</span>`;
  document.getElementById('btn-delete-atomica').style.display = 'none';

  // Activar pestaña editor por defecto
  setAtomicaTab('edit');
  openModal('modal-atomica');
};

window.openAtomicaModal = async function(id) {
  try {
    const res = await apiFetch(`/api/notes/atomica/${id}`);
    const note = await res.json();

    document.getElementById('modal-atomica-title').textContent = `${ui("Editar", "Edit")}: ${note.data.titulo || id}`;
    document.getElementById('atomica-edit-id').value = id;
    document.getElementById('atomica-titulo').value = note.data.titulo || '';
    const cEl = document.getElementById('atomica-campo');
    const pEl = document.getElementById('atomica-proyecto');
    if (cEl) cEl.value = note.campo || (note.data && note.data.campo) || '';
    if (pEl) pEl.value = note.proyecto || (note.data && note.data.proyecto) || '';
    document.getElementById('atomica-folder-select').value = note.data.carpeta || '';
    document.getElementById('atomica-tags-input').value = Array.isArray(note.data.tags) ? note.data.tags.map(t => `#${t}`).join(', ') : '';
    document.getElementById('atomica-fuente-select').value = note.data.fuente || '';

    // Extraer secciones de contenido
    const ideaMatch = note.content.match(/## (?:Idea \(con mis palabras\)|Idea \(in my own words\)|Idea)([\s\S]*?)(?=## (?:¿Por qué importa|Why it matters)|$)/i);
    const porqueMatch = note.content.match(/## (?:¿Por qué importa\??|Why it matters\??)([\s\S]*?)(?=## (?:¿Cómo se conecta|How it connects)|$)/i);
    const conectaMatch = note.content.match(/## (?:¿Cómo se conecta con lo que ya sé\??|How it connects(?: with what I already know)?\??)([\s\S]*?)$/i);

    document.getElementById('atomica-idea').value = ideaMatch ? ideaMatch[1].trim() : '';
    document.getElementById('atomica-porque').value = porqueMatch ? porqueMatch[1].trim() : '';
    document.getElementById('atomica-conecta').value = conectaMatch ? conectaMatch[1].trim() : '';

    // Backlinks
    const backlinksContainer = document.getElementById('atomica-backlinks-list');
    if (note.backlinks && note.backlinks.length > 0) {
      backlinksContainer.innerHTML = note.backlinks.map(b => `
        <div class="backlink-item">
          <span class="backlink-type">${b.sourceType}</span>
          <strong>${escapeHtml(b.sourceTitle)}</strong>
          ${b.razon ? `<span class="text-muted">— "${escapeHtml(b.razon)}"</span>` : ''}
        </div>
      `).join('');
    } else {
      backlinksContainer.innerHTML = `<span class="text-muted">${ui("No hay referencias entrantes aún.", "No incoming references yet.")}</span>`;
    }

    // Pregunta asociada
    if (note.pregunta) {
      document.getElementById('atomica-q-p').value = note.pregunta.pregunta || '';
      document.getElementById('atomica-q-r').value = note.pregunta.respuesta || '';
      document.getElementById('atomica-q-stats').innerHTML = `
        <span>Ease Factor: <strong>${note.pregunta.ease_factor}</strong></span> |
        <span>${ui('Intervalo', 'Interval')}: <strong>${note.pregunta.intervalo_dias}d</strong></span> |
        <span>${ui('Próxima revisión', 'Next review')}: <strong>${note.pregunta.proxima_revision}</strong></span> |
        <span>${ui('Repasos', 'Reviews')}: <strong>${(note.pregunta.historial || []).length}</strong></span>
      `;
    } else {
      document.getElementById('atomica-q-p').value = '';
      document.getElementById('atomica-q-r').value = '';
      document.getElementById('atomica-q-stats').innerHTML = `<span class="text-muted">${ui('Sin pregunta de autoevaluación asociada. Formula una para programar el repaso espaciado.', 'No self-assessment question yet. Add one to enable spaced repetition review.')}</span>`;
    }

    document.getElementById('btn-delete-atomica').style.display = 'inline-block';
    setAtomicaTab('edit');
    openModal('modal-atomica');
    checkNgramOverlap();
  } catch (e) {
    showToast(ui("Error cargando nota atómica", "Could not load the atomic note"), 'danger');
  }
};

function initEditorTabs() {
  document.getElementById('btn-atomica-tab-edit')?.addEventListener('click', () => setAtomicaTab('edit'));
  document.getElementById('btn-atomica-tab-preview')?.addEventListener('click', () => setAtomicaTab('preview'));
}

function setAtomicaTab(tab) {
  const btnEdit = document.getElementById('btn-atomica-tab-edit');
  const btnPrev = document.getElementById('btn-atomica-tab-preview');
  const form = document.getElementById('form-atomica');
  const preview = document.getElementById('atomica-preview-container');

  if (tab === 'edit') {
    btnEdit?.classList.add('active');
    btnPrev?.classList.remove('active');
    if (form) form.style.display = 'block';
    if (preview) preview.style.display = 'none';
  } else {
    btnPrev?.classList.add('active');
    btnEdit?.classList.remove('active');
    if (form) form.style.display = 'none';
    if (preview) {
      preview.style.display = 'block';
      const titulo = document.getElementById('atomica-titulo')?.value || 'Sin título';
      const idea = document.getElementById('atomica-idea')?.value || '';
      const porque = document.getElementById('atomica-porque')?.value || '';
      const conecta = document.getElementById('atomica-conecta')?.value || '';
      const qP = document.getElementById('atomica-q-p')?.value || '';
      const qR = document.getElementById('atomica-q-r')?.value || '';

      const md = state.lang === 'es'
        ? `# ${titulo}\n\n## Idea (con mis palabras)\n${idea}\n\n## ¿Por qué importa?\n${porque}\n\n## ¿Cómo se conecta con lo que ya sé?\n${conecta}\n\n---\n\n### Pregunta de Autoevaluación\n**P:** ${qP}\n\n**R:** ${qR}`
        : `# ${titulo}\n\n## Idea (in my own words)\n${idea}\n\n## Why it matters\n${porque}\n\n## How it connects with what I already know\n${conecta}\n\n---\n\n### Self-Assessment Question\n**Q:** ${qP}\n\n**A:** ${qR}`;
      preview.innerHTML = renderMarkdown(md);
    }
  }
}

// Asistente Feynman para paráfrasis activa
window.applyFeynmanPrompt = function(type) {
  const ideaEl = document.getElementById('atomica-idea');
  if (!ideaEl) return;
  let textToAdd = '';
  if (type === 'infantil') {
    textToAdd = ui('\n\nEn palabras sencillas: Esto funciona como cuando ', '\n\nIn simple words: This works like when ');
  } else if (type === 'analogia') {
    textToAdd = ui('\n\nAnalogía cotidiana: Es similar a ', '\n\nEveryday analogy: This is similar to ');
  } else if (type === 'limite') {
    textToAdd = ui('\n\nLímites y excepciones: Este principio no se cumple si ', '\n\nLimits and exceptions: This principle does not apply if ');
  }
  ideaEl.value += textToAdd;
  ideaEl.focus();
  checkNgramOverlap();
};

document.getElementById('btn-save-atomica')?.addEventListener('click', async () => {
  const id = document.getElementById('atomica-edit-id').value;
  const titulo = document.getElementById('atomica-titulo').value.trim();
  const idea = document.getElementById('atomica-idea').value.trim();
  const porque = document.getElementById('atomica-porque').value.trim();
  const conecta = document.getElementById('atomica-conecta').value.trim();
  const fuente = document.getElementById('atomica-fuente-select').value || null;
  const carpeta = document.getElementById('atomica-folder-select')?.value.trim() || null;
  const rawTags = document.getElementById('atomica-tags-input')?.value || '';
  const tags = rawTags.split(/[\s,]+/).map(t => t.replace(/^#/, '').trim()).filter(Boolean);

  if (!titulo || !idea) {
    showToast(ui("El título y la Idea propia son obligatorios", "A title and an idea in your own words are required"), 'warning');
    return;
  }

  const explicitWikilinks = (conecta.match(/\[\[([a-zA-Z0-9_-]+)\]\]/g) || []).map(m => m.replace(/\[\[|\]\]/g, ''));
  const content = state.lang === 'es'
    ? `## Idea (con mis palabras)\n${idea}\n\n## ¿Por qué importa?\n${porque}\n\n## ¿Cómo se conecta con lo que ya sé?\n${conecta}\n`
    : `## Idea (in my own words)\n${idea}\n\n## Why it matters\n${porque}\n\n## How it connects with what I already know\n${conecta}\n`;

  const questionText = document.getElementById('atomica-q-p').value.trim();
  const answerText = document.getElementById('atomica-q-r').value.trim();
  if (Boolean(questionText) !== Boolean(answerText)) {
    showToast(ui('Completa la pregunta y la respuesta.', 'Complete both the question and answer.'), 'warning');
    return;
  }
  const campo = document.getElementById('atomica-campo')?.value.trim() || null;
  const proyecto = document.getElementById('atomica-proyecto')?.value.trim() || null;
  const payload = {
    tipo: 'atomica',
    campo,
    proyecto,
    data: {
      titulo,
      tipo: 'atomica',
      fuente,
      carpeta,
      campo,
      proyecto,
      tags,
      enlaces: explicitWikilinks
    },
    content
  };

  try {
    let res;
    if (id) {
      res = await apiFetch(`/api/notes/atomica/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      res = await apiFetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    if (res.ok) {
      const saved = await res.json();
      const atomicaId = id || saved.id;
      document.getElementById('atomica-edit-id').value = atomicaId;

      // Guardar pregunta asociada si se ingresó
      const qP = document.getElementById('atomica-q-p').value.trim();
      const qR = document.getElementById('atomica-q-r').value.trim();
      if (qP && qR) {
        await apiFetch('/api/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nota_id: atomicaId,
            pregunta: qP,
            respuesta: qR
          })
        });
      }

      closeModal('modal-atomica');
      showToast(ui("Nota atómica guardada correctamente", "Atomic note saved"), 'success');
      await loadAllData();
    }
  } catch (e) {
    showToast(ui("Error al guardar la nota atómica", "Could not save the atomic note"), 'danger');
  }
});

document.getElementById('btn-delete-atomica')?.addEventListener('click', async () => {
  const id = document.getElementById('atomica-edit-id').value;
  if (!id) return;
  if (!confirm(ui(`¿Eliminar la nota atómica "${id}" y su pregunta asociada?`, `Delete atomic note "${id}" and its question?`))) return;

  try {
    const res = await apiFetch(`/api/notes/atomica/${id}`, { method: 'DELETE' });
    if (res.ok) {
      closeModal('modal-atomica');
      showToast(ui("Nota atómica eliminada", "Atomic note deleted"), 'success');
      await loadAllData();
    }
  } catch (e) {
    showToast(ui("Error al eliminar", "Could not delete the note"), 'danger');
  }
});

// -------------------------------------------------------------
// 3. Notas Fuente
// -------------------------------------------------------------
function renderFuentesView() {
  const container = document.getElementById('fuentes-list');
  if (!container) return;

  const rawFuentes = state.notes.fuente || [];
  
  // Count scoped before type filter
  let countScoped = rawFuentes.filter(noteMatchesActiveScope);
  if (state.selectedFuenteFolder) {
    countScoped = countScoped.filter(i => {
      const f = (i.data && i.data.carpeta) || i.carpeta || '';
      return f === state.selectedFuenteFolder || f.startsWith(state.selectedFuenteFolder + '/');
    });
  }

  countScoped = populateAndApplyNotesCurriculumFilters('fuente', countScoped);

  const elAll = document.getElementById('count-pill-fuentes-all');
  const elArt = document.getElementById('count-pill-fuentes-articulo');
  const elDoc = document.getElementById('count-pill-fuentes-documento');
  const elVid = document.getElementById('count-pill-fuentes-video');
  if (elAll) elAll.textContent = countScoped.length;
  if (elArt) elArt.textContent = countScoped.filter(n => ['articulo', 'nota'].includes((n.data.tipo_fuente || 'otro').toLowerCase()) || !['video', 'documento', 'pdf', 'libro'].includes((n.data.tipo_fuente || '').toLowerCase())).length;
  if (elDoc) elDoc.textContent = countScoped.filter(n => ['documento', 'pdf', 'libro'].includes((n.data.tipo_fuente || '').toLowerCase())).length;
  if (elVid) elVid.textContent = countScoped.filter(n => (n.data.tipo_fuente || '').toLowerCase() === 'video').length;

  let items = countScoped;
  if (state.selectedFuenteTag) {
    items = items.filter(i => i.data && Array.isArray(i.data.tags) && i.data.tags.includes(state.selectedFuenteTag));
  }

  // Filter by source type filter
  if (state.fuenteTypeFilter === 'video') {
    items = items.filter(n => (n.data.tipo_fuente || '').toLowerCase() === 'video');
  } else if (state.fuenteTypeFilter === 'documento') {
    items = items.filter(n => ['documento', 'pdf', 'libro'].includes((n.data.tipo_fuente || '').toLowerCase()));
  } else if (state.fuenteTypeFilter === 'articulo') {
    items = items.filter(n => ['articulo', 'nota'].includes((n.data.tipo_fuente || 'otro').toLowerCase()) || !['video', 'documento', 'pdf', 'libro'].includes((n.data.tipo_fuente || '').toLowerCase()));
  }

  // Sorting
  const sortVal = document.getElementById('fuente-sort-select')?.value || 'newest';
  if (sortVal === 'oldest') {
    items.sort((a, b) => (a.data.creado || a.id).localeCompare(b.data.creado || b.id));
  } else if (sortVal === 'title') {
    items.sort((a, b) => (a.data.titulo || a.id).localeCompare(b.data.titulo || b.id));
  } else {
    items.sort((a, b) => (b.data.creado || b.id).localeCompare(a.data.creado || a.id));
  }

  renderVerticalFoldersSidebar('fuente');

  if (items.length === 0) {
    container.classList.remove('atomicas-stage-active');
    const vfEl = document.getElementById('view-fuentes');
    if (vfEl) vfEl.classList.remove('has-expanded-stage');
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-icon">📚</div>
        <h3>${ui("No hay notas fuente que coincidan", "No matching source notes")}</h3>
        <p>${ui("Prueba cambiando el filtro de carpeta, módulo, tema, tipo o proyecto, o crea una nueva nota fuente.", "Change the folder, module, topic, type or project filter, or create a source note.")}</p>
      </div>`;
    return;
  }

  const allAtomicas = state.notes.atomica || [];
  const atomicaMap = {};
  allAtomicas.forEach(a => { atomicaMap[a.id] = a; });

  const typeIcons = {
    curso: '🎓',
    video: '🎬',
    articulo: '📄',
    libro: '📖',
    podcast: '🎙️',
    documento: '📄',
    pdf: '📄',
    otro: '📑'
  };

  const typeLabels = {
    curso: ui('CURSO', 'COURSE'),
    video: 'VIDEO',
    articulo: ui('APUNTE', 'NOTE'),
    libro: ui('LIBRO', 'BOOK'),
    documento: ui('DOCUMENTO', 'DOCUMENT'),
    pdf: 'PDF',
    podcast: 'PODCAST',
    otro: ui('FUENTE', 'SOURCE')
  };

  const activeProjObj = findActiveProjectObj();
  const allMapas = state.notes.mapa || [];

  const itemsWithMeta = items.map(item => {
    const directIdeas = Array.isArray(item.data.ideas_disparadas) ? item.data.ideas_disparadas : [];
    const connectedAtomicas = [];
    const seenIds = new Set();

    directIdeas.forEach(aId => {
      if (aId && !seenIds.has(aId)) {
        seenIds.add(aId);
        const found = atomicaMap[aId];
        connectedAtomicas.push({
          id: aId,
          titulo: (found && found.data && found.data.titulo) || humanizeSlug(aId.replace(/^atomica-/, ''))
        });
      }
    });

    allAtomicas.forEach(a => {
      const aFuente = (a.data && a.data.fuente) || a.fuente;
      if (aFuente === item.id && !seenIds.has(a.id)) {
        seenIds.add(a.id);
        connectedAtomicas.push({
          id: a.id,
          titulo: (a.data && a.data.titulo) || humanizeSlug(a.id.replace(/^atomica-/, ''))
        });
      }
    });

    const connectedMapas = [];
    allMapas.forEach(m => {
      const mFuente = (m.data && m.data.fuente) || m.fuente;
      const mSubs = Array.isArray(m.data && m.data.subtemas) ? m.data.subtemas : [];
      if (mFuente === item.id || mSubs.some(s => s && seenIds.has(s.nota_id))) {
        connectedMapas.push({
          id: m.id,
          titulo: (m.data && m.data.titulo) || humanizeSlug(m.id.replace(/^mapa-/, '')),
          isMaster: isMasterCourseMap(m)
        });
      }
    });
    connectedMapas.sort((a, b) => Number(a.isMaster) - Number(b.isMaster));

    const itemCampo = item.campo || (item.data && item.data.campo);
    const itemProyecto = item.proyecto || (item.data && item.data.proyecto);
    const itemCurrMeta = getNoteCurriculumMeta(item, activeProjObj);
    const rawTipo = (item.data.tipo_fuente || 'otro').toLowerCase();
    const typeIcon = typeIcons[rawTipo] || '📑';
    const typeLabel = typeLabels[rawTipo] || ui('FUENTE', 'SOURCE');

    const sourcePillars = typeof parseSourceNotePillars === 'function'
      ? parseSourceNotePillars(item.content || '')
      : { structured: false, raw: item.content || '' };
    const keyPointsRaw = sourcePillars.structured
      ? (sourcePillars.puntos || item.content || '')
      : (sourcePillars.raw || item.content || '');
    const citasRaw = sourcePillars.structured ? (sourcePillars.citas || '') : '';

    let rawSnippet = keyPointsRaw.replace(/^#+\s+.*$/gm, '').replace(/^-+\s*/gm, '').replace(/\s+/g, ' ').trim();
    const snippetText = getCardSnippet(rawSnippet || ui("(Sin puntos clave adicionales)", "(No additional key points)"), 170);

    let topicName = itemProyecto || itemCampo || (item.data.tags && item.data.tags[0]) || '';
    if (topicName.startsWith('atomica-') || topicName.startsWith('fuente-')) {
      topicName = humanizeSlug(topicName);
    }
    let topicColorClass = 'pill-topic-purple';
    const lowerTopic = topicName.toLowerCase();
    if (lowerTopic.includes('product') || lowerTopic.includes('habit') || lowerTopic.includes('green')) {
      topicColorClass = 'pill-topic-green';
    } else if (lowerTopic.includes('strat') || lowerTopic.includes('business') || lowerTopic.includes('market')) {
      topicColorClass = 'pill-topic-yellow';
    } else if (lowerTopic.includes('person') || lowerTopic.includes('red') || lowerTopic.includes('health')) {
      topicColorClass = 'pill-topic-pink';
    } else if (lowerTopic.includes('tech') || lowerTopic.includes('code') || lowerTopic.includes('soft') || lowerTopic.includes('ai')) {
      topicColorClass = 'pill-topic-blue';
    }

    const shortTopicName = topicName.length > 28 ? topicName.slice(0, 26) + '…' : topicName;
    const shortModuleLabel = itemCurrMeta.modulo || '';
    const shortModPill = shortModuleLabel.length > 26 ? shortModuleLabel.slice(0, 24) + '…' : shortModuleLabel;
    const shortLessonLabel = itemCurrMeta.leccionDisplay || '';
    const shortLessonPill = shortLessonLabel.length > 28 ? shortLessonLabel.slice(0, 26) + '…' : shortLessonLabel;

    return {
      item,
      connectedAtomicas,
      connectedMapas,
      itemCampo,
      itemProyecto,
      itemCurrMeta,
      rawTipo,
      typeIcon,
      typeLabel,
      keyPointsRaw: keyPointsRaw.trim(),
      citasRaw: citasRaw.trim(),
      snippetText,
      topicName,
      shortTopicName,
      topicColorClass,
      shortModuleLabel,
      shortModPill,
      shortLessonLabel,
      shortLessonPill
    };
  });

  const expandedEntry = state.activeExpandedFuenteId
    ? itemsWithMeta.find(entry => entry.item.id === state.activeExpandedFuenteId) || null
    : null;
  const viewFuentesEl = document.getElementById('view-fuentes');
  if (viewFuentesEl) {
    viewFuentesEl.classList.toggle('has-expanded-stage', Boolean(expandedEntry));
    viewFuentesEl.classList.toggle('show-folders-drawer', Boolean(state.showFuentesFoldersDrawer && !expandedEntry));
  }
  const folderBtn = document.getElementById('btn-toggle-fuente-folders');
  if (folderBtn) {
    folderBtn.classList.toggle('active', Boolean(state.showFuentesFoldersDrawer && !expandedEntry));
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MODO 1: CUADRÍCULA LIMPIA Y DESCANSADA DE NOTAS FUENTE (CERO SATURACIÓN)
  // ══════════════════════════════════════════════════════════════════════════
  if (!expandedEntry) {
    container.classList.remove('atomicas-stage-active');
    container.innerHTML = itemsWithMeta.map(({ item, connectedAtomicas, connectedMapas, itemProyecto, rawTipo, typeIcon, typeLabel, snippetText, topicName, shortTopicName, topicColorClass, shortModuleLabel, shortModPill, shortLessonLabel, shortLessonPill }) => `
      <div class="source-modern-card atomic-redbox-card source-clean-card" onclick="selectExpandedFuente('${escapeHtml(item.id)}')" title="${ui('Haz clic para abrir y estudiar esta fuente', 'Click to open and study this source')}">
        <div class="smc-header-row atomic-clean-header">
          <div class="smc-badges-left">
            <span class="smc-pill smc-pill-${rawTipo === 'video' ? 'video' : (['documento', 'pdf', 'libro'].includes(rawTipo) ? 'document' : 'note')}">
              ${typeIcon} ${escapeHtml(typeLabel)}
            </span>
            ${shortTopicName ? `<span class="smc-pill ${topicColorClass}" title="${escapeHtml(topicName)}">${escapeHtml(shortTopicName)}</span>` : ''}
            ${shortModPill ? `<span class="smc-pill pill-topic-green" title="${escapeHtml(shortModuleLabel)}">📦 ${escapeHtml(shortModPill)}</span>` : ''}
            ${shortLessonPill ? `<span class="smc-pill pill-topic-blue" title="${escapeHtml(shortLessonLabel)}">📖 ${escapeHtml(shortLessonPill)}</span>` : ''}
          </div>
        </div>

        <div class="smc-title-media-row">
          <div class="smc-title-col smc-title-fullwidth">
            <h3 class="smc-title-text" title="${escapeHtml(item.data.titulo || item.id)}">${escapeHtml(item.data.titulo || item.id)}</h3>
            ${item.data.autor ? `
              <div class="smc-author-line atomic-calm-source-line">
                <span class="smc-author-avatar">👤</span>
                <span class="smc-author-name">${escapeHtml(item.data.autor)}</span>
              </div>
            ` : (itemProyecto ? `
              <div class="smc-author-line atomic-calm-source-line">
                <span class="smc-author-avatar">🎯</span>
                <span class="smc-author-name">${escapeHtml(itemProyecto)}</span>
              </div>
            ` : '')}
          </div>
        </div>

        <div class="smc-snippet-text source-card-snippet">
          ${escapeHtml(snippetText)}
        </div>

        <div class="fuente-clean-footer">
          <div class="fuente-footer-pills">
            <span class="fuente-derived-pill">⚛️ ${connectedAtomicas.length} ${ui("conceptos", "concepts")}</span>
            ${connectedMapas.length > 0 ? `<span class="fuente-derived-pill map-pill">🗺️ ${connectedMapas.length} ${ui("mapas", "maps")}</span>` : ''}
          </div>
          <span class="source-open-hint">${ui("Leer fuente →", "Read source →")}</span>
        </div>
      </div>
    `).join('');
    return;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MODO 2: ESCENARIO SPLIT-STAGE PARA NOTAS FUENTE CON REVELACIÓN PROGRESIVA
  // ══════════════════════════════════════════════════════════════════════════
  container.classList.add('atomicas-stage-active');

  const railHtml = itemsWithMeta.map(({ item, typeIcon, shortModPill, shortLessonPill }) => {
    const isCurrent = item.id === expandedEntry.item.id;
    const subBadge = shortLessonPill || shortModPill;
    return `
      <div class="atomica-mini-rail-card ${isCurrent ? 'is-active-stage' : ''}" onclick="selectExpandedFuente('${escapeHtml(item.id)}')" title="${isCurrent ? ui('Haz clic para cerrar y volver a la cuadrícula', 'Click to close and return to grid') : ui('Abrir esta nota fuente', 'Open this source note')}">
        <h4 class="atomica-mini-title">${typeIcon} ${escapeHtml(item.data.titulo || item.id)}</h4>
        ${subBadge ? `<span class="atomica-mini-mod-sub">📖 ${escapeHtml(subBadge)}</span>` : ''}
      </div>
    `;
  }).join('');

  const {
    item: activeFuente,
    connectedAtomicas,
    connectedMapas,
    itemCampo,
    itemProyecto,
    itemCurrMeta,
    rawTipo,
    typeIcon,
    typeLabel,
    keyPointsRaw,
    citasRaw,
    topicName,
    shortTopicName,
    topicColorClass,
    shortModuleLabel,
    shortModPill,
    shortLessonLabel,
    shortLessonPill
  } = expandedEntry;

  const currentIdx = itemsWithMeta.findIndex(e => e.item.id === activeFuente.id);
  const prevItem = currentIdx > 0 ? itemsWithMeta[currentIdx - 1].item : null;
  const nextItem = (currentIdx >= 0 && currentIdx < itemsWithMeta.length - 1) ? itemsWithMeta[currentIdx + 1].item : null;
  const activeDrawerTab = state.activeExpandedFuenteTab !== undefined ? state.activeExpandedFuenteTab : (connectedAtomicas.length > 0 ? 'concepts' : null);
  const noteTags = Array.isArray(activeFuente.data?.tags) ? activeFuente.data.tags : [];
  const folderName = (activeFuente.data && activeFuente.data.carpeta) || activeFuente.carpeta || '';
  const googleQuery = (activeFuente.data && (activeFuente.data.busqueda_google || activeFuente.data.titulo)) || activeFuente.id;

  container.innerHTML = `
    <div class="atomicas-split-stage-workspace">
      <!-- COLUMNA IZQUIERDA: ÍNDICE COMPACTO DE FUENTES -->
      <aside class="atomicas-compact-rail">
        <div class="mapas-rail-header">
          <span class="mapas-rail-title">📄 ${ui("Fuentes", "Sources")} (${itemsWithMeta.length})</span>
          <button type="button" class="btn-rail-collapse-all" onclick="selectExpandedFuente(null)" title="${ui('Volver a la cuadrícula de fuentes', 'Return to sources grid')}">
            ⊞ ${ui("Cuadrícula", "Grid View")}
          </button>
        </div>
        <div class="atomicas-rail-list" id="fuentes-rail-scroll-list">
          ${railHtml}
        </div>
      </aside>

      <!-- COLUMNA DERECHA: LECTURA DE PUNTOS CLAVE, CITAS Y CONCEPTOS EXTRAÍDOS -->
      <section class="atomica-expanded-spotlight atomica-calm-stage source-expanded-spotlight">
        <header class="atomica-spotlight-header">
          <div class="atomica-spotlight-top-bar">
            <div class="smc-badges-left">
              <span class="smc-pill smc-pill-${rawTipo === 'video' ? 'video' : (['documento', 'pdf', 'libro'].includes(rawTipo) ? 'document' : 'note')}">
                ${typeIcon} ${escapeHtml(typeLabel)}
              </span>
              ${shortTopicName ? `<span class="smc-pill ${topicColorClass}" title="${escapeHtml(topicName)}">${escapeHtml(shortTopicName)}</span>` : ''}
              ${shortModPill ? `<span class="smc-pill pill-topic-green" title="${escapeHtml(shortModuleLabel)}">📦 ${escapeHtml(shortModPill)}</span>` : ''}
              ${shortLessonPill ? `<span class="smc-pill pill-topic-blue" title="${escapeHtml(shortLessonLabel)}">📖 ${escapeHtml(shortLessonPill)}</span>` : ''}
            </div>

            <div class="mapa-spotlight-actions">
              <div class="study-seq-nav">
                <button type="button" class="btn-seq-nav" ${prevItem ? `onclick="selectExpandedFuente('${escapeHtml(prevItem.id)}')"` : 'disabled'} title="${prevItem ? escapeHtml(prevItem.data?.titulo || prevItem.id) : ''}">
                  ← ${ui("Anterior", "Prev")}
                </button>
                <span class="study-seq-counter">${currentIdx + 1} / ${itemsWithMeta.length}</span>
                <button type="button" class="btn-seq-nav" ${nextItem ? `onclick="selectExpandedFuente('${escapeHtml(nextItem.id)}')"` : 'disabled'} title="${nextItem ? escapeHtml(nextItem.data?.titulo || nextItem.id) : ''}">
                  ${ui("Siguiente", "Next")} →
                </button>
              </div>
              ${connectedAtomicas.length > 0 ? `
                <button type="button" class="btn-primary" style="padding: 6px 12px; font-size: 12px;" onclick="openNoteInStudyStage('atomica', '${escapeHtml(connectedAtomicas[0].id)}')">
                  🎓 ${ui("Estudiar Conceptos", "Study Concepts")} (${connectedAtomicas.length}) →
                </button>
              ` : ''}
              <button type="button" class="btn-ghost" style="padding: 6px 11px; font-size: 12px;" onclick="openReaderModal('fuente', '${escapeHtml(activeFuente.id)}')">
                ${ui("👁️ Lector", "👁️ Reader")}
              </button>
              <button type="button" class="btn-ghost" style="padding: 6px 11px; font-size: 12px;" onclick="openFuenteModal('${escapeHtml(activeFuente.id)}')">
                ${ui("✏️ Editar", "✏️ Edit")}
              </button>
              <button type="button" class="btn-spotlight-close" onclick="selectExpandedFuente(null)">
                ✕ ${ui("Cerrar", "Close")}
              </button>
            </div>
          </div>

          <h2 class="atomica-spotlight-title">${escapeHtml(activeFuente.data.titulo || activeFuente.id)}</h2>

          <div class="atomica-spotlight-source-bar" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            ${activeFuente.data.autor ? `<span class="mapa-curr-pill">👤 ${escapeHtml(activeFuente.data.autor)}</span>` : ''}
            ${activeFuente.data.creado ? `<span class="card-date">📅 ${escapeHtml(activeFuente.data.creado)}</span>` : ''}
            ${activeFuente.data.url ? `<a href="${escapeHtml(activeFuente.data.url)}" target="_blank" rel="noopener noreferrer" class="mapa-source-pill">🌐 ${ui("Abrir referencia original", "Open original reference")} ↗</a>` : ''}
            <a href="https://www.google.com/search?q=${encodeURIComponent(googleQuery)}" target="_blank" rel="noopener noreferrer" class="btn-google-pill">🔍 Google</a>
          </div>
        </header>

        <!-- NÚCLEO DE LECTURA: PUNTOS CLAVE PARAFRASEADOS Y CITAS RELEVANTES -->
        <div class="atomica-calm-core-reading">
          <article class="atomic-pillar-card pillar-source-points">
            <div class="atomic-calm-section-label">📌 ${ui("Puntos Clave (Parafraseados, no copiados)", "Key Points (Paraphrased, not copied)")}</div>
            <div class="atomic-pillar-body reader-markdown-content">
              ${renderMarkdown(keyPointsRaw || activeFuente.content || ui("(Sin puntos clave registrados)", "(No key points recorded)"))}
            </div>
          </article>

          ${citasRaw ? `
            <article class="atomic-pillar-card pillar-source-quotes">
              <div class="atomic-calm-section-label">💬 ${ui("Citas Textuales Relevantes", "Relevant Verbatim Quotations")}</div>
              <div class="atomic-pillar-body reader-markdown-content source-quotes-body">
                ${renderMarkdown(citasRaw)}
              </div>
            </article>
          ` : ''}
        </div>

        <!-- PESTAÑAS INFERIORES DE REVELACIÓN PROGRESIVA -->
        <div class="atomica-progressive-dock">
          <div class="atomica-dock-tabs-bar">
            <span class="atomica-dock-hint">${ui("Explorar a partir de esta fuente:", "Explore from this source:")}</span>
            <button type="button" class="atomica-dock-tab-btn ${activeDrawerTab === 'concepts' ? 'active' : ''}" onclick="switchExpandedFuenteTab('concepts')">
              ⚛️ ${ui("Conceptos Atómicos Extraídos", "Extracted Atomic Concepts")} (${connectedAtomicas.length})
              <span class="dock-chevron">${activeDrawerTab === 'concepts' ? '▴' : '▾'}</span>
            </button>
            <button type="button" class="atomica-dock-tab-btn ${activeDrawerTab === 'maps' ? 'active' : ''}" onclick="switchExpandedFuenteTab('maps')">
              🗺️ ${ui("Mapas de Contenido", "Content Maps")} (${connectedMapas.length})
              <span class="dock-chevron">${activeDrawerTab === 'maps' ? '▴' : '▾'}</span>
            </button>
            <button type="button" class="atomica-dock-tab-btn ${activeDrawerTab === 'details' ? 'active' : ''}" onclick="switchExpandedFuenteTab('details')">
              🧭 ${ui("Ficha y Etiquetas", "Details & Tags")}
              <span class="dock-chevron">${activeDrawerTab === 'details' ? '▴' : '▾'}</span>
            </button>
          </div>

          ${activeDrawerTab === 'concepts' ? `
            <div class="atomica-dock-panel">
              <div class="atomic-inspector-card">
                <div class="inspector-card-title">⚛️ ${ui("Haz clic en cualquier concepto para estudiarlo en detalle", "Click any concept to study it in depth")} (${connectedAtomicas.length})</div>
                ${connectedAtomicas.length === 0 ? `
                  <p class="text-muted" style="font-size: 12.5px; margin: 0;">${ui("Aún no se han vinculado notas atómicas a esta fuente.", "No atomic notes linked to this source yet.")}</p>
                ` : `
                  <div class="inspector-conn-list source-concepts-grid">
                    ${connectedAtomicas.map((ac, idx) => `
                      <div class="inspector-conn-pill atomic-conn-pill" onclick="openNoteInStudyStage('atomica', '${escapeHtml(ac.id)}')">
                        <span class="icp-icon">${String(idx + 1).padStart(2, '0')}. ⚛️</span>
                        <span class="icp-text">${escapeHtml(ac.titulo)}</span>
                        <span class="icp-arrow">→</span>
                      </div>
                    `).join('')}
                  </div>
                `}
              </div>
            </div>
          ` : ''}

          ${activeDrawerTab === 'maps' ? `
            <div class="atomica-dock-panel">
              <div class="atomic-inspector-card">
                <div class="inspector-card-title">🗺️ ${ui("Mapas de Contenido relacionados con esta fuente", "Content Maps related to this source")} (${connectedMapas.length})</div>
                ${connectedMapas.length === 0 ? `
                  <p class="text-muted" style="font-size: 12.5px; margin: 0;">${ui("No hay mapas asociados a esta fuente todavía.", "No content maps associated with this source yet.")}</p>
                ` : `
                  <div class="inspector-conn-list">
                    ${connectedMapas.map(cm => `
                      <div class="inspector-conn-pill map-conn-pill" onclick="studyLessonMapFromHome('${escapeHtml(cm.id)}')">
                        <span class="icp-icon">${cm.isMaster ? '🎓' : '🗺️'}</span>
                        <span class="icp-text">${escapeHtml(cm.titulo)}</span>
                        <span class="icp-arrow">→</span>
                      </div>
                    `).join('')}
                  </div>
                `}
              </div>
            </div>
          ` : ''}

          ${activeDrawerTab === 'details' ? `
            <div class="atomica-dock-panel">
              <div class="atomic-inspector-card">
                <div class="inspector-card-title">🧭 ${ui("Metadatos de la Fuente", "Source Metadata")}</div>
                <div class="inspector-meta-list">
                  ${itemProyecto ? `<div class="inspector-meta-row"><span class="im-lbl">${ui("Proyecto", "Project")}</span><span class="im-val">🎯 ${escapeHtml(itemProyecto)}</span></div>` : ''}
                  ${itemCampo ? `<div class="inspector-meta-row"><span class="im-lbl">${ui("Campo", "Field")}</span><span class="im-val">🌐 ${escapeHtml(itemCampo)}</span></div>` : ''}
                  ${itemCurrMeta.modulo ? `<div class="inspector-meta-row"><span class="im-lbl">${ui("Módulo", "Module")}</span><span class="im-val">📦 ${escapeHtml(itemCurrMeta.modulo)}</span></div>` : ''}
                  ${itemCurrMeta.leccionDisplay ? `<div class="inspector-meta-row"><span class="im-lbl">${ui("Tema", "Topic")}</span><span class="im-val">📖 ${escapeHtml(itemCurrMeta.leccionDisplay)}</span></div>` : ''}
                  ${folderName ? `<div class="inspector-meta-row"><span class="im-lbl">${ui("Carpeta", "Folder")}</span><span class="im-val">📁 ${escapeHtml(folderName)}</span></div>` : ''}
                  ${activeFuente.data?.creado ? `<div class="inspector-meta-row"><span class="im-lbl">${ui("Creado", "Created")}</span><span class="im-val">📅 ${escapeHtml(activeFuente.data.creado)}</span></div>` : ''}
                </div>
                ${noteTags.length > 0 ? `
                  <div class="inspector-tags-wrap" style="margin-top: 12px; display:flex; gap:6px; flex-wrap:wrap;">
                    ${noteTags.map(t => `<span class="badge-hashtag" onclick="filterByTag('${escapeHtml(t)}')">#${escapeHtml(t)}</span>`).join('')}
                  </div>
                ` : ''}
              </div>
            </div>
          ` : ''}
        </div>
      </section>
    </div>
  `;
}

window.toggleFuentesFoldersDrawer = function() {
  state.showFuentesFoldersDrawer = !state.showFuentesFoldersDrawer;
  renderFuentesView();
};

window.selectExpandedFuente = function(fuenteId) {
  if (!fuenteId || state.activeExpandedFuenteId === fuenteId) {
    state.activeExpandedFuenteId = null;
    state.activeExpandedFuenteTab = null;
  } else {
    state.activeExpandedFuenteId = fuenteId;
    state.activeExpandedFuenteTab = 'concepts';
  }
  renderFuentesView();
  if (state.activeExpandedFuenteId) {
    setTimeout(() => {
      const activeRailEl = document.querySelector('#fuentes-rail-scroll-list .atomica-mini-rail-card.is-active-stage');
      if (activeRailEl && typeof activeRailEl.scrollIntoView === 'function') {
        activeRailEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }, 30);
  }
};

window.switchExpandedFuenteTab = function(tabName) {
  if (state.activeExpandedFuenteTab === tabName) {
    state.activeExpandedFuenteTab = null;
  } else {
    state.activeExpandedFuenteTab = tabName;
  }
  renderFuentesView();
};

window.openNewFuenteModal = function() {
  document.getElementById('modal-fuente-title').textContent = ui("Nueva Nota Fuente", "New source note");
  document.getElementById('fuente-edit-id').value = '';
  document.getElementById('fuente-titulo').value = '';
  document.getElementById('fuente-autor').value = '';
  const cEl = document.getElementById('fuente-campo');
  const pEl = document.getElementById('fuente-proyecto');
  if (cEl) cEl.value = state.activeField || '';
  if (pEl) pEl.value = state.activeProject || '';
  document.getElementById('fuente-folder-select').value = state.selectedFuenteFolder || '';
  document.getElementById('fuente-tags-input').value = state.selectedFuenteTag ? `#${state.selectedFuenteTag}` : '';
  document.getElementById('fuente-tipo-select').value = 'articulo';
  document.getElementById('fuente-puntos').value = '';
  document.getElementById('fuente-ideas-container').innerHTML = '<span class="text-muted">Las ideas se vincularán al crearlas desde el flujo Procesar o editor de atómicas.</span>';
  document.getElementById('btn-delete-fuente').style.display = 'none';

  openModal('modal-fuente');
};

window.openFuenteModal = async function(id) {
  try {
    const res = await apiFetch(`/api/notes/fuente/${id}`);
    const note = await res.json();

    document.getElementById('modal-fuente-title').textContent = `${ui("Editar fuente", "Edit source")}: ${note.data.titulo || id}`;
    document.getElementById('fuente-edit-id').value = id;
    document.getElementById('fuente-titulo').value = note.data.titulo || '';
    document.getElementById('fuente-autor').value = note.data.autor || '';
    const cEl = document.getElementById('fuente-campo');
    const pEl = document.getElementById('fuente-proyecto');
    if (cEl) cEl.value = note.campo || (note.data && note.data.campo) || '';
    if (pEl) pEl.value = note.proyecto || (note.data && note.data.proyecto) || '';
    document.getElementById('fuente-folder-select').value = note.data.carpeta || '';
    document.getElementById('fuente-tags-input').value = Array.isArray(note.data.tags) ? note.data.tags.map(t => `#${t}`).join(', ') : '';
    document.getElementById('fuente-tipo-select').value = note.data.tipo_fuente || 'articulo';

    const puntosMatch = note.content.match(/## (?:Puntos clave \(parafraseados, no copiados\)|Key points \(paraphrased,? not copied\)|Key points)([\s\S]*?)(?=## (?:Ideas propias|Ideas it sparks|My own ideas)|$)/i);
    document.getElementById('fuente-puntos').value = puntosMatch ? puntosMatch[1].trim() : note.content;

    const ideas = Array.isArray(note.data.ideas_disparadas) ? note.data.ideas_disparadas : [];
    const ideasContainer = document.getElementById('fuente-ideas-container');
    if (ideas.length > 0) {
      ideasContainer.innerHTML = ideas.map(i => `<span class="meta-pill">💡 [[${i}]]</span>`).join(' ');
    } else {
      ideasContainer.innerHTML = `<span class="text-muted">${ui('Ninguna idea disparada registrada.', 'No ideas sparked yet.')}</span>`;
    }

    document.getElementById('btn-delete-fuente').style.display = 'inline-block';
    openModal('modal-fuente');
  } catch (e) {
    showToast(ui("Error cargando nota fuente", "Could not load the source note"), 'danger');
  }
};

document.getElementById('btn-save-fuente')?.addEventListener('click', async () => {
  const id = document.getElementById('fuente-edit-id').value;
  const titulo = document.getElementById('fuente-titulo').value.trim();
  const autor = document.getElementById('fuente-autor').value.trim();
  const tipo_fuente = document.getElementById('fuente-tipo-select').value;
  const puntos = document.getElementById('fuente-puntos').value.trim();
  const carpeta = document.getElementById('fuente-folder-select')?.value.trim() || null;
  const rawTags = document.getElementById('fuente-tags-input')?.value || '';
  const tags = rawTags.split(/[\s,]+/).map(t => t.replace(/^#/, '').trim()).filter(Boolean);
  const campo = document.getElementById('fuente-campo')?.value.trim() || null;
  const proyecto = document.getElementById('fuente-proyecto')?.value.trim() || null;

  if (!titulo) {
    showToast(ui("El título de la fuente es obligatorio", "A source title is required"), 'warning');
    return;
  }

  let ideas_disparadas = [];
  if (id) {
    const existing = (state.notes.fuente || []).find(f => f.id === id);
    if (existing && Array.isArray(existing.data.ideas_disparadas)) {
      ideas_disparadas = existing.data.ideas_disparadas;
    }
  }

  let content = state.lang === 'es'
    ? `## Puntos clave (parafraseados, no copiados)\n${puntos}\n\n## Ideas propias que dispara\n`
    : `## Key points (paraphrased, not copied)\n${puntos}\n\n## Ideas it sparks\n`;
  ideas_disparadas.forEach(i => {
    content += `- [[${i}]]\n`;
  });

  const payload = {
    tipo: 'fuente',
    campo,
    proyecto,
    data: {
      titulo,
      autor,
      tipo_fuente,
      tipo: 'fuente',
      carpeta,
      campo,
      proyecto,
      tags,
      ideas_disparadas
    },
    content
  };

  try {
    let res;
    if (id) {
      res = await apiFetch(`/api/notes/fuente/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      res = await apiFetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    if (res.ok) {
      closeModal('modal-fuente');
      showToast(ui("Nota fuente guardada", "Source note saved"), 'success');
      await loadAllData();
    }
  } catch (e) {
    showToast(ui("Error al guardar la fuente", "Could not save the source"), 'danger');
  }
});

document.getElementById('btn-delete-fuente')?.addEventListener('click', async () => {
  const id = document.getElementById('fuente-edit-id').value;
  if (!id) return;
  if (!confirm(ui(`¿Eliminar la nota fuente "${id}"?`, `Delete source note "${id}"?`))) return;

  try {
    const res = await apiFetch(`/api/notes/fuente/${id}`, { method: 'DELETE' });
    if (res.ok) {
      closeModal('modal-fuente');
      showToast(ui("Nota fuente eliminada", "Source note deleted"), 'success');
      await loadAllData();
    }
  } catch (e) {
    showToast(ui("Error al eliminar", "Could not delete the note"), 'danger');
  }
});

// -------------------------------------------------------------
// 4. Mapas de Contenido (Tarjetas y Matriz Comparativa)
// -------------------------------------------------------------
window.setMapaTypeFilter = function(mapType) {
  state.mapaTypeFilter = mapType || 'all';
  document.querySelectorAll('#mapa-type-pills-row .filter-chip-pill').forEach(p => {
    p.classList.toggle('active', p.getAttribute('data-map-type') === state.mapaTypeFilter);
  });
  renderMapasView();
};

window.handleMapaDetailsToggle = function(detailsEl) {
  if (!detailsEl) return;
  const key = detailsEl.getAttribute('data-mapa-collapse-key');
  if (!key) return;
  if (!state.mapasExpandedKeys) state.mapasExpandedKeys = {};
  state.mapasExpandedKeys[key] = Boolean(detailsEl.open);
};

window.selectExpandedMapa = function(mapaId) {
  if (!mapaId || state.activeExpandedMapaId === mapaId) {
    state.activeExpandedMapaId = null;
  } else {
    state.activeExpandedMapaId = mapaId;
  }
  renderMapasCards();
};

window.toggleAllMapasCards = function() {
  const { items } = getFilteredMapasForView();
  if (!items || items.length === 0) return;
  if (state.activeExpandedMapaId) {
    state.activeExpandedMapaId = null;
  } else {
    state.activeExpandedMapaId = items[0].id;
  }
  renderMapasCards();
};

function getFilteredMapasForView() {
  const rawMapas = (state.notes.mapa || []).filter(noteMatchesActiveScope);
  const currFiltered = populateAndApplyNotesCurriculumFilters('mapa', rawMapas);

  const elAll = document.getElementById('count-pill-mapas-all');
  const elCurso = document.getElementById('count-pill-mapas-curso');
  const elTematico = document.getElementById('count-pill-mapas-tematico');
  const masterCount = currFiltered.filter(m => isMasterCourseMap(m)).length;
  const topicCount = currFiltered.length - masterCount;

  if (elAll) elAll.textContent = currFiltered.length;
  if (elCurso) elCurso.textContent = masterCount;
  if (elTematico) elTematico.textContent = topicCount;

  let items = currFiltered;
  if (state.mapaTypeFilter === 'curso') {
    items = items.filter(m => isMasterCourseMap(m));
  } else if (state.mapaTypeFilter === 'tematico') {
    items = items.filter(m => !isMasterCourseMap(m));
  }

  // Ordenar: Mapa Maestro del Curso primero, luego por lección y fecha
  const projObj = findActiveProjectObj();
  items = [...items].sort((a, b) => {
    const aMaster = isMasterCourseMap(a) ? 0 : 1;
    const bMaster = isMasterCourseMap(b) ? 0 : 1;
    if (aMaster !== bMaster) return aMaster - bMaster;
    const aMeta = getNoteCurriculumMeta(a, projObj);
    const bMeta = getNoteCurriculumMeta(b, projObj);
    const aLec = Number(aMeta.leccionNum) || 9999;
    const bLec = Number(bMeta.leccionNum) || 9999;
    if (aLec !== bLec) return aLec - bLec;
    return String(a.data?.titulo || a.id).localeCompare(String(b.data?.titulo || b.id));
  });

  return { items, totalScopedCount: rawMapas.length };
}

function renderMapasView() {
  const listContainer = document.getElementById('mapas-list');
  const matrixContainer = document.getElementById('mapas-matrix-container');

  if (state.mapViewMode === 'matrix') {
    if (listContainer) listContainer.style.display = 'none';
    if (matrixContainer) {
      matrixContainer.style.display = 'block';
      renderMapasMatrix();
    }
  } else {
    if (matrixContainer) matrixContainer.style.display = 'none';
    if (listContainer) {
      listContainer.style.display = '';
      renderMapasCards();
    }
  }
}

function renderMapasCards() {
  const container = document.getElementById('mapas-list');
  if (!container) return;

  const { items, totalScopedCount } = getFilteredMapasForView();
  if (items.length === 0) {
    container.classList.remove('mapas-stage-active');
    if (totalScopedCount > 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon">🔍</div>
          <h3>${ui("Ningún mapa coincide con el filtro actual", "No content maps match the current filter")}</h3>
          <p>${ui("Prueba cambiando el filtro de tipo de mapa, módulo, tema o búsqueda.", "Try changing the map type, module, topic, or search filter.")}</p>
          <button class="btn-ghost" onclick="clearNotesViewFilters('mapa')" style="margin-top: 12px;">
            ✕ ${ui("Limpiar filtros", "Clear filters")}
          </button>
        </div>`;
    } else {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon">🗺️</div>
          <h3>${ui("No hay mapas de contenido todavía", "No content maps yet")}</h3>
          <p>${ui("Crea tu primer mapa temático para organizar varias notas en un solo tema estructurado.", "Create your first topic map to organize multiple notes into a structured guide.")}</p>
          <button class="btn-primary" onclick="openNewMapaModal()" style="margin-top: 14px;">
            ${ui("+ Crear primer mapa", "+ Create first map")}
          </button>
        </div>`;
    }
    return;
  }

  const atomicTitleMap = {};
  const atomicNoteMap = {};
  (state.notes.atomica || []).forEach(a => {
    atomicTitleMap[a.id] = a.data.titulo || a.id;
    atomicNoteMap[a.id] = a;
  });

  const fuenteTitleMap = {};
  (state.notes.fuente || []).forEach(f => {
    fuenteTitleMap[f.id] = (f.data && f.data.titulo) || f.id;
  });

  const allScopedMapas = (state.notes.mapa || []).filter(noteMatchesActiveScope);
  const activeProjObj = findActiveProjectObj();

  // Verificar si hay un mapa activo para desplegar en modo Split-Stage
  const expandedMap = state.activeExpandedMapaId
    ? items.find(m => m.id === state.activeExpandedMapaId) || null
    : null;

  const toggleBtnLabel = document.getElementById('btn-toggle-all-mapas-label');
  if (toggleBtnLabel) {
    toggleBtnLabel.textContent = expandedMap
      ? ui("Plegar Mapa Activo", "Collapse Active Map")
      : ui("Desplegar Vista Estudio", "Expand Split Stage");
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MODO 1: GALERÍA COMPACTA (TODOS LOS MAPAS PLEGADOS)
  // Solo muestra la información esencial para identificar qué mapa es cada uno
  // ══════════════════════════════════════════════════════════════════════════
  if (!expandedMap) {
    container.classList.remove('mapas-stage-active');
    container.innerHTML = items.map(m => {
      const subtemas = Array.isArray(m.data.subtemas) ? m.data.subtemas : [];
      const count = subtemas.length;
      const countLabel = count === 1
        ? ui("1 concepto", "1 concept")
        : `${count} ${ui("conceptos", "concepts")}`;

      const isMaster = isMasterCourseMap(m);
      const itemCampo = m.campo || (m.data && m.data.campo);
      const itemProyecto = m.proyecto || (m.data && m.data.proyecto);
      const currMeta = getNoteCurriculumMeta(m, activeProjObj);

      const siblingTopicMapsCount = isMaster
        ? allScopedMapas.filter(other =>
            other.id !== m.id &&
            !isMasterCourseMap(other) &&
            itemProyecto &&
            slugifyClient(other.proyecto || (other.data && other.data.proyecto) || '') === slugifyClient(itemProyecto)
          ).length
        : 0;

      return `
        <article class="mapa-card mapa-card-compact-tile ${isMaster ? 'mapa-card-master' : ''}" onclick="selectExpandedMapa('${escapeHtml(m.id)}')" title="${ui('Haz clic para desplegar este mapa en el panel lateral', 'Click to expand this map in the side stage')}">
          <div class="mapa-card-header">
            <div class="mapa-header-tags">
              <span class="mapa-badge ${isMaster ? 'mapa-badge-master' : ''}">
                ${isMaster ? `🎓 ${ui("Mapa Maestro", "Master Map")}` : `🗺️ ${ui("Mapa Temático", "Topic Map")}`}
              </span>
              ${itemProyecto ? `<span class="badge-project" title="${escapeHtml(itemCampo || '')}">🎯 ${escapeHtml(itemProyecto)}</span>` : (itemCampo ? `<span class="badge-project">📁 ${escapeHtml(itemCampo)}</span>` : '')}
            </div>
            <span class="mapa-expand-trigger-pill">⤢ ${ui("Desplegar", "Expand")}</span>
          </div>

          <h3 class="mapa-card-title">${escapeHtml(m.data.titulo || m.id)}</h3>

          <div class="mapa-compact-bottom-row">
            <div class="mapa-curriculum-pills-row mapa-summary-curr-row">
              ${currMeta.modulo ? `<span class="mapa-curr-pill" title="${ui('Módulo', 'Module')}">📦 ${escapeHtml(currMeta.modulo)}</span>` : ''}
              ${currMeta.leccionDisplay ? `<span class="mapa-curr-pill" title="${ui('Tema / Lección', 'Topic / Lesson')}">📖 ${escapeHtml(currMeta.leccionDisplay)}</span>` : ''}
            </div>
            <div class="mapa-compact-counts">
              ${siblingTopicMapsCount > 0 ? `<span class="mapa-count-pill">🗺️ ${siblingTopicMapsCount} ${ui("temas", "topics")}</span>` : ''}
              <span class="mapa-count-pill">⚛️ ${countLabel}</span>
            </div>
          </div>
        </article>
      `;
    }).join('');
    return;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MODO 2: ESCENARIO DIVIDIDO (SPLIT-STAGE MASTER-DETAIL)
  // Izquierda: Los demás mapas reducidos en un riel compacto
  // Derecha: El mapa seleccionado desplegado a gran escala horizontal y vertical
  // ══════════════════════════════════════════════════════════════════════════
  container.classList.add('mapas-stage-active');

  // Construir el riel izquierdo compacto con todos los mapas
  const railHtml = items.map(m => {
    const isCurrent = m.id === expandedMap.id;
    const isMaster = isMasterCourseMap(m);
    const subCount = Array.isArray(m.data?.subtemas) ? m.data.subtemas.length : 0;
    const currMeta = getNoteCurriculumMeta(m, activeProjObj);

    return `
      <div class="mapa-mini-rail-card ${isMaster ? 'is-master' : ''} ${isCurrent ? 'is-active-stage' : ''}" onclick="selectExpandedMapa('${escapeHtml(m.id)}')" title="${isCurrent ? ui('Haz clic para plegar', 'Click to collapse') : ui('Cambiar a este mapa', 'Switch to this map')}">
        <div class="mapa-mini-rail-top">
          <span class="mapa-mini-type-tag ${isMaster ? 'master' : ''}">
            ${isMaster ? `🎓 ${ui("Maestro", "Master")}` : `🗺️ ${ui("Tema", "Topic")}`}
          </span>
          <span class="mapa-mini-count">⚛️ ${subCount}</span>
        </div>
        <h4 class="mapa-mini-title">${escapeHtml(m.data.titulo || m.id)}</h4>
        ${(currMeta.modulo || currMeta.leccionDisplay) ? `
          <div class="mapa-mini-curr">
            ${currMeta.leccionDisplay ? `<span>📖 ${escapeHtml(currMeta.leccionDisplay)}</span>` : (currMeta.modulo ? `<span>📦 ${escapeHtml(currMeta.modulo)}</span>` : '')}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  // Datos detallados del mapa expandido (Derecha)
  const m = expandedMap;
  const subtemas = Array.isArray(m.data.subtemas) ? m.data.subtemas : [];
  const isMaster = isMasterCourseMap(m);
  const itemCampo = m.campo || (m.data && m.data.campo);
  const itemProyecto = m.proyecto || (m.data && m.data.proyecto);
  const currMeta = getNoteCurriculumMeta(m, activeProjObj);
  const mapTags = Array.isArray(m.tags) ? m.tags : (Array.isArray(m.data?.tags) ? m.data.tags : []);
  const descText = String(m.content || '').replace(/^#+\s+.*$/gm, '').trim();

  // Resolver fuente vinculada al mapa
  let fuenteId = (m.data && m.data.fuente) || m.fuente || '';
  if (!fuenteId && subtemas.length > 0) {
    for (const s of subtemas) {
      const aObj = atomicNoteMap[s.nota_id];
      const aF = (aObj && aObj.data && aObj.data.fuente) || (aObj && aObj.fuente);
      if (aF) {
        fuenteId = aF;
        break;
      }
    }
  }
  const fuenteTitle = fuenteId ? (fuenteTitleMap[fuenteId] || humanizeSlug(fuenteId.replace(/^fuente-/, ''))) : '';

  // Mapas temáticos hermanos si es Mapa Maestro
  const siblingTopicMaps = isMaster
    ? allScopedMapas.filter(other =>
        other.id !== m.id &&
        !isMasterCourseMap(other) &&
        itemProyecto &&
        slugifyClient(other.proyecto || (other.data && other.data.proyecto) || '') === slugifyClient(itemProyecto)
      )
    : [];

  // Calcular KPIs de los conceptos del mapa
  let flashcardReadyCount = 0;
  let totalLinksCount = 0;
  subtemas.forEach(s => {
    const aObj = atomicNoteMap[s.nota_id];
    if (aObj) {
      if (aObj.tiene_pregunta || aObj.pregunta) flashcardReadyCount++;
      const links = Array.isArray(aObj.data?.enlaces) ? aObj.data.enlaces.length : 0;
      totalLinksCount += links;
    }
  });

  // Renderizar cuadrícula en 2 columnas de los nodos conceptuales del mapa
  const blueprintNodesHtml = subtemas.map((s, idx) => {
    const aObj = atomicNoteMap[s.nota_id];
    const title = atomicTitleMap[s.nota_id] || s.nota_id;
    const hasQ = Boolean(aObj && (aObj.tiene_pregunta || aObj.pregunta));
    let ideaPreview = '';
    if (aObj && aObj.content) {
      const pillars = typeof parseAtomicNotePillars === 'function'
        ? parseAtomicNotePillars(aObj.content)
        : { idea: aObj.content };
      const rawIdea = String(pillars.idea || aObj.content || '')
        .replace(/^#+\s+.*$/gm, '')
        .replace(/\[\[([a-zA-Z0-9_-]+)\]\]/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .trim();
      ideaPreview = rawIdea.length > 210 ? rawIdea.slice(0, 207) + '…' : rawIdea;
    }
    const numStr = String(idx + 1).padStart(2, '0');

    return `
      <div class="mapa-blueprint-node-card" onclick="openNoteInStudyStage('atomica', '${escapeHtml(s.nota_id)}')" title="${ui('Estudiar esta nota atómica en su escenario expandido', 'Study this atomic note in its expanded stage')}">
        <div class="blueprint-node-top">
          <span class="blueprint-node-num">${numStr}</span>
          <h4 class="blueprint-node-title">⚛️ ${escapeHtml(title)}</h4>
          <div class="blueprint-node-badges">
            ${hasQ ? `<span class="blueprint-node-q-pill" title="${ui('Flashcard activa', 'Active Flashcard')}">🧠 Q&amp;A</span>` : ''}
            <span class="blueprint-node-open-icon">↗</span>
          </div>
        </div>

        <div class="blueprint-role-box">
          <span class="blueprint-box-label">🧭 ${ui("Rol y conexión en este mapa", "Role & connection in this map")}</span>
          <p class="blueprint-role-text">${escapeHtml(s.razon || ui("Concepto estructural del tema", "Structural concept of the topic"))}</p>
        </div>

        ${ideaPreview ? `
          <div class="blueprint-idea-box">
            <span class="blueprint-box-label">💡 ${ui("Síntesis de la Idea", "Core Idea Synthesis")}</span>
            <p class="blueprint-idea-text">${escapeHtml(ideaPreview)}</p>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="mapas-split-stage-workspace">
      <!-- COLUMNA IZQUIERDA: RIEL COMPACTO CON EL RESTO DE MAPAS EN MINIATURA -->
      <aside class="mapas-compact-rail">
        <div class="mapas-rail-header">
          <span class="mapas-rail-title">🗺️ ${ui("Mapas", "Maps")} (${items.length})</span>
          <button type="button" class="btn-rail-collapse-all" onclick="selectExpandedMapa(null)" title="${ui('Volver a la cuadrícula de mapas plegados', 'Return to collapsed maps grid')}">
            ⊞ ${ui("Ver Cuadrícula", "Grid View")}
          </button>
        </div>
        <div class="mapas-rail-list">
          ${railHtml}
        </div>
      </aside>

      <!-- COLUMNA DERECHA: GRAN LIENZO EXPANDIDO DEL MAPA SELECCIONADO (DISEÑO DE 3 EXPERTOS) -->
      <section class="mapa-expanded-spotlight ${isMaster ? 'is-master-spotlight' : ''}">
        <!-- ZONA 1: CABECERA EJECUTIVA Y BARRA DE HERRAMIENTAS -->
        <header class="mapa-spotlight-header">
          <div class="mapa-spotlight-top-bar">
            <div class="mapa-header-tags">
              <span class="mapa-badge ${isMaster ? 'mapa-badge-master' : ''}">
                ${isMaster ? `🎓 ${ui("Mapa Maestro del Curso", "Course Master Map")}` : `🗺️ ${ui("Mapa Temático", "Topic Map")}`}
              </span>
              ${itemProyecto ? `<span class="badge-project">🎯 ${escapeHtml(itemProyecto)}</span>` : (itemCampo ? `<span class="badge-project">📁 ${escapeHtml(itemCampo)}</span>` : '')}
              ${m.data.creado ? `<span class="card-date">📅 ${escapeHtml(m.data.creado)}</span>` : ''}
            </div>

            <div class="mapa-spotlight-actions">
              ${subtemas.length > 0 ? `
                <button type="button" class="btn-primary" style="padding: 6px 13px; font-size: 12px;" onclick="openNoteInStudyStage('atomica', '${escapeHtml(subtemas[0].nota_id)}')" title="${ui('Empezar a estudiar los conceptos de este mapa paso a paso', 'Start studying the concepts of this map step-by-step')}">
                  🎓 ${ui("Estudiar Conceptos", "Study Concepts")}
                </button>
              ` : ''}
              <button type="button" class="btn-ghost" style="padding: 6px 11px; font-size: 12px;" onclick="openReaderModal('mapa', '${escapeHtml(m.id)}')">
                ${ui("👁️ Lector Completo", "👁️ Full Reader")}
              </button>
              <button type="button" class="btn-ghost" style="padding: 6px 11px; font-size: 12px;" onclick="openMapaModal('${escapeHtml(m.id)}')">
                ${ui("✏️ Editar", "✏️ Edit")}
              </button>
              <a href="/api/export/study-guide/${encodeURIComponent(m.id)}?lang=${state.lang}" download class="btn-export-guide">
                ${ui("📥 Guía .md", "📥 Guide .md")}
              </a>
              <a href="https://www.google.com/search?q=${encodeURIComponent((m.data && (m.data.busqueda_google || m.data.titulo)) || m.id)}" target="_blank" rel="noopener noreferrer" class="btn-google-pill">
                🔍 Google
              </a>
              <button type="button" class="btn-spotlight-close" onclick="selectExpandedMapa(null)" title="${ui('Plegar mapa y volver a la cuadrícula', 'Collapse map and return to grid')}">
                ✕ ${ui("Plegar", "Collapse")}
              </button>
            </div>
          </div>

          <h2 class="mapa-spotlight-title">${escapeHtml(m.data.titulo || m.id)}</h2>

          ${(currMeta.modulo || currMeta.leccionDisplay || fuenteId || mapTags.length > 0) ? `
            <div class="mapa-spotlight-meta-row">
              ${currMeta.modulo ? `<span class="mapa-curr-pill">📦 ${escapeHtml(currMeta.modulo)}</span>` : ''}
              ${currMeta.leccionDisplay ? `<span class="mapa-curr-pill">📖 ${escapeHtml(currMeta.leccionDisplay)}</span>` : ''}
              ${fuenteId ? `
                <button type="button" class="mapa-source-pill" onclick="openNoteInStudyStage('fuente', '${escapeHtml(fuenteId)}')">
                  📄 ${ui("Fuente:", "Source:")} ${escapeHtml(fuenteTitle)} ↗
                </button>
              ` : ''}
              ${mapTags.map(t => `<span class="badge-hashtag" style="font-size:11px;" onclick="filterByTag('${escapeHtml(t)}')">#${escapeHtml(t)}</span>`).join('')}
            </div>
          ` : ''}
        </header>

        <!-- ZONA 2: TESIS ARQUITECTÓNICA + TARJETAS KPI -->
        <div class="mapa-spotlight-overview-row">
          <div class="mapa-spotlight-thesis-card">
            <span class="mapa-section-eyebrow">📐 ${ui("Síntesis Estructural del Mapa", "Structural Map Overview")}</span>
            <p class="mapa-spotlight-thesis-text">
              ${descText
                ? escapeHtml(descText)
                : ui("Este mapa organiza y conecta secuencialmente los conceptos atómicos clave de esta unidad para facilitar su estudio global.", "This content map sequentially organizes and links the core atomic concepts of this unit for comprehensive study.")}
            </p>
          </div>
          <div class="mapa-spotlight-kpi-strip">
            <div class="mapa-kpi-mini-box">
              <span class="mapa-kpi-num">${subtemas.length}</span>
              <span class="mapa-kpi-lbl">⚛️ ${ui("Conceptos", "Concepts")}</span>
            </div>
            <div class="mapa-kpi-mini-box">
              <span class="mapa-kpi-num">${flashcardReadyCount}</span>
              <span class="mapa-kpi-lbl">🧠 ${ui("Flashcards", "Flashcards")}</span>
            </div>
            <div class="mapa-kpi-mini-box">
              <span class="mapa-kpi-num">${siblingTopicMaps.length > 0 ? siblingTopicMaps.length : totalLinksCount}</span>
              <span class="mapa-kpi-lbl">${siblingTopicMaps.length > 0 ? `🗺️ ${ui("Mapas Temáticos", "Topic Maps")}` : `🔗 ${ui("Enlaces Red", "Network Links")}`}</span>
            </div>
          </div>
        </div>

        <!-- ZONA 3 (OPCIONAL): MAPAS TEMÁTICOS INTEGRADOS (SI ES MAPA MAESTRO DEL CURSO) -->
        ${siblingTopicMaps.length > 0 ? `
          <div class="mapa-spotlight-submaps-panel">
            <div class="mapa-submaps-panel-header">
              <span>🗺️ ${ui("Mapas Temáticos del Curso — Haz clic en cualquiera para inspeccionarlo aquí", "Course Topic Maps — Click any map to inspect it here")} (${siblingTopicMaps.length})</span>
            </div>
            <div class="mapa-submaps-grid">
              ${siblingTopicMaps.map(sm => {
                const smMeta = getNoteCurriculumMeta(sm, activeProjObj);
                const smCount = ((sm.data && sm.data.subtemas) || []).length;
                return `
                  <div class="mapa-submap-card" onclick="selectExpandedMapa('${escapeHtml(sm.id)}')">
                    <div class="mapa-submap-card-top">
                      <span class="mapa-submap-tag">${smMeta.leccionDisplay ? `📖 ${escapeHtml(smMeta.leccionDisplay)}` : `🗺️ ${ui("Tema", "Topic")}`}</span>
                      <span class="mapa-count-pill">⚛️ ${smCount}</span>
                    </div>
                    <div class="mapa-submap-card-title">${escapeHtml((sm.data && sm.data.titulo) || sm.id)}</div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}

        <!-- ZONA 4: CUADRÍCULA CARTOGRÁFICA DE 2 COLUMNAS CON LOS CONCEPTOS CONECTADOS -->
        <div class="mapa-spotlight-blueprint-section">
          <div class="mapa-blueprint-header">
            <div>
              <h3 class="mapa-blueprint-heading">🧭 ${ui("Arquitectura de Conceptos Conectados", "Connected Concepts Architecture")} (${subtemas.length})</h3>
              <p class="mapa-blueprint-sub">${ui("Cada tarjeta muestra el rol estructural del concepto en este mapa y una síntesis de su idea central. Haz clic en cualquier concepto para estudiarlo en detalle.", "Each card displays the concept's structural role in this map alongside a synthesis of its core idea. Click any concept to study it in detail.")}</p>
            </div>
          </div>

          ${subtemas.length === 0 ? `
            <div class="mapa-empty-notice">
              <span>${ui("Aún no has añadido conceptos a este mapa. Haz clic en Editar para agregarlos.", "No concepts added to this map yet. Click Edit to add them.")}</span>
            </div>
          ` : `
            <div class="mapa-blueprint-grid">
              ${blueprintNodesHtml}
            </div>
          `}
        </div>
      </section>
    </div>
  `;
}

function renderMapasMatrix() {
  const container = document.getElementById('mapas-matrix-container');
  if (!container) return;

  const { items: mapas } = getFilteredMapasForView();
  const atomicNotes = state.notes.atomica || [];
  const atomicMap = {};
  atomicNotes.forEach(a => { atomicMap[a.id] = a; });

  if (mapas.length === 0) {
    container.innerHTML = `<div class="empty-state">${ui("No hay mapas que coincidan con el filtro actual.", "No maps match the current filter.")}</div>`;
    return;
  }

  const activeProjObj = findActiveProjectObj();
  let html = '';
  mapas.forEach(m => {
    const subtemas = Array.isArray(m.data.subtemas) ? m.data.subtemas : [];
    const isMaster = isMasterCourseMap(m);
    const currMeta = getNoteCurriculumMeta(m, activeProjObj);
    html += `
      <div class="matrix-card-wrapper" style="margin-bottom: 28px;">
        <div class="matrix-header-bar">
          <div>
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:4px;">
              <h3 style="font-size:17px; font-weight:700; margin:0;">${isMaster ? '🎓' : '🗺️'} ${escapeHtml(m.data.titulo || m.id)}</h3>
              ${(m.proyecto || (m.data && m.data.proyecto)) ? `<span class="badge-project" title="${escapeHtml(m.campo || (m.data && m.data.campo) || '')}">🎯 ${escapeHtml(m.proyecto || (m.data && m.data.proyecto))}</span>` : ((m.campo || (m.data && m.data.campo)) ? `<span class="badge-project">📁 ${escapeHtml(m.campo || (m.data && m.data.campo))}</span>` : '')}
              ${currMeta.modulo ? `<span class="mapa-curr-pill">📦 ${escapeHtml(currMeta.modulo)}</span>` : ''}
              ${currMeta.leccionDisplay ? `<span class="mapa-curr-pill">📖 ${escapeHtml(currMeta.leccionDisplay)}</span>` : ''}
            </div>
            <span class="text-secondary" style="font-size:12px;">${subtemas.length} ${ui("conceptos organizados en este tema", "concepts organized in this topic")}</span>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn-ghost" style="font-size:12px; padding:6px 12px;" onclick="openMapaModal('${m.id}')">${ui("✏️ Editar Mapa", "✏️ Edit Map")}</button>
            <a href="/api/export/study-guide/${m.id}?lang=${state.lang}" download class="btn-export-guide" title="${ui("Descargar guía de estudio en Markdown", "Download Markdown study guide")}">
              ${ui("📥 Descargar Guía (.md)", "📥 Download Guide (.md)")}
            </a>
          </div>
        </div>
        <table class="matrix-table">
          <thead>
            <tr>
              <th style="width: 25%;">${ui("Subtema Atómico", "Atomic subtopic")}</th>
              <th style="width: 35%;">${ui("Relación con el Tema", "Connection to Topic")}</th>
              <th style="width: 30%;">${ui("Idea Principal", "Main idea")}</th>
              <th style="width: 10%; text-align:center;">${ui("Acción", "Action")}</th>
            </tr>
          </thead>
          <tbody>
    `;

    if (subtemas.length === 0) {
      html += `<tr><td colspan="4" class="text-muted" style="text-align:center; padding: 20px;">${ui("Sin subtemas enlazados aún. Haz clic en Editar Mapa para agregar notas.", "No linked subtopics yet. Click Edit Map to add notes.")}</td></tr>`;
    } else {
      subtemas.forEach(s => {
        const a = atomicMap[s.nota_id];
        const title = a ? (a.data.titulo || s.nota_id) : s.nota_id;
        let ideaSnippet = '';
        if (a) {
          const match = a.content.match(/## (?:Idea \(con mis palabras\)|Idea \(in my own words\)|Idea)([\s\S]*?)(##|$)/i);
          ideaSnippet = match ? match[1].trim() : a.content.substring(0, 100);
        }
        html += `
          <tr>
            <td>
              <a href="#" class="wikilink-badge" onclick="event.preventDefault(); openReaderModal('atomica', '${escapeHtml(s.nota_id)}')">
                ⚛️ ${escapeHtml(title)}
              </a>
            </td>
            <td><span class="matrix-reason">"${escapeHtml(s.razon)}"</span></td>
            <td style="font-size:13px; color:var(--text-secondary); line-height: 1.5;">${escapeHtml(ideaSnippet || '—')}</td>
            <td style="text-align:center; white-space:nowrap;">
              <a href="https://www.google.com/search?q=${encodeURIComponent((a && a.data && (a.data.busqueda_google || a.data.titulo)) || title)}" target="_blank" rel="noopener noreferrer" class="btn-google-pill" style="font-size:10.5px; padding:2px 6px; margin-right:4px;" title="${ui("Buscar concepto en Google", "Search concept on Google")}">
                🔍 Google
              </a>
              <button class="btn-ghost" style="padding:4px 8px; font-size:11px;" onclick="openReaderModal('atomica', '${escapeHtml(s.nota_id)}')">${ui("Ver", "View")}</button>
            </td>
          </tr>
        `;
      });
    }

    html += `
          </tbody>
        </table>
      </div>
    `;
  });

  container.innerHTML = html;
}

window.openNewMapaModal = function() {
  document.getElementById('modal-mapa-title').textContent = ui("Nuevo Mapa de Contenido", "New content map");
  document.getElementById('mapa-edit-id').value = '';
  document.getElementById('mapa-titulo').value = '';
  const elCampo = document.getElementById('mapa-campo');
  const elProyecto = document.getElementById('mapa-proyecto');
  const elModulo = document.getElementById('mapa-modulo');
  const elLecTitulo = document.getElementById('mapa-leccion-titulo');
  const elDesc = document.getElementById('mapa-descripcion');
  if (elCampo) elCampo.value = state.activeField || '';
  if (elProyecto) elProyecto.value = state.activeProject || '';
  if (elModulo) elModulo.value = state.selectedMapaModulo && state.selectedMapaModulo !== '__unassigned__' ? state.selectedMapaModulo : '';
  if (elLecTitulo) elLecTitulo.value = state.selectedMapaLeccion || '';
  if (elDesc) elDesc.value = '';
  state.activeMapSubtemas = [];
  renderSubtemasInModal();
  document.getElementById('btn-delete-mapa').style.display = 'none';

  openModal('modal-mapa');
};

window.openMapaModal = async function(id) {
  try {
    const res = await apiFetch(`/api/notes/mapa/${id}`);
    const note = await res.json();

    document.getElementById('modal-mapa-title').textContent = `${ui("Editar mapa", "Edit map")}: ${note.data.titulo || id}`;
    document.getElementById('mapa-edit-id').value = id;
    document.getElementById('mapa-titulo').value = note.data.titulo || '';
    const elCampo = document.getElementById('mapa-campo');
    const elProyecto = document.getElementById('mapa-proyecto');
    const elModulo = document.getElementById('mapa-modulo');
    const elLecTitulo = document.getElementById('mapa-leccion-titulo');
    const elDesc = document.getElementById('mapa-descripcion');
    const currMeta = getNoteCurriculumMeta(note);
    if (elCampo) elCampo.value = note.campo || (note.data && note.data.campo) || '';
    if (elProyecto) elProyecto.value = note.proyecto || (note.data && note.data.proyecto) || '';
    if (elModulo) elModulo.value = (note.data && note.data.modulo) || currMeta.modulo || '';
    if (elLecTitulo) elLecTitulo.value = (note.data && note.data.leccion_titulo) || currMeta.leccionTitulo || '';
    if (elDesc) elDesc.value = (note.content || '').trim();

    state.activeMapSubtemas = Array.isArray(note.data.subtemas) ? [...note.data.subtemas] : [];
    renderSubtemasInModal();

    document.getElementById('btn-delete-mapa').style.display = 'inline-block';
    openModal('modal-mapa');
  } catch (e) {
    showToast(ui("Error cargando mapa de contenido", "Could not load the content map"), 'danger');
  }
};

function renderSubtemasInModal() {
  const container = document.getElementById('mapa-subtemas-list');
  if (!container) return;

  const atomicTitleMap = {};
  (state.notes.atomica || []).forEach(a => { atomicTitleMap[a.id] = a.data.titulo || a.id; });

  if (state.activeMapSubtemas.length === 0) {
    container.innerHTML = `<span class="text-muted" style="font-size: 13px;">${ui("No hay subtemas enlazados aún.", "No linked subtopics yet.")}</span>`;
    return;
  }

  container.innerHTML = state.activeMapSubtemas.map((s, idx) => `
    <div class="subtema-row">
      <div>
        <strong>⚛️ ${escapeHtml(atomicTitleMap[s.nota_id] || s.nota_id)}</strong>
        <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
          ${ui("Razón:", "Reason:")} <em>${escapeHtml(s.razon)}</em>
        </div>
      </div>
      <button type="button" class="btn-remove-sub" onclick="removeSubtema(${idx})" title="${ui('Quitar de este mapa', 'Remove from this map')}">✕</button>
    </div>
  `).join('');
}

window.removeSubtema = function(idx) {
  state.activeMapSubtemas.splice(idx, 1);
  renderSubtemasInModal();
};

document.getElementById('btn-add-subtema')?.addEventListener('click', () => {
  const notaSelect = document.getElementById('mapa-add-nota-select');
  const razonInput = document.getElementById('mapa-add-razon');

  const nota_id = notaSelect.value;
  const razon = razonInput.value.trim();

  if (!nota_id) {
    showToast(ui("Debes seleccionar una nota atómica", "Select an atomic note"), 'warning');
    return;
  }

  // Razón obligatoria para mantener el mapa estructurado
  if (!razon) {
    showToast(ui("Por favor, explica brevemente cómo se relaciona esta nota con el tema del mapa.", "Please write a brief reason explaining how this note connects to the map topic."), 'warning');
    razonInput.focus();
    return;
  }

  if (state.activeMapSubtemas.some(s => s.nota_id === nota_id)) {
    showToast(ui("Esta nota ya está en este mapa", "This note is already in this map"), 'warning');
    return;
  }

  state.activeMapSubtemas.push({ nota_id, razon });
  razonInput.value = '';
  notaSelect.value = '';
  renderSubtemasInModal();
});

document.getElementById('btn-save-mapa')?.addEventListener('click', async () => {
  const id = document.getElementById('mapa-edit-id').value;
  const titulo = document.getElementById('mapa-titulo').value.trim();
  const campo = document.getElementById('mapa-campo')?.value.trim() || undefined;
  const proyecto = document.getElementById('mapa-proyecto')?.value.trim() || undefined;
  const modulo = document.getElementById('mapa-modulo')?.value.trim() || undefined;
  const leccion_titulo = document.getElementById('mapa-leccion-titulo')?.value.trim() || undefined;
  const descripcion = document.getElementById('mapa-descripcion')?.value.trim() || '';

  if (!titulo) {
    showToast(ui("El título del mapa es obligatorio", "A map title is required"), 'warning');
    return;
  }

  for (const s of state.activeMapSubtemas) {
    if (!s.razon || !s.razon.trim()) {
      showToast(ui("⚠️ Todo enlace en un mapa debe tener una razón explícita.", "Every map link needs an explicit reason."), 'danger');
      return;
    }
  }

  const existingMap = id ? (state.notes.mapa || []).find(m => m.id === id) : null;
  const preservedData = (existingMap && existingMap.data) ? { ...existingMap.data } : {};

  const payload = {
    tipo: 'mapa',
    campo,
    proyecto,
    data: {
      ...preservedData,
      titulo,
      tipo: 'mapa',
      campo,
      proyecto,
      ...(modulo ? { modulo } : {}),
      ...(leccion_titulo ? { leccion_titulo } : {}),
      subtemas: state.activeMapSubtemas
    },
    content: descripcion
  };

  try {
    let res;
    if (id) {
      res = await apiFetch(`/api/notes/mapa/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      res = await apiFetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    if (res.ok) {
      closeModal('modal-mapa');
      showToast(ui("Mapa de contenido guardado con éxito", "Content map saved"), 'success');
      await loadAllData();
    } else {
      const err = await res.json();
      showToast(err.error || ui("Error al guardar el mapa", "Could not save the map"), 'danger');
    }
  } catch (e) {
    showToast(ui("Error de red al guardar el mapa", "Network error while saving the map"), 'danger');
  }
});

document.getElementById('btn-delete-mapa')?.addEventListener('click', async () => {
  const id = document.getElementById('mapa-edit-id').value;
  if (!id) return;
  if (!confirm(ui(`¿Eliminar el mapa de contenido "${id}"?`, `Delete content map "${id}"?`))) return;

  try {
    const res = await apiFetch(`/api/notes/mapa/${id}`, { method: 'DELETE' });
    if (res.ok) {
      closeModal('modal-mapa');
      showToast(ui("Mapa eliminado", "Map deleted"), 'success');
      await loadAllData();
    }
  } catch (e) {
    showToast(ui("Error al eliminar", "Could not delete the note"), 'danger');
  }
});

// -------------------------------------------------------------
// 5. Repaso Espaciado (SM-2 con Interleaving)
// -------------------------------------------------------------
async function loadReviewQueue(practiceAll = false) {
  if (state.isGrading) return;
  try {
    const params = new URLSearchParams();
    if (practiceAll) params.append('all', 'true');
    if (state.activeField) params.append('campo', state.activeField);
    if (state.activeProject) params.append('proyecto', state.activeProject);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await apiFetch('/api/reviews/queue' + qs);
    state.practiceAll = practiceAll;
    const data = await res.json();
    state.reviewQueue = data.queue || [];
    state.currentReviewIndex = 0;
    state.isAnswerRevealed = false;

    renderFlashcard();
  } catch (e) {
    showToast(ui("Error cargando la cola de repaso", "Could not load the review queue"), 'danger');
  }
}

function renderFlashcard() {
  const card = document.getElementById('flashcard-container');
  const empty = document.getElementById('review-empty-state');
  const statusText = document.getElementById('queue-status-text');
  const progressWrap = document.getElementById('review-session-progress-wrap');
  const progressFill = document.getElementById('review-session-progress-fill');

  if (!state.reviewQueue || state.reviewQueue.length === 0 || state.currentReviewIndex >= state.reviewQueue.length) {
    if (card) card.style.display = 'none';
    if (progressWrap) progressWrap.style.display = 'none';
    if (empty) {
      empty.style.display = 'block';
      const noCards = !state.notes.preguntasCount;
      empty.querySelector('h3').textContent = noCards ? ui('Todavía no hay tarjetas', 'No flashcards yet') : ui('¡Sesión de repaso completada!', 'Review session complete!');
      empty.querySelector('p').textContent = noCards ? ui('Añade una pregunta y una respuesta a una nota atómica para empezar.', 'Add a question and answer to an atomic note to start reviewing.') : ui('Has repasado todas las tarjetas pendientes de hoy. Puedes repasar tus Mapas de Contenido o practicar todas las tarjetas.', 'You have reviewed all cards due today. You can review your Content Maps or practice all cards.');
      document.getElementById('btn-practice-all').hidden = noCards;
    }
    if (statusText) statusText.textContent = ui("0 tarjetas pendientes", "0 cards due");
    return;
  }

  if (card) card.style.display = 'flex';
  if (empty) empty.style.display = 'none';

  const item = state.reviewQueue[state.currentReviewIndex];
  state.isAnswerRevealed = false;

  const total = state.reviewQueue.length;
  const currentNum = state.currentReviewIndex + 1;
  const pct = Math.round(((currentNum - 1) / Math.max(1, total)) * 100);
  if (progressWrap && progressFill) {
    progressWrap.style.display = 'block';
    progressFill.style.width = `${Math.max(6, pct)}%`;
  }
  if (statusText) {
    statusText.textContent = `${ui("Tarjeta", "Card")} ${currentNum} / ${total} · ${state.practiceAll ? ui("Modo Práctica", "Practice Mode") : ui("Pendientes hoy", "Due today")}: ${total - state.currentReviewIndex}`;
  }

  let topicLabel = item.tema || 'General';
  if (item.campo && item.proyecto) {
    topicLabel = `${item.campo} › ${item.proyecto}`;
  } else if (item.proyecto) {
    topicLabel = item.proyecto;
  } else if (item.campo) {
    topicLabel = item.campo;
  }
  document.getElementById('fc-tema').textContent = `${ui("Tema / Proyecto", "Topic / Project")}: ${topicLabel}`;
  document.getElementById('fc-interval').textContent = `${ui("Intervalo actual", "Current interval")}: ${item.intervalo_dias || 1}d (Ease: ${item.ease_factor || 2.5})`;
  document.getElementById('fc-question').innerHTML = renderMarkdown(item.pregunta || ui("(Pregunta no definida)", "(No question defined)"));
  document.getElementById('fc-answer').innerHTML = renderMarkdown(item.respuesta || ui("(Respuesta no definida)", "(No answer defined)"));
  document.getElementById('fc-origin').innerHTML = item.nota_id ? `${ui("Nota origen", "Source note")}: <a href="#" onclick="event.preventDefault(); openReaderModal('atomica', '${escapeHtml(item.nota_id)}')">⚛️ [[${escapeHtml(item.nota_id)}]] (${ui("Leer nota completa", "Read full note")})</a>` : '';

  document.getElementById('fc-answer-container').style.display = 'none';
  document.getElementById('fc-grading-buttons').style.display = 'none';
  document.getElementById('fc-btn-reveal').style.display = 'inline-block';
}

function revealAnswer() {
  if (state.isAnswerRevealed) return;
  state.isAnswerRevealed = true;
  document.getElementById('fc-answer-container').style.display = 'block';
  document.getElementById('fc-btn-reveal').style.display = 'none';
  document.getElementById('fc-grading-buttons').style.display = 'flex';
}

async function gradeReview(q) {
  if (state.isGrading || !state.isAnswerRevealed || state.currentReviewIndex >= state.reviewQueue.length) return;
  state.isGrading = true;
  document.querySelectorAll('.grade-btn').forEach(button => button.disabled = true);
  const item = state.reviewQueue[state.currentReviewIndex];

  try {
    const res = await apiFetch('/api/reviews/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preguntaId: item.fileName,
        q: Number(q)
      })
    });

    if (res.ok) {
      const data = await res.json();
      showToast(ui(`Calificación ${q} registrada. Próximo repaso en ${data.sm2.intervalo_dias} días.`, `Grade ${q} saved. Next review in ${data.sm2.intervalo_dias} days.`), 'success');
      state.currentReviewIndex++;
      checkDueReviews();
      renderFlashcard();
    }
  } catch (e) {
    showToast(ui("Error al enviar calificación", "Could not submit the grade"), 'danger');
  } finally {
    state.isGrading = false;
    document.querySelectorAll('.grade-btn').forEach(button => button.disabled = false);
  }
}

document.getElementById('fc-btn-reveal')?.addEventListener('click', revealAnswer);

document.querySelectorAll('.grade-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const q = btn.dataset.q;
    gradeReview(q);
  });
});

// -------------------------------------------------------------
// 6. Analítica de Retención y Aprendizaje
// -------------------------------------------------------------
async function loadAnalyticsView() {
  try {
    const res = await apiFetch('/api/analytics');
    const data = await res.json();

    document.getElementById('kpi-retention').textContent = data.totalReviews ? `${data.retentionRate}%` : "—";
    document.getElementById('kpi-streak').textContent = `${data.streak} ${ui('día', 'day')}${data.streak === 1 ? '' : 's'}`;
    document.getElementById('kpi-ease').textContent = data.totalCards ? data.avgEase : '—';
    document.getElementById('kpi-total-reviews').textContent = data.totalReviews;

    const total = data.totalCards || 1;
    const nuevasPct = Math.round((data.maturity.nuevas / total) * 100);
    const aprenPct = Math.round((data.maturity.enAprendizaje / total) * 100);
    const madurasPct = Math.round((data.maturity.maduras / total) * 100);

    document.getElementById('m-count-nuevas').textContent = `${data.maturity.nuevas} (${nuevasPct}%)`;
    document.getElementById('m-bar-nuevas').style.width = `${nuevasPct}%`;

    document.getElementById('m-count-aprendizaje').textContent = `${data.maturity.enAprendizaje} (${aprenPct}%)`;
    document.getElementById('m-bar-aprendizaje').style.width = `${aprenPct}%`;

    document.getElementById('m-count-maduras').textContent = `${data.maturity.maduras} (${madurasPct}%)`;
    document.getElementById('m-bar-maduras').style.width = `${madurasPct}%`;

    document.getElementById('fc-today').textContent = data.forecast.dueToday;
    document.getElementById('fc-7d').textContent = data.forecast.due1to7;
    document.getElementById('fc-30d').textContent = data.forecast.due8to30;
    document.getElementById('fc-later').textContent = data.forecast.dueLater;

    // Actualizar el Diagnóstico Accionable de Estudio
    const adbTitle = document.getElementById('adb-title');
    const adbDesc = document.getElementById('adb-desc');
    const adbBtnReview = document.getElementById('adb-btn-review');
    const adbBtnMaps = document.getElementById('adb-btn-maps');
    if (adbTitle && adbDesc) {
      const dueNow = data.forecast.dueToday || 0;
      if (adbBtnReview) adbBtnReview.textContent = dueNow > 0 ? `🧠 ${ui(`Repasar ${dueNow} ahora`, `Review ${dueNow} now`)}` : `🧠 ${ui("Practicar Flashcards", "Practice Flashcards")}`;
      if (adbBtnMaps) adbBtnMaps.textContent = `🗺️ ${ui("Ver Mapas", "View Maps")}`;

      if (!data.totalCards) {
        adbTitle.textContent = ui("Diagnóstico: Todavía no tienes flashcards activas", "Diagnosis: You don't have active flashcards yet");
        adbDesc.textContent = ui("Importa un tema con el Asistente IA o añade una pregunta de autoevaluación a tus notas atómicas para activar el repaso espaciado.", "Import a topic with the AI Assistant or add a self-assessment question to your atomic notes to activate spaced repetition.");
      } else if (dueNow > 0) {
        adbTitle.textContent = ui(`Diagnóstico: Tienes ${dueNow} tarjeta${dueNow === 1 ? '' : 's'} lista${dueNow === 1 ? '' : 's'} para consolidar hoy`, `Diagnosis: You have ${dueNow} card${dueNow === 1 ? '' : 's'} ready to consolidate today`);
        adbDesc.textContent = ui(`Completar tu cola de hoy mantendrá tu tasa de retención (${data.retentionRate || 100}%) y pasará tus conceptos de "En Aprendizaje" a "Maduras".`, `Completing today's queue will preserve your retention rate (${data.retentionRate || 100}%) and move concepts from "Learning" to "Mature".`);
      } else {
        adbTitle.textContent = ui("Diagnóstico: ¡Estás al día con tu memoria a largo plazo!", "Diagnosis: You are caught up with your long-term memory!");
        adbDesc.textContent = ui(`0 tarjetas pendientes hoy · ${data.maturity.maduras} conceptos maduros (>21 días). Es un momento ideal para explorar un nuevo tema en Inicio o Mapas de Contenido.`, `0 cards due today · ${data.maturity.maduras} mature concepts (>21 days). Great time to explore a new topic in Home or Content Maps.`);
      }
    }
  } catch (e) {
    showToast(ui('Error cargando analítica de retención', 'Could not load retention analytics'), 'danger');
  }
}

// -------------------------------------------------------------
// 7. Reglas Anti-Copia (N-gramas contiguos y efecto de generación)
// -------------------------------------------------------------
function initAntiCopyControls() {
  const ideaFields = ['atomica-idea', 'proc-a-idea'];

  ideaFields.forEach(fieldId => {
    const el = document.getElementById(fieldId);
    if (!el) return;

    el.addEventListener('paste', (e) => {
      e.preventDefault();
      showToast(ui('Formula la idea con tus propias palabras para consolidarla en tu memoria.', 'Write the idea in your own words to help remember it.'), 'warning');
    });

    if (fieldId === 'atomica-idea') {
      el.addEventListener('input', checkNgramOverlap);
    }
  });

  document.getElementById('atomica-fuente-select')?.addEventListener('change', checkNgramOverlap);
}

function checkNgramOverlap() {
  const ideaText = document.getElementById('atomica-idea')?.value || '';
  const fuenteId = document.getElementById('atomica-fuente-select')?.value;
  const bar = document.getElementById('ngram-warning-bar');
  const text = document.getElementById('ngram-text');

  if (!bar || !text) return;
  if (!fuenteId || !ideaText.trim()) {
    bar.style.display = 'none';
    return;
  }

  const fuente = (state.notes.fuente || []).find(f => f.id === fuenteId);
  if (!fuente || !fuente.content) {
    bar.style.display = 'none';
    return;
  }

  // 1. Extraer palabras limpias
  const fuenteTokens = fuente.content.toLowerCase().replace(/[^a-z0-9áéíóúüñ\s]/g, '').split(/\s+/).filter(w => w.length > 2);
  const ideaTokens = ideaText.toLowerCase().replace(/[^a-z0-9áéíóúüñ\s]/g, '').split(/\s+/).filter(w => w.length > 2);

  if (ideaTokens.length === 0) {
    bar.style.display = 'none';
    return;
  }

  // 2. Extraer trigramas contiguos (3-gramas) de la fuente
  const fuenteTrigrams = new Set();
  for (let i = 0; i < fuenteTokens.length - 2; i++) {
    fuenteTrigrams.add(`${fuenteTokens[i]} ${fuenteTokens[i+1]} ${fuenteTokens[i+2]}`);
  }

  // 3. Comprobar cuántos trigramas de la idea provienen de la fuente
  let trigramMatches = 0;
  const totalTrigrams = Math.max(1, ideaTokens.length - 2);
  for (let i = 0; i < ideaTokens.length - 2; i++) {
    const tri = `${ideaTokens[i]} ${ideaTokens[i+1]} ${ideaTokens[i+2]}`;
    if (fuenteTrigrams.has(tri)) trigramMatches++;
  }

  // 4. Solapamiento global ponderado (trigramas contiguos + palabras compartidas)
  const fuenteWordSet = new Set(fuenteTokens.filter(w => w.length > 3));
  let wordMatches = 0;
  const significantIdeaTokens = ideaTokens.filter(w => w.length > 3);
  significantIdeaTokens.forEach(w => { if (fuenteWordSet.has(w)) wordMatches++; });

  const wordPct = significantIdeaTokens.length > 0 ? (wordMatches / significantIdeaTokens.length) : 0;
  const trigramPct = (trigramMatches / totalTrigrams);
  const overlapPct = Math.round((wordPct * 0.4 + trigramPct * 0.6) * 100);

  bar.style.display = 'block';
  if (overlapPct > 30) {
    bar.style.borderColor = 'var(--accent-danger)';
    bar.style.color = 'var(--accent-danger)';
    text.textContent = ui(`Alto solapamiento léxico (${overlapPct}%). Usa el Asistente Feynman para reformular la idea.`, `High wording overlap (${overlapPct}%). Use the Feynman helper to rephrase the idea in your own words.`);
  } else {
    bar.style.borderColor = 'var(--accent-success)';
    bar.style.color = 'var(--accent-success)';
    text.textContent = ui(`Solapamiento bajo (${overlapPct}%).`, `Low wording overlap (${overlapPct}%).`);
  }
}

// -------------------------------------------------------------
// 8. Autolinking [[...]] en Editores Markdown
// -------------------------------------------------------------
function initWikilinkAutocomplete() {
  const textareas = ['atomica-conecta', 'proc-a-conecta'];
  const popup = document.getElementById('wikilink-autocomplete');
  if (!popup) return;

  textareas.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    el.addEventListener('input', () => {
      const cursor = el.selectionStart;
      const textBefore = el.value.substring(0, cursor);
      const match = textBefore.match(/\[\[([a-zA-Z0-9_-]*)$/);

      if (match) {
        const query = match[1].toLowerCase();
        const candidates = (state.notes.atomica || []).filter(a =>
          a.id.toLowerCase().includes(query) || (a.data.titulo && a.data.titulo.toLowerCase().includes(query))
        );

        if (candidates.length > 0) {
          const rect = el.getBoundingClientRect();
          popup.style.top = `${rect.bottom + window.scrollY + 4}px`;
          popup.style.left = `${rect.left + window.scrollX}px`;
          popup.style.display = 'block';

          popup.innerHTML = candidates.slice(0, 6).map(c => `
            <div class="wikilink-item" data-slug="${c.id}">
              <strong>[[${c.id}]]</strong> — ${escapeHtml(c.data.titulo || '')}
            </div>
          `).join('');

          popup.querySelectorAll('.wikilink-item').forEach(item => {
            item.addEventListener('click', () => {
              const slug = item.dataset.slug;
              const beforeMatch = textBefore.substring(0, match.index);
              const afterCursor = el.value.substring(cursor);
              el.value = `${beforeMatch}[[${slug}]]${afterCursor}`;
              popup.style.display = 'none';
              el.focus();
            });
          });
          return;
        }
      }
      popup.style.display = 'none';
    });

    el.addEventListener('blur', () => {
      setTimeout(() => { popup.style.display = 'none'; }, 200);
    });
  });
}

// -------------------------------------------------------------
// 9. Búsqueda Global (Ctrl + K)
// -------------------------------------------------------------
function initGlobalSearch() {
  const trigger = document.getElementById('btn-search-trigger');
  const input = document.getElementById('global-search-input');
  const results = document.getElementById('global-search-results');

  trigger?.addEventListener('click', () => {
    openModal('modal-search');
    input?.focus();
  });

  input?.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (!q) {
      results.innerHTML = '';
      return;
    }

    const hits = [];

    // Buscar en atómicas
    (state.notes.atomica || []).forEach(a => {
      if (a.id.toLowerCase().includes(q) || (a.data.titulo && a.data.titulo.toLowerCase().includes(q)) || a.content.toLowerCase().includes(q)) {
        hits.push({ type: 'atomica', id: a.id, title: a.data.titulo || a.id, snippet: a.content.substring(0, 100) });
      }
    });

    // Buscar en fuentes
    (state.notes.fuente || []).forEach(f => {
      if (f.id.toLowerCase().includes(q) || (f.data.titulo && f.data.titulo.toLowerCase().includes(q)) || (f.data.autor && f.data.autor.toLowerCase().includes(q)) || f.content.toLowerCase().includes(q)) {
        hits.push({ type: 'fuente', id: f.id, title: f.data.titulo || f.id, snippet: f.data.autor || f.content.substring(0, 100) });
      }
    });

    // Buscar en mapas
    (state.notes.mapa || []).forEach(m => {
      if (m.id.toLowerCase().includes(q) || (m.data.titulo && m.data.titulo.toLowerCase().includes(q))) {
        hits.push({ type: 'mapa', id: m.id, title: m.data.titulo || m.id, snippet: ui('Mapa de contenido', 'Content map') });
      }
    });

    if (hits.length === 0) {
      results.innerHTML = `<span class="text-muted" style="padding: 12px;">${ui('No se encontraron notas coincidentes.', 'No matching notes found.')}</span>`;
      return;
    }

    results.innerHTML = hits.slice(0, 10).map(h => `
      <div class="search-result-item" onclick="openSearchResult('${h.type}', '${h.id}')">
        <div class="sr-title">
          <span class="card-type-tag" style="font-size: 10px;">${h.type}</span>
          ${escapeHtml(h.title)}
        </div>
        <div class="sr-snippet">${escapeHtml(h.snippet)}</div>
      </div>
    `).join('');
  });
}

window.openSearchResult = function(type, id) {
  closeModal('modal-search');
  if (type === 'atomica') openAtomicaModal(id);
  else if (type === 'fuente') openFuenteModal(id);
  else if (type === 'mapa') openMapaModal(id);
};

// -------------------------------------------------------------
// 10. Grafo de Conocimiento Interactivo (Física, Arrastre, Filtros)
// -------------------------------------------------------------
// 11. Atajos de Teclado
// -------------------------------------------------------------
function initKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openModal('modal-search');
      document.getElementById('global-search-input')?.focus();
      return;
    }

    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-dialog[open]').forEach(d => d.close());
      return;
    }

    if (state.currentView === 'repaso' && !isAnyModalOpen()) {
      if (e.code === 'Space' && !state.isAnswerRevealed) {
        e.preventDefault();
        revealAnswer();
      } else if (state.isAnswerRevealed && ['0', '1', '2', '3', '4', '5'].includes(e.key)) {
        e.preventDefault();
        gradeReview(e.key);
      }
    }
  });
}

function isAnyModalOpen() {
  return !!document.querySelector('.modal-dialog[open]');
}

// -------------------------------------------------------------
// Utilidades de Modales
// -------------------------------------------------------------
function initModalsAndForms() {
  document.querySelectorAll('.modal-dialog').forEach(d => {
    d.addEventListener('click', (e) => {
      const rect = d.getBoundingClientRect();
      const inDialog = (
        rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX && e.clientX <= rect.left + rect.width
      );
      if (!inDialog) d.close();
    });
  });
}

window.openModal = function(id) {
  if (id === 'modal-import-json' && typeof window.populateImportProjectSelect === 'function') {
    window.populateImportProjectSelect();
  }
  const modal = document.getElementById(id);
  if (modal && typeof modal.showModal === 'function') {
    modal.showModal();
  }
};

window.closeModal = function(id) {
  const modal = document.getElementById(id);
  if (modal && typeof modal.close === 'function') {
    modal.close();
  }
};

// -------------------------------------------------------------
// Guía de Iniciación y Registro de Usuario (Onboarding Guide)
// -------------------------------------------------------------
function initOnboarding() {
  const nameInput = document.getElementById('onboarding-name-input');
  nameInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onboardingNextStep();
    }
  });

  const btnOnbLangEs = document.getElementById('btn-onboarding-lang-es');
  const btnOnbLangEn = document.getElementById('btn-onboarding-lang-en');
  btnOnbLangEs?.addEventListener('click', () => setLanguage('es'));
  btnOnbLangEn?.addEventListener('click', () => setLanguage('en'));

  updateHeaderUserProfile();
  updateHomeUserGreeting();
}

function checkAutoOnboarding() {
  if (!state.userName && !localStorage.getItem('notesapp_user_name')) {
    setTimeout(() => {
      openOnboardingModal(1);
    }, 600);
  }
}

window.openOnboardingModal = function(step = 1) {
  const nameInput = document.getElementById('onboarding-name-input');
  if (nameInput) {
    nameInput.value = state.userName || '';
  }
  const feedback = document.getElementById('onboarding-name-feedback');
  if (feedback) {
    if (state.userName) {
      feedback.style.display = 'block';
      feedback.textContent = ui(`✓ Nombre registrado: ${state.userName}`, `✓ Registered name: ${state.userName}`);
    } else {
      feedback.style.display = 'none';
    }
  }
  setOnboardingStep(step);
  openModal('modal-onboarding');
  if (step === 1 && nameInput) {
    setTimeout(() => nameInput.focus(), 150);
  }
};

window.setOnboardingStep = function(step) {
  step = Math.max(1, Math.min(4, step));
  state.onboardingStep = step;

  // Actualizar tabs del stepper
  document.querySelectorAll('.onboarding-stepper .stepper-tab').forEach(tab => {
    const tabStep = parseInt(tab.getAttribute('data-step'), 10);
    tab.classList.toggle('active', tabStep === step);
  });

  // Mostrar panel correspondiente
  for (let i = 1; i <= 4; i++) {
    const panel = document.getElementById(`onboarding-step-${i}`);
    if (panel) panel.style.display = i === step ? 'block' : 'none';
  }

  // Controles de pie de modal
  const btnBack = document.getElementById('btn-onboarding-back');
  const nextLabel = document.getElementById('onboarding-next-label');

  if (btnBack) {
    btnBack.style.display = step > 1 ? 'inline-block' : 'none';
  }

  if (nextLabel) {
    if (step === 1) {
      nextLabel.textContent = ui("Guardar y Continuar ➔", "Save & Continue ➔");
    } else if (step === 4) {
      nextLabel.textContent = ui("¡Comenzar ahora! 🚀", "Start Now! 🚀");
    } else {
      nextLabel.textContent = ui("Continuar ➔", "Continue ➔");
    }
  }

  // Si estamos en el paso 4, actualizar nombre de felicitación
  if (step === 4) {
    const displayName = document.getElementById('onboarding-display-name');
    if (displayName) displayName.textContent = state.userName || ui("Usuario", "User");
    const congratsTitle = document.getElementById('onboarding-congrats-title');
    if (congratsTitle) {
      congratsTitle.textContent = state.userName 
        ? ui(`¡Todo listo, ${state.userName}!`, `You're all set, ${state.userName}!`)
        : ui("¡Todo listo para comenzar!", "You're all set!");
    }
  }
};

window.onboardingNextStep = function() {
  if (state.onboardingStep === 1) {
    const nameInput = document.getElementById('onboarding-name-input');
    const name = nameInput ? nameInput.value.trim() : '';
    if (!name) {
      showToast(ui("Por favor, introduce tu nombre o alias para registrarte.", "Please enter your name or alias to register."), 'warning');
      nameInput?.focus();
      return;
    }
    saveUserName(name);
    setOnboardingStep(2);
  } else if (state.onboardingStep < 4) {
    setOnboardingStep(state.onboardingStep + 1);
  } else {
    closeModal('modal-onboarding');
    switchView('inicio');
    showToast(ui(`¡Bienvenido/a a NotesApp, ${state.userName}!`, `Welcome to NotesApp, ${state.userName}!`), 'success');
  }
};

window.onboardingPrevStep = function() {
  if (state.onboardingStep > 1) {
    setOnboardingStep(state.onboardingStep - 1);
  }
};

window.saveUserName = function(name) {
  state.userName = (name || '').trim();
  localStorage.setItem('notesapp_user_name', state.userName);
  localStorage.setItem('notesapp_onboarding_completed', 'true');
  
  updateHeaderUserProfile();
  updateHomeUserGreeting();

  const feedback = document.getElementById('onboarding-name-feedback');
  if (feedback) {
    feedback.style.display = 'block';
    feedback.textContent = ui(`✓ Nombre registrado: ${state.userName}`, `✓ Registered name: ${state.userName}`);
  }

  showToast(ui(`✓ Nombre guardado: "${state.userName}"`, `✓ Name saved: "${state.userName}"`), 'success');
};

window.finishOnboarding = function(targetView) {
  closeModal('modal-onboarding');
  if (targetView === 'inicio') {
    switchView('inicio');
  } else if (targetView === 'atomica') {
    switchView('atomicas');
    openAtomicaModal();
  } else if (targetView === 'import') {
    openModal('modal-import-json');
  }
};

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// -------------------------------------------------------------
// 12. Ingesta e Importación JSON Categorizada (Copy-Paste / Archivo)
// -------------------------------------------------------------



function initJsonImport() {
  const triggerBtn = document.getElementById('btn-import-json-trigger');
  const textarea = document.getElementById('import-json-textarea');
  const statusEl = document.getElementById('import-json-status');
  const submitBtn = document.getElementById('btn-submit-import-json');
  const badgesBox = document.getElementById('import-detection-summary');
  const badgesList = document.getElementById('import-detection-badges');
  const promptPanel = document.getElementById('llm-prompt-panel');
  const promptTextarea = document.getElementById('llm-prompt-textarea');
  const togglePromptBtn = document.getElementById('btn-toggle-llm-prompt');
  const copyPromptBtn = document.getElementById('btn-copy-prompt-text');
  const pasteBtn = document.getElementById('btn-paste-json-clipboard');
  const triggerFileBtn = document.getElementById('btn-trigger-json-file');
  const fileInput = document.getElementById('input-import-json-file');
  const sampleBtn = document.getElementById('btn-load-sample-import');

  if (promptTextarea) {
    promptTextarea.value = getContextualLlmPrompt(currentPromptLang);
  }

  function populateImportProjectSelect() {
    const select = document.getElementById('import-scope-project-select');
    if (!select) return;
    const currentVal = select.value;
    const projects = state.projects || [];
    let html = `<option value="">${ui("(Automático / Crear o detectar del JSON)", "(Automatic / Create or detect from JSON)")}</option>`;
    projects.forEach(p => {
      const icon = p.tipo === 'curso' ? '🎓' : (p.tipo === 'noticias' ? '📰' : (p.tipo === 'investigacion' ? '🔬' : (p.tipo === 'libro' ? '📖' : (p.tipo === 'trabajo' ? '💼' : '🎯'))));
      html += `<option value="${escapeHtml(p.campo)}|${escapeHtml(p.proyecto)}">${icon} [${escapeHtml(p.campo)}] ${escapeHtml(p.proyecto)}</option>`;
    });
    select.innerHTML = html;
    if (state.activeField && state.activeProject) {
      select.value = `${state.activeField}|${state.activeProject}`;
    } else if (currentVal && projects.some(p => `${p.campo}|${p.proyecto}` === currentVal)) {
      select.value = currentVal;
    } else if (promptCustomConfig.selectedScope && projects.some(p => `${p.campo}|${p.proyecto}` === promptCustomConfig.selectedScope)) {
      select.value = promptCustomConfig.selectedScope;
    } else if (projects.length === 1) {
      select.value = `${projects[0].campo}|${projects[0].proyecto}`;
    }
    const campoInput = document.getElementById('import-scope-campo');
    if (campoInput) {
      if (select.value && select.value.includes('|')) {
        campoInput.value = select.value.split('|')[0];
      } else if (state.activeField) {
        campoInput.value = state.activeField;
      }
    }
    updateImportLessonPanel();
    updateStudioPromptText();
  }
  window.populateImportProjectSelect = populateImportProjectSelect;

  function updateImportLessonPanel() {
    const projSelect = document.getElementById('import-scope-project-select');
    const newProjPanel = document.getElementById('import-new-proj-panel');
    const newProjTipo = document.getElementById('import-new-proj-tipo');
    const lessonPanel = document.getElementById('import-course-lesson-panel');
    const lessonNumInput = document.getElementById('import-course-lesson-num');
    const countSpan = document.getElementById('import-course-existing-count');

    if (!lessonPanel) return;

    const isCreatingNew = (newProjPanel && newProjPanel.style.display !== 'none');
    if (isCreatingNew) {
      const isNewCourse = (newProjTipo?.value === 'curso');
      lessonPanel.style.display = isNewCourse ? 'block' : 'none';
      if (countSpan) countSpan.textContent = ui('(Nuevo curso - Lección 1)', '(New course - Lesson 1)');
      if (lessonNumInput && !lessonNumInput.value) lessonNumInput.value = '1';
      return;
    }

    const selectedVal = projSelect?.value;
    if (!selectedVal) {
      lessonPanel.style.display = 'none';
      return;
    }

    const [campo, proyecto] = selectedVal.split('|');
    const p = (state.projects || []).find(x => x.campo === campo && x.proyecto === proyecto);
    const isCourse = (p && (p.tipo === 'curso' || (!p.tipo && p.lecciones?.length)));

    if (isCourse) {
      lessonPanel.style.display = 'block';
      const existingLessons = p?.lecciones || [];
      const nextNum = existingLessons.length + 1;
      if (lessonNumInput) lessonNumInput.value = nextNum;
      if (countSpan) countSpan.textContent = `${existingLessons.length} ${ui('lecciones registradas', 'lessons registered')}`;
    } else {
      lessonPanel.style.display = 'none';
    }
  }

  document.getElementById('import-scope-project-select')?.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val) {
      const [c] = val.split('|');
      const campoInput = document.getElementById('import-scope-campo');
      if (campoInput) campoInput.value = c;
    } else {
      const campoInput = document.getElementById('import-scope-campo');
      if (campoInput && !state.activeField) campoInput.value = '';
    }
    updateImportLessonPanel();
    updateStudioPromptText();
    validateAndPreviewJson();
  });

  document.getElementById('btn-import-toggle-new-proj')?.addEventListener('click', () => {
    const panel = document.getElementById('import-new-proj-panel');
    if (panel) {
      const isHidden = panel.style.display === 'none';
      panel.style.display = isHidden ? 'block' : 'none';
      const btn = document.getElementById('btn-import-toggle-new-proj');
      if (btn) btn.textContent = isHidden ? ui('✖ Ocultar', '✖ Hide') : ui('➕ Crear Nuevo Proyecto', '➕ Create New Project');
      updateImportLessonPanel();
      validateAndPreviewJson();
    }
  });

  document.getElementById('import-new-proj-tipo')?.addEventListener('change', () => {
    updateImportLessonPanel();
  });

  triggerBtn?.addEventListener('click', () => {
    populateImportProjectSelect();
    if (state.activeField && !document.getElementById('import-scope-campo').value) {
      document.getElementById('import-scope-campo').value = state.activeField;
    }
    if (state.activeField && state.activeProject) {
      const select = document.getElementById('import-scope-project-select');
      if (select) {
        select.value = `${state.activeField}|${state.activeProject}`;
        updateImportLessonPanel();
      }
    }
    updateStudioPromptText();
    openModal('modal-import-json');
    if (textarea) textarea.focus();
  });

  togglePromptBtn?.addEventListener('click', () => {
    if (promptPanel) {
      const isHidden = promptPanel.style.display === 'none';
      promptPanel.style.display = isHidden ? 'block' : 'none';
      if (isHidden) updateStudioPromptText();
      if (state.lang === 'en') {
        togglePromptBtn.textContent = isHidden ? '🔼 Hide LLM Prompt' : '🤖 View LLM Prompt';
      } else {
        togglePromptBtn.textContent = isHidden ? '🔼 Ocultar Prompt LLM' : '🤖 Ver Prompt para LLM';
      }
    }
  });

  copyPromptBtn?.addEventListener('click', async () => {
    const promptText = (promptTextarea && promptTextarea.value.trim()) ? promptTextarea.value : getContextualLlmPrompt(currentPromptLang);
    try {
      await navigator.clipboard.writeText(promptText);
      showToast(state.lang === 'en' ? 'Customized prompt copied to clipboard 📋' : 'Prompt personalizado copiado al portapapeles 📋', 'success');
    } catch (e) {
      if (promptTextarea) {
        promptTextarea.select();
        document.execCommand('copy');
        showToast(state.lang === 'en' ? 'Prompt copied to clipboard 📋' : 'Prompt copiado al portapapeles 📋', 'success');
      }
    }
  });

  pasteBtn?.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && textarea) {
        textarea.value = text;
        validateAndPreviewJson();
        showToast(state.lang === 'en' ? 'JSON pasted from clipboard' : 'JSON pegado desde el portapapeles', 'info');
      }
    } catch (e) {
      showToast(state.lang === 'en' ? 'Use Ctrl+V directly in the text area.' : 'Usa Ctrl+V directamente en el campo de texto.', 'warning');
      if (textarea) textarea.focus();
    }
  });

  triggerFileBtn?.addEventListener('click', () => {
    fileInput?.click();
  });

  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (textarea) {
          textarea.value = evt.target.result;
          validateAndPreviewJson();
          showToast(state.lang === 'en' ? `File "${file.name}" loaded` : `Archivo "${file.name}" cargado`, 'success');
        }
      };
      reader.readAsText(file);
    }
    fileInput.value = '';
  });

  sampleBtn?.addEventListener('click', async () => {
    try {
      const res = await apiFetch('/api/import/template');
      const data = await res.json();
      if (textarea && data.template) {
        textarea.value = JSON.stringify(data.template, null, 2);
        validateAndPreviewJson();
        showToast(state.lang === 'en' ? 'Sample template loaded' : 'Plantilla de ejemplo cargada', 'info');
      }
    } catch (e) {
      showToast(state.lang === 'en' ? 'Error loading sample template' : 'Error cargando plantilla de ejemplo', 'danger');
    }
  });

  function validateAndPreviewJson() {
    if (!textarea) return;
    const raw = textarea.value.trim();
    if (!raw) {
      if (statusEl) statusEl.textContent = '';
      if (badgesBox) badgesBox.style.display = 'none';
      if (submitBtn) submitBtn.disabled = true;
      return;
    }

    try {
      let cleaned = raw;
      const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        cleaned = jsonMatch[1].trim();
      }

      const obj = JSON.parse(cleaned);

      const rawFuentes = obj.notas_fuente || obj.source_notes || obj.sources;
      const rawAtomicas = obj.notas_atomicas || obj.atomic_notes || obj.atomics;
      const rawMapas = obj.mapas_contenido || obj.content_maps || obj.maps;
      const rawBandeja = obj.bandeja || obj.inbox;

      const fuentes = Array.isArray(rawFuentes) ? rawFuentes.length : 0;
      const atomicas = Array.isArray(rawAtomicas) ? rawAtomicas.length : 0;
      const preguntas = Array.isArray(rawAtomicas) ? rawAtomicas.filter(a => a && (a.autoevaluacion || a.pregunta_autoevaluacion || a.flashcard || a.self_assessment || a.pregunta || a.question)).length : 0;
      const mapas = Array.isArray(rawMapas) ? rawMapas.length : 0;
      const bandeja = Array.isArray(rawBandeja) ? rawBandeja.length : 0;

      const totalItems = fuentes + atomicas + mapas + bandeja;

      if (totalItems === 0) {
        if (statusEl) {
          statusEl.textContent = state.lang === 'en' ? '⚠️ Valid JSON but no recognizable notes' : '⚠️ JSON válido pero sin notas reconocidas';
          statusEl.style.color = 'var(--accent-warning)';
        }
        if (badgesBox) badgesBox.style.display = 'none';
        if (submitBtn) submitBtn.disabled = true;
        return;
      }

      if (statusEl) {
        statusEl.textContent = state.lang === 'en' ? '✓ Valid & structured JSON' : '✓ JSON válido y estructurado';
        statusEl.style.color = 'var(--accent-success)';
      }

      if (badgesBox && badgesList) {
        const allItems = [...(rawFuentes || []), ...(rawAtomicas || []), ...(rawMapas || [])];
        const firstWithCampo = allItems.find(x => x && (x.campo || x.field));
        const firstWithProj = allItems.find(x => x && (x.proyecto || x.project));
        const metaObj = obj.proyecto_meta || obj.project_meta || {};

        const detectedCampo = (obj.campo || obj.field || metaObj.campo || (firstWithCampo && (firstWithCampo.campo || firstWithCampo.field)) || '').trim();
        const detectedProj = (obj.proyecto || obj.project || metaObj.proyecto || metaObj.nombre || (firstWithProj && (firstWithProj.proyecto || firstWithProj.project)) || '').trim();
        const detectedTipo = (obj.proyecto_tipo || obj.tipo_proyecto || obj.proyectoTipo || obj.project_type || metaObj.tipo || 'curso').trim().toLowerCase();
        const detectedLec = obj.leccion_numero || obj.numero_leccion || obj.leccionNumero || obj.leccion || obj.lesson || '';

        const scopeSelect = document.getElementById('import-scope-project-select');
        const newProjPanel = document.getElementById('import-new-proj-panel');
        const isNewProj = Boolean(newProjPanel && newProjPanel.style.display !== 'none');

        let projectStatusBadge = '';
        if (!isNewProj && scopeSelect?.value && scopeSelect.value.includes('|')) {
          const [selC, selP] = scopeSelect.value.split('|');
          const selMatch = (state.projects || []).find(p => p.campo === selC && p.proyecto === selP);
          const priorNotes = selMatch?.stats?.atomicas || 0;
          const nextLec = detectedLec || (((selMatch?.lecciones || []).length) + 1);
          projectStatusBadge = `<span class="badge-detection" style="color:var(--accent-primary); font-weight:600;">🎯 ${ui('Destino seleccionado:', 'Selected target:')} [${escapeHtml(selC)}] ${escapeHtml(selP)}${selMatch?.tipo === 'curso' ? ` · ${ui('Lección', 'Lesson')} ${escapeHtml(String(nextLec))}` : ''} (${ui('se integrará con', 'will link with')} ${priorNotes} ${ui('notas previas', 'prior notes')})</span>`;
        } else if (detectedProj) {
          const detPSlug = slugifyClient(detectedProj);
          const existingMatch = (state.projects || []).find(p =>
            slugifyClient(p.proyecto) === detPSlug &&
            (!detectedCampo || slugifyClient(p.campo) === slugifyClient(detectedCampo))
          ) || (state.projects || []).find(p => slugifyClient(p.proyecto) === detPSlug);
          if (existingMatch) {
            const priorNotes = existingMatch.stats?.atomicas || 0;
            const nextLec = detectedLec || ((existingMatch.lecciones || []).length + 1);
            projectStatusBadge = `<span class="badge-detection" style="color:var(--accent-primary); font-weight:600;">🔗 ${ui('Proyecto existente:', 'Existing project:')} [${escapeHtml(existingMatch.campo)}] ${escapeHtml(existingMatch.proyecto)}${existingMatch.tipo === 'curso' ? ` · ${ui('Lección', 'Lesson')} ${escapeHtml(String(nextLec))}` : ''} (${ui('se conectará con', 'will link with')} ${priorNotes} ${ui('notas previas', 'prior notes')})</span>`;
          } else {
            const typeIcon = getProjectTypeIcon(detectedTipo);
            const typeLabel = getProjectTypeLabel(detectedTipo);
            projectStatusBadge = `<span class="badge-detection" style="color:var(--accent-success); font-weight:600;">✨ ${ui('Se creará el proyecto automáticamente:', 'Will auto-create project:')} [${escapeHtml(detectedCampo || 'General')}] ${escapeHtml(detectedProj)} (${typeIcon} ${escapeHtml(typeLabel)}${detectedLec ? ` · ${ui('Lección', 'Lesson')} ${escapeHtml(String(detectedLec))}` : ''})</span>`;
          }
        }

        badgesList.innerHTML = `
          ${fuentes > 0 ? `<span class="badge-detection" style="color:var(--accent-info);">📄 ${fuentes} ${state.lang === 'en' ? 'Source' : 'Fuente'}${fuentes > 1 ? 's' : ''}</span>` : ''}
          ${atomicas > 0 ? `<span class="badge-detection" style="color:var(--accent-success);">⚛️ ${atomicas} ${state.lang === 'en' ? 'Atomic' : 'Atómica'}${atomicas > 1 ? 's' : ''}</span>` : ''}
          ${preguntas > 0 ? `<span class="badge-detection" style="color:#f59e0b;">🎯 ${preguntas} Flashcard${preguntas > 1 ? 's' : ''} SM-2</span>` : ''}
          ${mapas > 0 ? `<span class="badge-detection" style="color:#8b5cf6;">🗺️ ${mapas} ${state.lang === 'en' ? 'Map' : 'Mapa'}${mapas > 1 ? 's' : ''}</span>` : ''}
          ${bandeja > 0 ? `<span class="badge-detection" style="color:var(--text-muted);">📥 ${bandeja} ${state.lang === 'en' ? 'Inbox' : 'Bandeja'}</span>` : ''}
          ${projectStatusBadge}
        `;
        badgesBox.style.display = 'block';
      }

      if (submitBtn) submitBtn.disabled = false;
    } catch (err) {
      if (statusEl) {
        statusEl.textContent = state.lang === 'en' ? '✕ JSON syntax error' : '✕ Error de sintaxis JSON';
        statusEl.style.color = 'var(--accent-danger)';
      }
      if (badgesBox) badgesBox.style.display = 'none';
      if (submitBtn) submitBtn.disabled = true;
    }
  }

  textarea?.addEventListener('input', validateAndPreviewJson);

  submitBtn?.addEventListener('click', async () => {
    if (!textarea) return;
    let raw = textarea.value.trim();
    if (!raw) return;

    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) raw = jsonMatch[1].trim();

    submitBtn.disabled = true;
    submitBtn.textContent = state.lang === 'en' ? 'Importing…' : 'Importando…';

    try {
      const scopeSelect = document.getElementById('import-scope-project-select');
      const newProjPanel = document.getElementById('import-new-proj-panel');
      const lessonPanel = document.getElementById('import-course-lesson-panel');
      const isNewProj = Boolean(newProjPanel && newProjPanel.style.display !== 'none');
      const isLessonPanelVisible = Boolean(lessonPanel && lessonPanel.style.display !== 'none');

      let importCampo = document.getElementById('import-scope-campo')?.value.trim() || '';
      let importProyecto = '';
      let importTipo = '';
      let importDesc = '';

      if (isNewProj) {
        importProyecto = document.getElementById('import-new-proj-nombre')?.value.trim() || '';
        importTipo = document.getElementById('import-new-proj-tipo')?.value.trim() || 'curso';
        importDesc = document.getElementById('import-new-proj-desc')?.value.trim() || '';
      } else if (scopeSelect?.value) {
        const parts = scopeSelect.value.split('|');
        importCampo = parts[0] || importCampo;
        importProyecto = parts[1] || '';
        const found = (state.projects || []).find(x => x.campo === parts[0] && x.proyecto === parts[1]);
        if (found) {
          importTipo = found.tipo || 'curso';
          importDesc = found.descripcion || '';
        }
      } else {
        // Modo automático: permitir que el backend detecte campo y proyecto directamente del JSON
        importCampo = '';
      }

      const importModulo = isLessonPanelVisible ? document.getElementById('import-course-modulo')?.value.trim() : undefined;
      const lessonNum = isLessonPanelVisible ? document.getElementById('import-course-lesson-num')?.value : undefined;
      const lessonTitle = isLessonPanelVisible ? document.getElementById('import-course-lesson-title')?.value.trim() : undefined;
      const cursoCompletado = isLessonPanelVisible ? document.getElementById('import-course-completed')?.checked : false;

      const importPayload = {
        json: raw,
        lang: state.lang,
        campo: importCampo || undefined,
        proyecto: importProyecto || undefined,
        proyectoTipo: importTipo || undefined,
        proyectoDescripcion: importDesc || undefined,
        modulo: importModulo || undefined,
        leccionNumero: lessonNum ? parseInt(lessonNum, 10) : undefined,
        leccionTitulo: lessonTitle || undefined,
        cursoCompletado: Boolean(cursoCompletado)
      };

      const res = await fetch(`/api/import/json?lang=${state.lang}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(importPayload)
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error en la importación');
      }

      const st = data.stats || {};
      const finalCampo = st.campo || importCampo;
      const finalProyecto = st.proyecto || importProyecto;
      const projMsg = st.proyecto_creado && finalProyecto
        ? `${ui(`✨ Proyecto "${finalProyecto}" creado`, `✨ Project "${finalProyecto}" created`)} · `
        : (finalProyecto ? `🎯 ${finalProyecto} · ` : '');
      const linksMsg = st.enlaces_inter_leccion > 0
        ? ` · 🔗 ${st.enlaces_inter_leccion} ${ui("conexiones", "links")}`
        : '';

      showToast(`${projMsg}${st.fuentes || 0} ${ui("fuentes", "sources")}, ${st.atomicas || 0} ${ui("atómicas", "atomic notes")}, ${st.preguntas || 0} flashcards, ${st.mapas || 0} ${ui("mapas", "maps")}${linksMsg}`, 'success');

      closeModal('modal-import-json');
      textarea.value = '';
      if (statusEl) statusEl.textContent = '';
      if (badgesBox) badgesBox.style.display = 'none';

      // Reset dynamic inputs
      const newNameInput = document.getElementById('import-new-proj-nombre');
      if (newNameInput) newNameInput.value = '';
      const newDescInput = document.getElementById('import-new-proj-desc');
      if (newDescInput) newDescInput.value = '';
      const lessonTitleInput = document.getElementById('import-course-lesson-title');
      if (lessonTitleInput) lessonTitleInput.value = '';
      if (isNewProj && newProjPanel) {
        newProjPanel.style.display = 'none';
        const toggleNewBtn = document.getElementById('btn-import-toggle-new-proj');
        if (toggleNewBtn) toggleNewBtn.textContent = ui('➕ Crear Nuevo Proyecto', '➕ Create New Project');
      }

      // Reset filters so newly imported notes are never hidden by previous folder/tag/type filters
      state.selectedAtomicaFolder = '';
      state.selectedFuenteFolder = '';
      state.selectedAtomicaTag = '';
      state.selectedFuenteTag = '';
      state.atomicaTypeFilter = 'all';
      state.fuenteTypeFilter = 'all';
      document.querySelectorAll('#atomica-type-pills-row .filter-chip-pill').forEach(p => {
        p.classList.toggle('active', p.getAttribute('data-filter') === 'all');
      });
      document.querySelectorAll('#fuente-type-pills-row .filter-chip-pill').forEach(p => {
        p.classList.toggle('active', p.getAttribute('data-type') === 'all');
      });

      await loadAllData();
      if (finalProyecto) {
        const matchedProj = (state.projects || []).find(p =>
          (p.proyecto === finalProyecto || slugifyClient(p.proyecto) === slugifyClient(finalProyecto)) &&
          (!finalCampo || p.campo === finalCampo || slugifyClient(p.campo) === slugifyClient(finalCampo))
        ) || (state.projects || []).find(p => p.proyecto === finalProyecto || slugifyClient(p.proyecto) === slugifyClient(finalProyecto));
        const targetC = matchedProj ? matchedProj.campo : (finalCampo || 'General');
        const targetP = matchedProj ? matchedProj.proyecto : finalProyecto;
        switchProjectScope(`proyecto:${targetC}|${targetP}`);
      } else if (finalCampo) {
        switchProjectScope(`campo:${finalCampo}`);
      } else {
        switchProjectScope('');
      }
      populateProjectScopeSelects();

      // Si el usuario importó desde el Asistente LLM o Guía, llevarlo a Inicio para ver las notas generadas al instante
      if (state.currentView === 'llm' || state.currentView === 'guia') {
        switchView('inicio');
      } else if (state.currentView === 'grafo') {
        if (typeof renderGraph === 'function') renderGraph();
      } else if (state.currentView === 'repaso') {
        loadReviewQueue();
      }
    } catch (err) {
      console.error(err);
      showToast(ui('Fallo al importar: ', 'Import failed: ') + err.message, 'danger');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = t('btnSubmitImport');
    }
  });
}
