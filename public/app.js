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
  selectedGraphType: null
};

// -------------------------------------------------------------
// Inicialización
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initLanguage();
  initLlmStudio();
  initNavigation();
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
  loadAllData();
});


// -------------------------------------------------------------
// Renderizador Markdown y Utilidades
// -------------------------------------------------------------
async function apiFetch(...args) {
  const response = await fetch(...args);
  if (!response.ok) throw new Error('Request failed: ' + response.status);
  return response;
}
function inlineArgument(value) {
  return escapeHtml(JSON.stringify(String(value)));
}
function ui(es, en) { return state.lang === 'en' ? en : es; }

function renderMarkdown(md) {
  if (!md) return '';
  let html = escapeHtml(md);

  // Wikilinks [[slug]] -> Badge interactivo clickeable (abre Preview-First)
  html = html.replace(/\[\[([a-zA-Z0-9_-]+)\]\]/g, (match, slug) => {
    return `<a href="#" class="wikilink-badge" onclick="event.preventDefault(); openReaderModal('atomica', '${slug}')">⚛️ ${slug}</a>`;
  });

  // Hashtags #tag -> Badge interactivo para filtrar
  html = html.replace(/(^|\s)#([a-zA-Z0-9_\u00C0-\u017F-]+)/g, (match, space, tag) => {
    return `${space}<span class="badge-hashtag" onclick="filterByTag('${tag}')">#${tag}</span>`;
  });

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Negrita y Cursiva
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Citas (Blockquotes)
  html = html.replace(/^\&gt;\s?(.*$)/gim, '<blockquote>$1</blockquote>');
  html = html.replace(/^\>\s?(.*$)/gim, '<blockquote>$1</blockquote>');

  // Listas desordenadas
  html = html.replace(/^\- (.*$)/gim, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

  // Bloques de código en línea
  html = html.replace(/`([^`]+)`/g, '<code style="background:var(--bg-card);padding:2px 6px;border-radius:4px;font-family:var(--font-mono);font-size:12px;">$1</code>');

  // Saltos de párrafo
  html = html.replace(/\n\n/g, '<br><br>');

  return html;
}

// -------------------------------------------------------------
// Gestión de Temas (Claro / Oscuro)
// -------------------------------------------------------------
function initTheme() {
  document.body.className = `theme-${state.theme}`;
  const icon = document.getElementById('theme-icon');
  if (icon) icon.textContent = state.theme === 'dark' ? '🌙' : '☀️';

  const toggleBtn = document.getElementById('theme-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      document.body.className = `theme-${state.theme}`;
      icon.textContent = state.theme === 'dark' ? '🌙' : '☀️';
      localStorage.setItem('alenotes_theme', state.theme);
      if (state.currentView === 'grafo') renderGraph();
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

  // Actualizar prompt en Prompt Studio y Modal
  updateStudioPromptText();

  if (reloadViews) {
    renderHomeView();
    renderInboxView();
    renderAtomicasView();
    renderFuentesView();
    renderMapasView();
    const selections = [...document.querySelectorAll('select')].map(el => [el, el.value]);
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
// Vista Inicio (Home View)
// -------------------------------------------------------------
function renderHomeView() {
  const atomicasCount = (state.notes.atomica || []).length;
  const fuentesCount = (state.notes.fuente || []).length;
  const mapasCount = (state.notes.mapa || []).length;
  const cardsCount = state.notes.preguntasCount || 0;
  
  const elAtomicas = document.getElementById('home-count-atomicas');
  const elFuentes = document.getElementById('home-count-fuentes');
  const elMapas = document.getElementById('home-count-mapas');
  const elCards = document.getElementById('home-count-cards');
  const elDue = document.getElementById('home-count-due');

  if (elAtomicas) elAtomicas.textContent = atomicasCount;
  if (elFuentes) elFuentes.textContent = fuentesCount;
  if (elMapas) elMapas.textContent = mapasCount;
  if (elCards) elCards.textContent = cardsCount;
  
  const headerDueCount = document.getElementById('header-due-count')?.textContent || '0';
  if (elDue) elDue.textContent = headerDueCount;
}

// -------------------------------------------------------------
// LLM Prompt Studio & Prompts
// -------------------------------------------------------------
let currentPromptLang = state.lang;

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
    const promptText = currentPromptLang === 'en' ? (window.MASTER_LLM_PROMPT_EN || '') : (window.MASTER_LLM_PROMPT_ES || '');
    try {
      await navigator.clipboard.writeText(promptText);
      showToast(state.lang === 'en' ? 'Master prompt copied to clipboard 📋' : 'Prompt maestro copiado al portapapeles 📋', 'success');
    } catch (e) {
      const ta = document.getElementById('studio-prompt-textarea');
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
  const promptText = currentPromptLang === 'en' ? (window.MASTER_LLM_PROMPT_EN || '') : (window.MASTER_LLM_PROMPT_ES || '');
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


// -------------------------------------------------------------
// Carga de Datos desde API
// -------------------------------------------------------------
// -------------------------------------------------------------
// Carga de Datos desde API (Notas y Carpetas)
// -------------------------------------------------------------
async function loadAllData() {
  try {
    const [notesRes, foldersRes] = await Promise.all([
      apiFetch('/api/notes'),
      apiFetch('/api/folders')
    ]);
    const data = await notesRes.json();
    const folderData = await foldersRes.json();
    state.notes = data;
    state.folders = folderData.folders || { atomica: [], fuente: [], mapa: [], bandeja: [] };

    updateBadges();
    populateFolderSelects();
    populateTagFilters();
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
    if (!nombre) {
      showToast(ui("Por favor escribe un nombre para la carpeta", "Please enter a folder name"), 'warning');
      return;
    }
    try {
      const res = await apiFetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, nombre })
      });
      if (res.ok) {
        closeModal('modal-create-folder');
        showToast(`📁 Carpeta "${nombre}" creada con éxito`, 'success');
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

window.openCreateFolderModal = function(tipo = 'atomica') {
  const tipoSelect = document.getElementById('new-folder-tipo');
  if (tipoSelect) tipoSelect.value = tipo;
  const nameInput = document.getElementById('new-folder-name');
  if (nameInput) nameInput.value = '';
  openModal('modal-create-folder');
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
window.openReaderModal = async function(tipo, id) {
  try {
    const res = await apiFetch(`/api/notes/${tipo}/${id}`);
    if (!res.ok) throw new Error(ui("Nota no encontrada", "Note not found"));
    const note = await res.json();

    const typeLabels = { atomica: t('navAtomicas'), fuente: t('navFuentes'), mapa: t('navMapas'), bandeja: t('navInbox') };
    const typeColors = { atomica: 'var(--accent-success)', fuente: 'var(--accent-info)', mapa: '#8b5cf6', bandeja: 'var(--text-muted)' };

    document.getElementById('reader-type-tag').textContent = typeLabels[tipo] || tipo;
    document.getElementById('reader-type-tag').style.color = typeColors[tipo] || 'var(--text-main)';

    const folderEl = document.getElementById('reader-folder-badge');
    if (note.data && note.data.carpeta) {
      folderEl.textContent = `📁 ${note.data.carpeta}`;
      folderEl.style.display = 'inline-flex';
    } else {
      folderEl.style.display = 'none';
    }

    document.getElementById('reader-date').textContent = (note.data && note.data.creado) || '';
    document.getElementById('reader-title').textContent = (note.data && note.data.titulo) || id;

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

      contentEl.innerHTML = `
        <div class="reader-map-container">
          <div class="reader-map-banner">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
              <div>
                <span class="reader-map-badge">${ui("🗺️ Organizador Conceptual de Conocimiento", "Conceptual knowledge organizer")}</span>
                <div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">
                  ${ui("Estructura jerárquica de síntesis según Kiewra et al. (1991). Cada subtema posee justificación relacional obligatoria.", "A hierarchical synthesis based on Kiewra et al. (1991). Each subtopic requires an explanation of its connection.")}
                </div>
              </div>
              <a href="/api/export/study-guide/${encodeURIComponent(id)}" download class="btn-primary" style="font-size:12px; padding:6px 14px; text-decoration:none; display:inline-flex; align-items:center; gap:6px;">
                ${ui("📥 Descargar Guía de Estudio (.md)", "Download study guide (.md)")}
              </a>
            </div>
          </div>

          ${markdownBody ? `<div class="reader-markdown-content" style="margin: 8px 0 14px 0;">${renderMarkdown(markdownBody)}</div>` : ''}

          <div class="reader-map-subtemas-section">
            <h3 style="font-size:15px; margin-bottom:12px; display:flex; align-items:center; gap:8px;">
              <span>${ui("📚 Subtemas Vinculados", "Linked subtopics")}</span>
              <span class="count-badge" style="background:#8b5cf6; color:white;">${subtemas.length}</span>
            </h3>
            <div class="reader-map-subtemas-grid">
              ${subtemas.map(s => `
                <div class="reader-subtema-card">
                  <div class="reader-subtema-header">
                    <a href="#" class="wikilink-badge" onclick="event.preventDefault(); openReaderModal('atomica', '${escapeHtml(s.nota_id)}')">
                      ⚛️ ${escapeHtml(s.titulo || s.nota_id)}
                    </a>
                    ${s.carpeta ? `<span class="badge-folder" style="font-size:11px;">📁 ${escapeHtml(s.carpeta)}</span>` : ''}
                  </div>
                  <div class="reader-subtema-reason">
                    <span class="reason-label">${ui("Por qué pertenece a este mapa (Kiewra et al. 1991):", "Why it belongs to this map (Kiewra et al. 1991):")}</span>
                    <span>${escapeHtml(s.razon || ui("Subtema estructurado", "Structured subtopic"))}</span>
                  </div>
                  ${s.idea ? `<div class="reader-subtema-idea"><strong>${ui("Idea central:", "Central idea:")}</strong> ${escapeHtml(s.idea)}</div>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
      qaCard.style.display = 'none';
    } else {
      contentEl.innerHTML = renderMarkdown(note.content || ui("(Sin contenido adicional)", "(No additional content)"));

      // Tarjeta de Autoevaluación para notas con pregunta
      if (note.pregunta && note.pregunta.pregunta) {
        qaCard.style.display = 'block';
        document.getElementById('reader-q-text').textContent = note.pregunta.pregunta;
        document.getElementById('reader-a-text').textContent = note.pregunta.respuesta || ui("(Sin respuesta)", "(No answer)");
        document.getElementById('reader-qa-stats').textContent = `Intervalo: ${note.pregunta.intervalo_dias || 1}d | Ease: ${note.pregunta.ease_factor || 2.5} | Repasos: ${(note.pregunta.historial || []).length}`;
      } else {
        qaCard.style.display = 'none';
      }
    }

    // Backlinks entrantes
    const backlinksBox = document.getElementById('reader-backlinks-box');
    const backlinksList = document.getElementById('reader-backlinks-list');
    if (note.backlinks && note.backlinks.length > 0) {
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
      <div class="card-snippet">${escapeHtml(item.content || ui("(Sin contenido)", "(No content)"))}</div>
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
        puntosClave: document.getElementById('proc-f-puntos').value.trim()
      };
    }
  }

  const atomicasData = [{
    titulo: aTitulo,
    idea: aIdea,
    porQueImporta: document.getElementById('proc-a-porque').value.trim(),
    comoSeConecta: document.getElementById('proc-a-conecta').value.trim(),
    pregunta: document.getElementById('proc-q-pregunta').value.trim(),
    respuesta: document.getElementById('proc-q-respuesta').value.trim()
  }];

  try {
    const res = await apiFetch('/api/inbox/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inboxId: state.activeInboxItem.id,
        fuenteData,
        atomicasData
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
function renderAtomicasView() {
  const container = document.getElementById('atomicas-list');
  if (!container) return;

  let items = state.notes.atomica || [];
  if (state.selectedAtomicaFolder) {
    items = items.filter(i => (i.data && i.data.carpeta) === state.selectedAtomicaFolder);
  }
  if (state.selectedAtomicaTag) {
    items = items.filter(i => i.data && Array.isArray(i.data.tags) && i.data.tags.includes(state.selectedAtomicaTag));
  }

  if (items.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-icon">⚛️</div>
        <h3>${ui("No hay notas atómicas que coincidan", "No matching atomic notes")}</h3>
        <p>${ui("Prueba cambiando el filtro de carpeta o hashtag, o crea una nueva nota atómica.", "Change the folder or tag filter, or create an atomic note.")}</p>
      </div>`;
    return;
  }

  container.innerHTML = items.map(item => {
    let ideaText = '';
    const match = item.content.match(/## Idea \(con mis palabras\)([\s\S]*?)(##|$)/);
    if (match) ideaText = match[1].trim();

    const hasQuestion = !!item.pregunta;
    const backlinksCount = (item.backlinks || []).length;
    const tags = Array.isArray(item.data.tags) ? item.data.tags : [];

    return `
      <div class="note-card" onclick="openReaderModal('atomica', '${item.id}')">
        <div class="card-top">
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <span class="card-type-tag" style="color: var(--accent-success);">${ui("Atómica", "Atomic")}</span>
            ${item.data.carpeta ? `<span class="badge-folder">📁 ${escapeHtml(item.data.carpeta)}</span>` : ''}
          </div>
          <span class="card-date">${item.data.creado || ''}</span>
        </div>
        <h3>${escapeHtml(item.data.titulo || item.id)}</h3>
        <div class="card-snippet">${escapeHtml(ideaText || item.content.substring(0, 140))}</div>
        ${tags.length > 0 ? `
          <div style="display:flex; gap:4px; flex-wrap:wrap; margin-bottom:10px;">
            ${tags.map(t => `<span class="badge-hashtag" onclick="event.stopPropagation(); filterByTag(${inlineArgument(t)})">#${escapeHtml(t)}</span>`).join('')}
          </div>
        ` : ''}
        <div class="card-footer">
          <div class="card-meta-pills">
            ${item.data.fuente ? `<span class="meta-pill">📖 ${escapeHtml(item.data.fuente)}</span>` : ''}
            <span class="meta-pill">${hasQuestion ? ui("🎯 Con pregunta", "Has question") : ui("⚠️ Sin pregunta", "No question")}</span>
            ${backlinksCount > 0 ? `<span class="meta-pill">🔗 ${backlinksCount} backlinks</span>` : ''}
          </div>
          <button class="btn-ghost" style="padding: 3px 8px; font-size: 11px; margin-left: auto;" onclick="event.stopPropagation(); openAtomicaModal('${item.id}')" title="${ui("Editar nota", "Edit note")}">
            ${ui("✏️ Editar", "Edit")}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

window.openNewAtomicaModal = function() {
  document.getElementById('modal-atomica-title').textContent = ui("Nueva Nota Atómica", "New atomic note");
  document.getElementById('atomica-edit-id').value = '';
  document.getElementById('atomica-titulo').value = '';
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
    document.getElementById('atomica-folder-select').value = note.data.carpeta || '';
    document.getElementById('atomica-tags-input').value = Array.isArray(note.data.tags) ? note.data.tags.map(t => `#${t}`).join(', ') : '';
    document.getElementById('atomica-fuente-select').value = note.data.fuente || '';

    // Extraer secciones de contenido
    const ideaMatch = note.content.match(/## Idea \(con mis palabras\)([\s\S]*?)(## ¿Por qué importa\?|$)/);
    const porqueMatch = note.content.match(/## ¿Por qué importa\?([\s\S]*?)(## ¿Cómo se conecta|$)/);
    const conectaMatch = note.content.match(/## ¿Cómo se conecta con lo que ya sé\?([\s\S]*?)$/);

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
        <span>Intervalo: <strong>${note.pregunta.intervalo_dias}d</strong></span> |
        <span>Próxima revisión: <strong>${note.pregunta.proxima_revision}</strong></span> |
        <span>Repasos: <strong>${(note.pregunta.historial || []).length}</strong></span>
      `;
    } else {
      document.getElementById('atomica-q-p').value = '';
      document.getElementById('atomica-q-r').value = '';
      document.getElementById('atomica-q-stats').innerHTML = '<span class="text-muted">Sin pregunta de autoevaluación asociada. Formula una para programar el repaso espaciado.</span>';
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

      const md = `# ${titulo}\n\n## Idea (con mis palabras)\n${idea}\n\n## ¿Por qué importa?\n${porque}\n\n## ¿Cómo se conecta con lo que ya sé?\n${conecta}\n\n---\n\n### Pregunta de Autoevaluación\n**P:** ${qP}\n\n**R:** ${qR}`;
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
  const content = `## Idea (con mis palabras)\n${idea}\n\n## ¿Por qué importa?\n${porque}\n\n## ¿Cómo se conecta con lo que ya sé?\n${conecta}\n`;

  const questionText = document.getElementById('atomica-q-p').value.trim();
  const answerText = document.getElementById('atomica-q-r').value.trim();
  if (Boolean(questionText) !== Boolean(answerText)) {
    showToast(ui('Completa la pregunta y la respuesta.', 'Complete both the question and answer.'), 'warning');
    return;
  }
  const payload = {
    tipo: 'atomica',
    data: {
      titulo,
      tipo: 'atomica',
      fuente,
      carpeta,
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

  let items = state.notes.fuente || [];
  if (state.selectedFuenteFolder) {
    items = items.filter(i => (i.data && i.data.carpeta) === state.selectedFuenteFolder);
  }
  if (state.selectedFuenteTag) {
    items = items.filter(i => i.data && Array.isArray(i.data.tags) && i.data.tags.includes(state.selectedFuenteTag));
  }

  if (items.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-icon">📚</div>
        <h3>${ui("No hay notas fuente que coincidan", "No matching source notes")}</h3>
        <p>${ui("Prueba cambiando el filtro de carpeta o hashtag, o crea una nueva nota fuente.", "Change the folder or tag filter, or create a source note.")}</p>
      </div>`;
    return;
  }

  container.innerHTML = items.map(item => {
    const ideas = Array.isArray(item.data.ideas_disparadas) ? item.data.ideas_disparadas : [];
    const tags = Array.isArray(item.data.tags) ? item.data.tags : [];
    return `
      <div class="note-card" onclick="openReaderModal('fuente', '${item.id}')">
        <div class="card-top">
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <span class="card-type-tag" style="color: var(--accent-info);">${escapeHtml(state.lang === 'en' ? ({articulo:'Article',libro:'Book',video:'Video',podcast:'Podcast',otro:'Other'}[item.data.tipo_fuente] || item.data.tipo_fuente || 'Source') : (item.data.tipo_fuente || 'Fuente'))}</span>
            ${item.data.carpeta ? `<span class="badge-folder">📁 ${escapeHtml(item.data.carpeta)}</span>` : ''}
          </div>
          <span class="card-date">${item.data.creado || ''}</span>
        </div>
        <h3>${escapeHtml(item.data.titulo || item.id)}</h3>
        <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">
          ${escapeHtml(item.data.autor || ui("Sin autor especificado", "No author specified"))}
        </div>
        <div class="card-snippet">${escapeHtml(item.content.substring(0, 140))}</div>
        ${tags.length > 0 ? `
          <div style="display:flex; gap:4px; flex-wrap:wrap; margin-bottom:10px;">
            ${tags.map(t => `<span class="badge-hashtag" onclick="event.stopPropagation(); filterByTag(${inlineArgument(t)})">#${escapeHtml(t)}</span>`).join('')}
          </div>
        ` : ''}
        <div class="card-footer">
          <span class="meta-pill">💡 ${ideas.length} ${ui("ideas disparadas", "inspired ideas")}</span>
          <button class="btn-ghost" style="padding: 3px 8px; font-size: 11px; margin-left: auto;" onclick="event.stopPropagation(); openFuenteModal('${item.id}')" title="${ui("Editar fuente", "Edit source")}">
            ${ui("✏️ Editar", "Edit")}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

window.openNewFuenteModal = function() {
  document.getElementById('modal-fuente-title').textContent = ui("Nueva Nota Fuente", "New source note");
  document.getElementById('fuente-edit-id').value = '';
  document.getElementById('fuente-titulo').value = '';
  document.getElementById('fuente-autor').value = '';
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
    document.getElementById('fuente-folder-select').value = note.data.carpeta || '';
    document.getElementById('fuente-tags-input').value = Array.isArray(note.data.tags) ? note.data.tags.map(t => `#${t}`).join(', ') : '';
    document.getElementById('fuente-tipo-select').value = note.data.tipo_fuente || 'articulo';

    const puntosMatch = note.content.match(/## Puntos clave \(parafraseados, no copiados\)([\s\S]*?)(## Ideas propias|$)/);
    document.getElementById('fuente-puntos').value = puntosMatch ? puntosMatch[1].trim() : note.content;

    const ideas = Array.isArray(note.data.ideas_disparadas) ? note.data.ideas_disparadas : [];
    const ideasContainer = document.getElementById('fuente-ideas-container');
    if (ideas.length > 0) {
      ideasContainer.innerHTML = ideas.map(i => `<span class="meta-pill">💡 [[${i}]]</span>`).join(' ');
    } else {
      ideasContainer.innerHTML = '<span class="text-muted">Ninguna idea disparada registrada.</span>';
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

  let content = `## Puntos clave (parafraseados, no copiados)\n${puntos}\n\n## Ideas propias que dispara\n`;
  ideas_disparadas.forEach(i => {
    content += `- [[${i}]]\n`;
  });

  const payload = {
    tipo: 'fuente',
    data: {
      titulo,
      autor,
      tipo_fuente,
      tipo: 'fuente',
      carpeta,
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
      listContainer.style.display = 'grid';
      renderMapasCards();
    }
  }
}

function renderMapasCards() {
  const container = document.getElementById('mapas-list');
  if (!container) return;

  const items = state.notes.mapa || [];
  if (items.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-icon">🗺️</div>
        <h3>${ui("No hay mapas de contenido todavía", "No content maps yet")}</h3>
        <p>${ui("Crea mapas temáticos estructurados con relaciones justificadas.", "Create thematic maps with explained connections.")}</p>
      </div>`;
    return;
  }

  const atomicTitleMap = {};
  (state.notes.atomica || []).forEach(a => { atomicTitleMap[a.id] = a.data.titulo || a.id; });

  container.innerHTML = items.map(m => {
    const subtemas = Array.isArray(m.data.subtemas) ? m.data.subtemas : [];
    return `
      <div class="mapa-card" onclick="openReaderModal('mapa', '${m.id}')" style="cursor: pointer;">
        <div class="card-top">
          <span class="card-type-tag" style="color: #8b5cf6;">${ui("Mapa", "Map")}</span>
          <span class="card-date">${m.data.creado || ''}</span>
        </div>
        <h3>${escapeHtml(m.data.titulo || m.id)}</h3>
        <div class="subtemas-outline">
          ${subtemas.map(s => `
            <div class="subtema-item" onclick="event.stopPropagation(); openReaderModal('atomica', '${s.nota_id}')" style="cursor: pointer;" title="${ui("Ver vista previa de la nota atómica", "Preview atomic note")}">
              <div class="subtema-title">⚛️ ${escapeHtml(atomicTitleMap[s.nota_id] || s.nota_id)}</div>
              <div class="subtema-reason">"${escapeHtml(s.razon || ui("Sin justificación", "No reason provided"))}"</div>
            </div>
          `).join('')}
        </div>
        <div class="card-footer">
          <button class="btn-ghost" style="padding: 4px 10px; font-size: 12px;" onclick="event.stopPropagation(); openMapaModal('${m.id}')">
            ${ui("✏️ Editar Mapa", "Edit map")}
          </button>
          <a href="/api/export/study-guide/${m.id}" download class="btn-export-guide" title="${ui("Descargar guía de estudio en Markdown", "Download Markdown study guide")}" onclick="event.stopPropagation();">
            ${ui("📥 Guía .md", "Study guide .md")}
          </a>
        </div>
      </div>
    `;
  }).join('');
}

function renderMapasMatrix() {
  const container = document.getElementById('mapas-matrix-container');
  if (!container) return;

  const mapas = state.notes.mapa || [];
  const atomicNotes = state.notes.atomica || [];
  const atomicMap = {};
  atomicNotes.forEach(a => { atomicMap[a.id] = a; });

  if (mapas.length === 0) {
    container.innerHTML = `<div class="empty-state">${ui("No hay mapas creados todavía.", "No maps yet.")}</div>`;
    return;
  }

  let html = '';
  mapas.forEach(m => {
    const subtemas = Array.isArray(m.data.subtemas) ? m.data.subtemas : [];
    html += `
      <div style="margin-bottom: 30px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h3 style="font-size:17px; font-weight:700;">🗺️ ${escapeHtml(m.data.titulo || m.id)}</h3>
          <a href="/api/export/study-guide/${m.id}" download class="btn-export-guide" title="${ui("Descargar guía de estudio en Markdown", "Download Markdown study guide")}">
            ${ui("📥 Descargar Guía de Estudio (.md)", "Download study guide (.md)")}
          </a>
        </div>
        <table class="matrix-table">
          <thead>
            <tr>
              <th style="width: 25%;">${ui("Subtema Atómico", "Atomic subtopic")}</th>
              <th style="width: 35%;">${ui("Razón de Conexión (Kiewra et al. 1991)", "Connection reason (Kiewra et al. 1991)")}</th>
              <th style="width: 30%;">${ui("Idea Principal", "Main idea")}</th>
              <th style="width: 10%;">${ui("Acción", "Action")}</th>
            </tr>
          </thead>
          <tbody>
    `;

    if (subtemas.length === 0) {
      html += `<tr><td colspan="4" class="text-muted" style="text-align:center;">${ui("Sin subtemas enlazados aún.", "No linked subtopics yet.")}</td></tr>`;
    } else {
      subtemas.forEach(s => {
        const a = atomicMap[s.nota_id];
        const title = a ? (a.data.titulo || s.nota_id) : s.nota_id;
        let ideaSnippet = '';
        if (a) {
          const match = a.content.match(/## Idea \(con mis palabras\)([\s\S]*?)(##|$)/);
          ideaSnippet = match ? match[1].trim() : a.content.substring(0, 100);
        }
        html += `
          <tr>
            <td>
              <a href="#" class="wikilink-badge" onclick="event.preventDefault(); openReaderModal('atomica', '${escapeHtml(s.nota_id)}')">
                ⚛️ ${escapeHtml(title)}
              </a>
            </td>
            <td><em style="color:var(--accent-primary);">"${escapeHtml(s.razon)}"</em></td>
            <td style="font-size:12px; color:var(--text-secondary);">${escapeHtml(ideaSnippet || '—')}</td>
            <td>
              <button class="btn-ghost" style="padding:3px 8px; font-size:11px;" onclick="openReaderModal('atomica', '${escapeHtml(s.nota_id)}')">${ui("Ver", "View")}</button>
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
          Razón: <em>${escapeHtml(s.razon)}</em>
        </div>
      </div>
      <button type="button" class="btn-remove-sub" onclick="removeSubtema(${idx})" title="Quitar de este mapa">✕</button>
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

  // REGLA CIENTÍFICA ESTRICTA: Razón obligatoria
  if (!razon) {
    showToast(ui("⚠️ REGLA DE NEGOCIO: Enlazar una nota exige explicar la razón de la relación (Kiewra et al. 1991).", "Explain the reason for linking this note (Kiewra et al. 1991)."), 'danger');
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

  const payload = {
    tipo: 'mapa',
    data: {
      titulo,
      tipo: 'mapa',
      subtemas: state.activeMapSubtemas
    },
    ...(id ? {} : { content: '' })
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
    const res = await apiFetch('/api/reviews/queue' + (practiceAll ? '?all=true' : ''));
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

  if (!state.reviewQueue || state.reviewQueue.length === 0 || state.currentReviewIndex >= state.reviewQueue.length) {
    if (card) card.style.display = 'none';
    if (empty) {
      empty.style.display = 'block';
      const noCards = !state.notes.preguntasCount;
      empty.querySelector('h3').textContent = noCards ? ui('Todavía no hay tarjetas', 'No flashcards yet') : ui('No quedan tarjetas pendientes', 'No cards left to review');
      empty.querySelector('p').textContent = noCards ? ui('Añade una pregunta y una respuesta a una nota atómica para empezar.', 'Add a question and answer to an atomic note to start reviewing.') : ui('Vuelve más tarde o practica todas tus tarjetas.', 'Come back later or practice all your cards.');
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
  if (statusText) {
    statusText.textContent = `${ui("Tarjeta", "Card")} ${currentNum} / ${total} (${state.practiceAll ? ui("Práctica", "Practice") : ui("Pendientes hoy", "Due today")}: ${total - state.currentReviewIndex})`;
  }

  document.getElementById('fc-tema').textContent = `${ui("Tema", "Topic")}: ${item.tema || 'General'}`;
  document.getElementById('fc-interval').textContent = `${ui("Intervalo actual", "Current interval")}: ${item.intervalo_dias || 1}d (Ease: ${item.ease_factor || 2.5})`;
  document.getElementById('fc-question').textContent = item.pregunta || ui("(Pregunta no definida)", "(No question defined)");
  document.getElementById('fc-answer').textContent = item.respuesta || ui("(Respuesta no definida)", "(No answer defined)");
  document.getElementById('fc-origin').innerHTML = item.nota_id ? `${ui("Nota origen", "Source note")}: <a href="#" onclick="openAtomicaModal('${item.nota_id}')">[[${item.nota_id}]]</a>` : '';

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
        hits.push({ type: 'mapa', id: m.id, title: m.data.titulo || m.id, snippet: 'Mapa de contenido' });
      }
    });

    if (hits.length === 0) {
      results.innerHTML = '<span class="text-muted" style="padding: 12px;">No se encontraron notas coincidentes.</span>';
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
    promptTextarea.value = currentPromptLang === 'en' ? (window.MASTER_LLM_PROMPT_EN || '') : (window.MASTER_LLM_PROMPT_ES || '');
  }

  triggerBtn?.addEventListener('click', () => {
    openModal('modal-import-json');
    if (textarea) textarea.focus();
  });

  togglePromptBtn?.addEventListener('click', () => {
    if (promptPanel) {
      const isHidden = promptPanel.style.display === 'none';
      promptPanel.style.display = isHidden ? 'block' : 'none';
      if (state.lang === 'en') {
        togglePromptBtn.textContent = isHidden ? '🔼 Hide LLM Prompt' : '🤖 View LLM Prompt';
      } else {
        togglePromptBtn.textContent = isHidden ? '🔼 Ocultar Prompt LLM' : '🤖 Ver Prompt para LLM';
      }
    }
  });

  copyPromptBtn?.addEventListener('click', async () => {
    const promptText = currentPromptLang === 'en' ? (window.MASTER_LLM_PROMPT_EN || '') : (window.MASTER_LLM_PROMPT_ES || '');
    try {
      await navigator.clipboard.writeText(promptText);
      showToast(state.lang === 'en' ? 'Prompt copied to clipboard 📋' : 'Prompt maestro copiado al portapapeles 📋', 'success');
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

      const fuentes = Array.isArray(obj.notas_fuente) ? obj.notas_fuente.length : 0;
      const atomicas = Array.isArray(obj.notas_atomicas) ? obj.notas_atomicas.length : 0;
      const preguntas = Array.isArray(obj.notas_atomicas) ? obj.notas_atomicas.filter(a => a && (a.autoevaluacion || a.pregunta)).length : 0;
      const mapas = Array.isArray(obj.mapas_contenido) ? obj.mapas_contenido.length : 0;
      const bandeja = Array.isArray(obj.bandeja) ? obj.bandeja.length : 0;

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
        badgesList.innerHTML = `
          ${fuentes > 0 ? `<span class="badge-detection" style="color:var(--accent-info);">📄 ${fuentes} ${state.lang === 'en' ? 'Source' : 'Fuente'}${fuentes > 1 ? (state.lang === 'en' ? 's' : 's') : ''}</span>` : ''}
          ${atomicas > 0 ? `<span class="badge-detection" style="color:var(--accent-success);">⚛️ ${atomicas} ${state.lang === 'en' ? 'Atomic' : 'Atómica'}${atomicas > 1 ? (state.lang === 'en' ? 's' : 's') : ''}</span>` : ''}
          ${preguntas > 0 ? `<span class="badge-detection" style="color:#f59e0b;">🎯 ${preguntas} Flashcard${preguntas > 1 ? 's' : ''} SM-2</span>` : ''}
          ${mapas > 0 ? `<span class="badge-detection" style="color:#8b5cf6;">🗺️ ${mapas} ${state.lang === 'en' ? 'Map' : 'Mapa'}${mapas > 1 ? (state.lang === 'en' ? 's' : 's') : ''}</span>` : ''}
          ${bandeja > 0 ? `<span class="badge-detection" style="color:var(--text-muted);">📥 ${bandeja} ${state.lang === 'en' ? 'Inbox' : 'Bandeja'}</span>` : ''}
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
      const res = await apiFetch('/api/import/json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json: raw })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error en la importación');
      }

      const st = data.stats || {};
      showToast(`${ui("Importación completada", "Import complete")}: ${st.fuentes || 0} ${ui("fuentes", "sources")}, ${st.atomicas || 0} ${ui("atómicas", "atomic notes")}, ${st.preguntas || 0} flashcards, ${st.mapas || 0} ${ui("mapas", "maps")}`, 'success');

      closeModal('modal-import-json');
      textarea.value = '';
      if (statusEl) statusEl.textContent = '';
      if (badgesBox) badgesBox.style.display = 'none';

      await loadAllData();
    } catch (err) {
      console.error(err);
      showToast(ui('Fallo al importar: ', 'Import failed: ') + err.message, 'danger');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = t('btnSubmitImport');
    }
  });
}
