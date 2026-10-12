const express = require('express');
const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const app = express();
const PORT = process.env.PORT || 3456;
const ROOT_DIR = process.env.NOTESAPP_DATA_DIR || __dirname;

// Directorios del sistema
const DIRS = Object.assign(Object.create(null), {
  bandeja: path.join(ROOT_DIR, '01-inbox'),
  fuente: path.join(ROOT_DIR, '02-source-notes'),
  atomica: path.join(ROOT_DIR, '03-atomic-notes'),
  mapa: path.join(ROOT_DIR, '04-content-maps'),
  pregunta: path.join(ROOT_DIR, '05-self-assessment'),
  repaso: path.join(ROOT_DIR, '06-spaced-repetition'),
  plantillas: path.join(ROOT_DIR, '_templates')
});

// Asegurar que existan todos los directorios
Object.values(DIRS).forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Local application: reject cross-origin access to the writable API.
app.use('/api', (req, res, next) => {
 res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
 res.setHeader('Pragma', 'no-cache');
 res.setHeader('Expires', '0');
 const origin=req.get('origin');
 if(!['localhost','127.0.0.1','[::1]'].includes(req.hostname)) return res.status(403).json({error:'Local access only'});
 if(origin && origin !== 'http://' + req.get('host')) return res.status(403).json({error:'Cross-origin requests are not allowed'});
 next();
});
app.use(express.json({ limit: '10mb' }));
// Reject unsafe path components before any filesystem operation.
app.use('/api', (req, res, next) => {
  const unsafePath = value => typeof value === 'string' && (value.includes('\\') || value.includes(':') || value.includes('\0') || value.startsWith('/') || value.split('/').includes('..'));
  const unsafeScope = value => typeof value === 'string' && (value.includes('\\') || value.includes('\0') || value.startsWith('/') || value.split('/').includes('..'));
  const inspect = value => value && typeof value === 'object' && Object.entries(value).some(([key, child]) =>
    (['id', 'inboxId', 'preguntaId', 'nota_id', 'carpeta', 'parentFolder', 'oldPath', 'newPath', 'folderPath', 'targetParent', 'newName'].includes(key) && unsafePath(child)) ||
    (['campo', 'proyecto'].includes(key) && unsafeScope(child)) ||
    inspect(child));
  let pathname;
  try { pathname = decodeURIComponent(req.path); } catch { return res.status(400).json({ error: 'Invalid path' }); }
  if (inspect(req.body) || pathname.includes('\\') || pathname.includes('..') || pathname.includes(':')) return res.status(400).json({ error: 'Invalid path' });
  next();
});
app.use('/api', (req,res,next) => {
 const validText = (obj,key) => obj[key] === undefined || obj[key] === null || typeof obj[key] === 'string';
 const validTextOrStringArray = (obj,key) => validText(obj,key) || (Array.isArray(obj[key]) && obj[key].every(v => typeof v === 'string'));
 const inspect = obj => {
  if(!obj || typeof obj!=='object') return true;
  for(const [key,value] of Object.entries(obj)) {
   if(['titulo','autor','idea','contenido','content','carpeta','parentFolder','folderName','nombre','fuente','tipo_fuente','descripcion','razon','campo','proyecto','oldPath','newPath','folderPath','targetParent','newName','color','modulo','leccion_titulo','tipo_mapa'].includes(key) && !validText(obj,key)) return false;
   if(['puntos_clave','puntosClave','key_points'].includes(key) && !validTextOrStringArray(obj,key)) return false;
   if(['id','inboxId','preguntaId','nota_id'].includes(key) && (typeof value!=='string'||!/^[a-zA-Z0-9_-]+$/.test(value))) return false;
   if(['subtemas','tags','enlaces','ideas_disparadas'].includes(key) && !Array.isArray(value)) return false;
   if(['tags','enlaces','ideas_disparadas'].includes(key) && value.some(v=>typeof v!=='string')) return false;
   if(!inspect(value))return false;
  } return true;
 };
 if(!inspect(req.body)) return res.status(400).json({error:'Invalid field type or identifier'});
 if(req.body?.tipo) {
  const allowedTipos = (req.path.startsWith('/projects') || req.path.startsWith('/import'))
   ? ['curso','noticias','investigacion','libro','trabajo','otro','bandeja','fuente','atomica','mapa']
   : ['bandeja','fuente','atomica','mapa'];
  if(!allowedTipos.includes(req.body.tipo)) return res.status(400).json({error:'Invalid note type'});
 }
 next();
});
app.use(express.static(path.join(__dirname, 'public')));

// -------------------------------------------------------------
// Utilidades de Archivos y Markdown
// -------------------------------------------------------------

function slugify(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'nota-' + Date.now();
}

function getTodayString() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function normalizeDate(val) {
  if (!val) return '';
  if (val instanceof Date) {
    const yyyy = val.getFullYear();
    const mm = String(val.getMonth() + 1).padStart(2, '0');
    const dd = String(val.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return String(val).trim();
}

function parseMarkdownFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = matter(raw);
    const fileName = path.basename(filePath, '.md');
    const data = parsed.data || {};
    if (data.creado) data.creado = normalizeDate(data.creado);
    if (data.proxima_revision) data.proxima_revision = normalizeDate(data.proxima_revision);
    if (data.ultimo_repaso) data.ultimo_repaso = normalizeDate(data.ultimo_repaso);
    if (data.generado) data.generado = normalizeDate(data.generado);
    return {
      fileName,
      filePath,
      data,
      content: parsed.content || '',
      raw
    };
  } catch (err) {
    console.error(`Error leyendo ${filePath}:`, err.message);
    return null;
  }
}

function saveMarkdownFile(filePath, data, content) {
  const cleanData = JSON.parse(JSON.stringify(data || {}));
  const output = matter.stringify((content || '').trim() + '\n', cleanData);
  const temporary = filePath + '.' + randomUUID() + '.tmp';
  try { fs.writeFileSync(temporary, output, {encoding:'utf-8',flag:'wx'}); fs.renameSync(temporary,filePath); }
  finally { if(fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}

// -------------------------------------------------------------
// Utilidades de Carpetas y Hashtags (#tags)
// -------------------------------------------------------------

function extractTags(data, content) {
  const tagsSet = new Set();
  if (Array.isArray(data.tags)) {
    data.tags.forEach(t => {
      if (t) tagsSet.add(String(t).replace(/^#/, '').toLowerCase().trim());
    });
  } else if (typeof data.tags === 'string') {
    data.tags.split(/[,;\s]+/).forEach(t => {
      if (t) tagsSet.add(t.replace(/^#/, '').toLowerCase().trim());
    });
  }

  // Extraer #hashtags del markdown (descartando encabezados tipo # Título)
  if (content) {
    const matches = content.match(/(?:^|\s)#([a-zA-Z0-9_\u00C0-\u017F-]+)/g) || [];
    matches.forEach(m => {
      const tag = m.trim().replace(/^#/, '').toLowerCase();
      if (tag && !/^\d+$/.test(tag)) {
        tagsSet.add(tag);
      }
    });
  }
  return Array.from(tagsSet);
}

function getFilesRecursively(baseDir, currentSubDir = '') {
  const dirPath = path.join(baseDir, currentSubDir);
  if (!fs.existsSync(dirPath)) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  let results = [];

  for (const entry of entries) {
    const rel = currentSubDir ? path.join(currentSubDir, entry.name) : entry.name;
    if (entry.isDirectory()) {
      results = results.concat(getFilesRecursively(baseDir, rel));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push({
        fileName: path.basename(entry.name, '.md'),
        fullPath: path.join(baseDir, rel),
        subfolder: currentSubDir.replace(/\\/g, '/')
      });
    }
  }
  return results;
}

function findNoteFilePath(tipo, id) {
  const dir = DIRS[tipo];
  if (!dir) return null;
  const files = getFilesRecursively(dir);
  const found = files.find(f => f.fileName === id);
  return found ? found.fullPath : null;
}

// -------------------------------------------------------------
// Gestión de Metadatos de Campos y Proyectos
// -------------------------------------------------------------
const PROJECTS_METADATA_FILE = path.join(DIRS.repaso, 'proyectos.json');

function readProjectsMetadata() {
  try {
    if (fs.existsSync(PROJECTS_METADATA_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(PROJECTS_METADATA_FILE, 'utf-8'));
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (err) {
    console.error('Error leyendo proyectos.json:', err.message);
  }
  return { campos: {} };
}

function saveProjectsMetadata(meta) {
  try {
    const tmp = PROJECTS_METADATA_FILE + '.' + randomUUID() + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(meta, null, 2), 'utf-8');
    fs.renameSync(tmp, PROJECTS_METADATA_FILE);
  } catch (err) {
    console.error('Error guardando proyectos.json:', err.message);
  }
}

// -------------------------------------------------------------
// Gestión de Metadatos de Carpetas (Colores y Organización)
// -------------------------------------------------------------
const FOLDERS_METADATA_FILE = path.join(DIRS.repaso, 'carpetas.json');

function readFoldersMetadata() {
  try {
    if (fs.existsSync(FOLDERS_METADATA_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(FOLDERS_METADATA_FILE, 'utf-8'));
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (err) {
    console.error('Error leyendo carpetas.json:', err.message);
  }
  return { atomica: {}, fuente: {}, mapa: {}, bandeja: {} };
}

function saveFoldersMetadata(meta) {
  try {
    const tmp = FOLDERS_METADATA_FILE + '.' + randomUUID() + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(meta, null, 2), 'utf-8');
    fs.renameSync(tmp, FOLDERS_METADATA_FILE);
  } catch (err) {
    console.error('Error guardando carpetas.json:', err.message);
  }
}

function updateNotesFolderOnRename(tipo, oldPath, newPath) {
  const dir = DIRS[tipo];
  if (!dir || !fs.existsSync(dir)) return;
  const files = getFilesRecursively(dir);
  for (const f of files) {
    const note = parseMarkdownFile(f.fullPath);
    if (!note || !note.data) continue;
    const currentFolder = note.data.carpeta || '';
    if (currentFolder === oldPath || currentFolder.startsWith(oldPath + '/')) {
      const updatedFolder = currentFolder === oldPath 
        ? newPath 
        : (newPath ? `${newPath}${currentFolder.slice(oldPath.length)}` : currentFolder.slice(oldPath.length + 1));
      note.data.carpeta = updatedFolder;
      saveMarkdownFile(f.fullPath, note.data, note.content || '');
    }
  }
}

function migrateFolderMetadata(tipo, oldPath, newPath) {
  const meta = readFoldersMetadata();
  if (!meta[tipo]) meta[tipo] = {};
  const newTipoMeta = {};
  for (const [k, v] of Object.entries(meta[tipo])) {
    if (k === oldPath) {
      if (newPath) newTipoMeta[newPath] = v;
    } else if (k.startsWith(oldPath + '/')) {
      if (newPath) {
        const sub = newPath + k.slice(oldPath.length);
        newTipoMeta[sub] = v;
      }
    } else {
      newTipoMeta[k] = v;
    }
  }
  meta[tipo] = newTipoMeta;
  saveFoldersMetadata(meta);
}

function humanizeSlug(slug) {
  if (!slug) return '';
  return String(slug)
    .split(/[-_]+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function resolveNoteFieldAndProject(data, subfolder = '') {
  let campo = (data && data.campo && typeof data.campo === 'string') ? data.campo.trim() : '';
  let proyecto = (data && data.proyecto && typeof data.proyecto === 'string') ? data.proyecto.trim() : '';

  const meta = readProjectsMetadata();
  if (!campo && (data.carpeta || subfolder)) {
    const rawFolder = (data.carpeta || subfolder).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const parts = rawFolder.split('/').filter(Boolean);
    if (parts.length >= 2) {
      const cSlug = slugify(parts[0]);
      const pSlug = slugify(parts[1]);
      campo = meta.campos?.[cSlug]?.nombre || humanizeSlug(parts[0]);
      proyecto = meta.campos?.[cSlug]?.proyectos?.[pSlug]?.nombre || humanizeSlug(parts.slice(1).join('/'));
    } else if (parts.length === 1) {
      const cSlug = slugify(parts[0]);
      if (meta.campos && meta.campos[cSlug]) {
        campo = meta.campos[cSlug].nombre || parts[0];
      }
    }
  }

  if (campo) {
    const cSlug = slugify(campo);
    if (meta.campos?.[cSlug]?.nombre) {
      campo = meta.campos[cSlug].nombre;
    }
    if (proyecto) {
      const pSlug = slugify(proyecto);
      if (meta.campos?.[cSlug]?.proyectos?.[pSlug]?.nombre) {
        proyecto = meta.campos[cSlug].proyectos[pSlug].nombre;
      }
    }
  }

  return { campo, proyecto };
}

// -------------------------------------------------------------
// Lectura de todas las notas por tipo (Soporte recursivo de carpetas y proyectos)
// -------------------------------------------------------------

function getAllNotesFromDir(tipo) {
  const dirPath = DIRS[tipo];
  if (!dirPath || !fs.existsSync(dirPath)) return [];
  const files = getFilesRecursively(dirPath);
  const list = [];
  for (const f of files) {
    const parsed = parseMarkdownFile(f.fullPath);
    if (parsed) {
      const tags = extractTags(parsed.data, parsed.content);
      parsed.data.tags = tags;
      parsed.data.carpeta = parsed.data.carpeta || f.subfolder || '';
      const { campo, proyecto } = resolveNoteFieldAndProject(parsed.data, f.subfolder);
      parsed.data.campo = campo;
      parsed.data.proyecto = proyecto;
      list.push({
        id: parsed.data.id || parsed.fileName,
        tipo,
        fileName: parsed.fileName,
        carpeta: parsed.data.carpeta,
        campo,
        proyecto,
        tags,
        data: parsed.data,
        content: parsed.content,
        filePath: f.fullPath
      });
    }
  }
  return list;
}

// Extraer preguntas asociadas de 05-self-assessment
function getAllQuestions() {
  const dirPath = DIRS.pregunta;
  if (!fs.existsSync(dirPath)) return [];
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'));
  const questions = [];
  for (const f of files) {
    const p = path.join(dirPath, f);
    const parsed = parseMarkdownFile(p);
    if (parsed) {
      // Extraer pregunta y respuesta del content (- P: ... \n - R: ...)
      let pText = '';
      let rText = '';
      const lines = parsed.content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('- P:') || trimmed.startsWith('- Q:')) {
          pText = trimmed.replace(/^- [PQ]:\s*/, '').trim();
        } else if (trimmed.startsWith('- R:') || trimmed.startsWith('- A:')) {
          rText = trimmed.replace(/^- [RA]:\s*/, '').trim();
        }
      }
      const proxRev = normalizeDate(parsed.data.proxima_revision) || getTodayString();
      questions.push({
        id: parsed.fileName,
        nota_id: parsed.data.nota_id,
        ease_factor: Number(parsed.data.ease_factor) || 2.5,
        intervalo_dias: Number(parsed.data.intervalo_dias) || 1,
        proxima_revision: proxRev,
        historial: Array.isArray(parsed.data.historial) ? parsed.data.historial : [],
        repeticiones: Number(parsed.data.repeticiones) || 0,
        pregunta: pText,
        respuesta: rText,
        rawContent: parsed.content,
        fileName: parsed.fileName
      });
    }
  }
  return questions;
}

// Cálculo de backlinks bidireccionales
function computeBacklinks() {
  const atomicNotes = getAllNotesFromDir('atomica');
  const sourceNotes = getAllNotesFromDir('fuente');
  const mapNotes = getAllNotesFromDir('mapa');

  const backlinksMap = {};
  atomicNotes.forEach(n => { backlinksMap[n.id] = []; });

  // 1. De otras notas atómicas (enlaces o mención [[id]])
  atomicNotes.forEach(note => {
    const wikilinks = (note.content.match(/\[\[([a-zA-Z0-9_-]+)\]\]/g) || []).map(m => m.replace(/\[\[|\]\]/g, ''));
    const explicitLinks = Array.isArray(note.data.enlaces) ? note.data.enlaces : [];
    const allRefs = new Set([...wikilinks, ...explicitLinks]);

    allRefs.forEach(targetId => {
      if (targetId !== note.id && backlinksMap[targetId]) {
        backlinksMap[targetId].push({
          sourceId: note.id,
          sourceTitle: note.data.titulo || note.id,
          sourceType: 'atomica',
          rel: 'enlace'
        });
      }
    });
  });

  // 2. De notas fuente (ideas_disparadas o wikilinks)
  sourceNotes.forEach(source => {
    const ideas = Array.isArray(source.data.ideas_disparadas) ? source.data.ideas_disparadas : [];
    const wikilinks = (source.content.match(/\[\[([a-zA-Z0-9_-]+)\]\]/g) || []).map(m => m.replace(/\[\[|\]\]/g, ''));
    const allRefs = new Set([...ideas, ...wikilinks]);

    allRefs.forEach(targetId => {
      if (backlinksMap[targetId]) {
        backlinksMap[targetId].push({
          sourceId: source.id,
          sourceTitle: source.data.titulo || source.id,
          sourceType: 'fuente',
          rel: 'fuente disparadora'
        });
      }
    });
  });

  // 3. De mapas de contenido (subtemas)
  mapNotes.forEach(mapNote => {
    const subtemas = Array.isArray(mapNote.data.subtemas) ? mapNote.data.subtemas : [];
    subtemas.forEach(sub => {
      if (sub && sub.nota_id && backlinksMap[sub.nota_id]) {
        backlinksMap[sub.nota_id].push({
          sourceId: mapNote.id,
          sourceTitle: mapNote.data.titulo || mapNote.id,
          sourceType: 'mapa',
          rel: 'subtema en mapa',
          razon: sub.razon || ''
        });
      }
    });
  });

  return backlinksMap;
}

// -------------------------------------------------------------
// Lógica de Repaso Espaciado: SM-2 e Interleaving
// -------------------------------------------------------------

function buildInterleavedQueue(practiceAll = false, filterCampo = null, filterProyecto = null) {
  const today = getTodayString();
  let questions = getAllQuestions();
  const maps = getAllNotesFromDir('mapa');
  const atomicas = getAllNotesFromDir('atomica');

  const atomicById = {};
  atomicas.forEach(a => { atomicById[a.id] = a; });

  if (filterCampo || filterProyecto) {
    const cSlug = filterCampo ? slugify(filterCampo) : null;
    const pSlug = filterProyecto ? slugify(filterProyecto) : null;
    questions = questions.filter(q => {
      const a = atomicById[q.nota_id];
      if (!a) return false;
      const aCampoSlug = a.campo ? slugify(a.campo) : (a.data.campo ? slugify(a.data.campo) : null);
      const aProySlug = a.proyecto ? slugify(a.proyecto) : (a.data.proyecto ? slugify(a.data.proyecto) : null);

      if (cSlug && aCampoSlug !== cSlug) return false;
      if (pSlug && aProySlug !== pSlug) return false;
      return true;
    });
  }

  // Mapear cada nota_id a un tema (nombre del mapa o primer tag/general)
  const noteTopicMap = {};
  maps.forEach(m => {
    const subtemas = Array.isArray(m.data.subtemas) ? m.data.subtemas : [];
    subtemas.forEach(s => {
      if (s && s.nota_id && !noteTopicMap[s.nota_id]) {
        noteTopicMap[s.nota_id] = m.id;
      }
    });
  });

  // Filtrar preguntas con proxima_revision <= today
  // (si la cola está vacía para hoy, mostrar las más próximas o todas para permitir práctica deliberada)
  let dueQuestions = questions.filter(q => q.proxima_revision <= today);
  const totalDue = dueQuestions.length;
  const isFuturePractice = practiceAll;
  if (practiceAll) {
    dueQuestions = [...questions].sort((a, b) => String(a.proxima_revision || '').localeCompare(String(b.proxima_revision || '')));
  }

  // Agrupar por tema
  const groups = {};
  dueQuestions.forEach(q => {
    const a = atomicById[q.nota_id];
    const tema = (a && a.proyecto) || noteTopicMap[q.nota_id] || (a && a.campo) || 'general';
    q.tema = tema;
    if (a) {
      q.campo = a.campo || '';
      q.proyecto = a.proyecto || '';
      q.nota_titulo = a.data ? a.data.titulo : a.id;
    }
    if (!groups[tema]) groups[tema] = [];
    groups[tema].push(q);
  });

  // Round-robin interleaving
  const interleaved = [];
  const groupKeys = Object.keys(groups);
  let hasMore = true;
  let index = 0;

  while (hasMore) {
    hasMore = false;
    for (const key of groupKeys) {
      if (index < groups[key].length) {
        interleaved.push(groups[key][index]);
        hasMore = true;
      }
    }
    index++;
  }

  // Persistir en 06-spaced-repetition/cola-repaso.md
  try {
    const colaPath = path.join(DIRS.repaso, 'cola-repaso.md');
    const headerYaml = {
      tipo: 'cola-repaso',
      generado: today,
      pendientes_hoy: totalDue
    };
    let mdBody = '<!-- Ordenada por proxima_revision; la app intercala (round-robin) entre temas distintos, nunca dos seguidas del mismo tema si hay alternativa. -->\n\n';
    interleaved.forEach(item => {
      mdBody += `- pregunta: ${item.fileName}\n  tema: ${item.tema}\n  proxima_revision: ${item.proxima_revision}\n`;
    });
    if (questions.length && !practiceAll) saveMarkdownFile(colaPath, headerYaml, mdBody);
  } catch (e) {
    console.error('Error guardando cola-repaso.md:', e.message);
  }

  return {
    queue: interleaved,
    today,
    totalDue,
    isFuturePractice
  };
}

// Cálculo SM-2 exacto según §5 de 00-ESPECIFICACION.md
function calculateSM2(currentEase, currentInterval, repeticiones, q) {
  let newRepeticiones = repeticiones || 0;
  let newInterval = 1;

  if (q < 3) {
    newRepeticiones = 0;
    newInterval = 1;
  } else {
    if (newRepeticiones === 0) {
      newInterval = 1;
    } else if (newRepeticiones === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.max(1, Math.round(currentInterval * currentEase));
    }
    newRepeticiones += 1;
  }

  // ease_factor = max(1.3, ease_factor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)))
  const diff = 5 - q;
  let newEase = currentEase + (0.1 - diff * (0.08 + diff * 0.02));
  newEase = Math.max(1.3, Number(newEase.toFixed(3)));

  // Calcular próxima fecha sumando newInterval días
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + newInterval);
  const nextIso = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;

  return {
    ease_factor: newEase,
    intervalo_dias: newInterval,
    repeticiones: newRepeticiones,
    proxima_revision: nextIso
  };
}

// -------------------------------------------------------------
// Rutas de la API
// -------------------------------------------------------------

// Listar todas las notas y estado general (permite filtros opcionales por campo y proyecto)
app.get('/api/notes', (req, res) => {
  const { campo, proyecto } = req.query;
  let bandeja = getAllNotesFromDir('bandeja');
  let fuente = getAllNotesFromDir('fuente');
  let atomica = getAllNotesFromDir('atomica');
  let mapa = getAllNotesFromDir('mapa');
  const preguntas = getAllQuestions();
  const backlinks = computeBacklinks();

  if (campo) {
    const cSlug = slugify(campo);
    const matchC = n => {
      const c = n.campo || (n.data && n.data.campo) || '';
      return slugify(c) === cSlug;
    };
    fuente = fuente.filter(matchC);
    atomica = atomica.filter(matchC);
    mapa = mapa.filter(matchC);
  }

  if (proyecto) {
    const pSlug = slugify(proyecto);
    const matchP = n => {
      const p = n.proyecto || (n.data && n.data.proyecto) || '';
      return slugify(p) === pSlug;
    };
    fuente = fuente.filter(matchP);
    atomica = atomica.filter(matchP);
    mapa = mapa.filter(matchP);
  }

  // Asociar pregunta a cada nota atómica
  const questionByNoteId = {};
  preguntas.forEach(q => { questionByNoteId[q.nota_id] = q; });

  const enrichedAtomica = atomica.map(n => ({
    ...n,
    pregunta: questionByNoteId[n.id] || null,
    backlinks: backlinks[n.id] || []
  }));

  res.json({
    bandeja,
    fuente,
    atomica: enrichedAtomica,
    mapa,
    preguntasCount: preguntas.length
  });
});

// Obtener una nota específica (busca también en subcarpetas)
app.get('/api/notes/:tipo/:id', (req, res) => {
  const { tipo, id } = req.params;
  const dir = DIRS[tipo];
  if (!dir) return res.status(404).json({ error: 'Tipo desconocido' });

  const filePath = findNoteFilePath(tipo, id) || path.join(dir, `${id}.md`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Nota no encontrada' });
  }

  const parsed = parseMarkdownFile(filePath);
  if (!parsed) return res.status(500).json({ error: 'Error leyendo archivo' });

  const tags = extractTags(parsed.data, parsed.content);
  parsed.data.tags = tags;
  const { campo, proyecto } = resolveNoteFieldAndProject(parsed.data, parsed.data.carpeta || '');
  parsed.data.campo = campo;
  parsed.data.proyecto = proyecto;

  let extra = {};
  if (tipo === 'atomica') {
    const backlinks = computeBacklinks();
    const questions = getAllQuestions();
    extra.backlinks = backlinks[id] || [];
    extra.pregunta = questions.find(q => q.nota_id === id) || null;

    // 1. Fuente de origen conectada
    const allFuentes = getAllNotesFromDir('fuente');
    let fuenteObj = null;
    const fuenteId = parsed.data.fuente;
    if (fuenteId) {
      const foundF = allFuentes.find(f => f.id === fuenteId);
      if (foundF) {
        fuenteObj = {
          id: foundF.id,
          titulo: (foundF.data && foundF.data.titulo) || foundF.id,
          autor: (foundF.data && foundF.data.autor) || '',
          tipo_fuente: (foundF.data && foundF.data.tipo_fuente) || 'fuente',
          busqueda_google: (foundF.data && foundF.data.busqueda_google) || '',
          campo: foundF.campo || '',
          proyecto: foundF.proyecto || ''
        };
      } else {
        fuenteObj = { id: fuenteId, titulo: fuenteId, tipo_fuente: 'fuente', busqueda_google: '' };
      }
    }
    if (!fuenteObj) {
      const fuenteBl = extra.backlinks.find(b => b.sourceType === 'fuente');
      if (fuenteBl) {
        const foundF = allFuentes.find(f => f.id === fuenteBl.sourceId);
        fuenteObj = {
          id: fuenteBl.sourceId,
          titulo: (foundF && foundF.data && foundF.data.titulo) || fuenteBl.sourceTitle || fuenteBl.sourceId,
          autor: (foundF && foundF.data && foundF.data.autor) || '',
          tipo_fuente: (foundF && foundF.data && foundF.data.tipo_fuente) || 'fuente',
          busqueda_google: (foundF && foundF.data && foundF.data.busqueda_google) || '',
          campo: (foundF && foundF.campo) || '',
          proyecto: (foundF && foundF.proyecto) || ''
        };
      }
    }
    extra.connectedFuente = fuenteObj;

    // 2. Mapas de contenido que incluyen esta nota
    const allMapas = getAllNotesFromDir('mapa');
    extra.connectedMapas = allMapas.filter(m => {
      const subtemas = Array.isArray(m.data && m.data.subtemas) ? m.data.subtemas : [];
      return subtemas.some(s => s && s.nota_id === id);
    }).map(m => {
      const sub = (m.data.subtemas || []).find(s => s && s.nota_id === id);
      return {
        id: m.id,
        titulo: (m.data && m.data.titulo) || m.id,
        busqueda_google: (m.data && m.data.busqueda_google) || '',
        razon: (sub && sub.razon) || '',
        campo: m.campo || '',
        proyecto: m.proyecto || ''
      };
    });

    // 3. Notas atómicas conectadas (salientes y entrantes)
    const allAtomicas = getAllNotesFromDir('atomica');
    const atomicMap = {};
    allAtomicas.forEach(a => { atomicMap[a.id] = a; });

    const connectedAtomicIds = new Set();
    const explicitLinks = Array.isArray(parsed.data.enlaces) ? parsed.data.enlaces : [];
    explicitLinks.forEach(e => { if (e && e !== id) connectedAtomicIds.add(e); });
    const wikilinks = (parsed.content.match(/\[\[([a-zA-Z0-9_-]+)\]\]/g) || []).map(m => m.replace(/\[\[|\]\]/g, ''));
    wikilinks.forEach(w => { if (w && w !== id) connectedAtomicIds.add(w); });
    extra.backlinks.forEach(b => {
      if (b.sourceType === 'atomica' && b.sourceId && b.sourceId !== id) {
        connectedAtomicIds.add(b.sourceId);
      }
    });

    extra.connectedAtomicas = Array.from(connectedAtomicIds).map(aId => {
      const a = atomicMap[aId];
      let idea = '';
      if (a && a.content) {
        const m = a.content.match(/## (?:Idea \(con mis palabras\)|Idea \(in my own words\)|Idea)([\s\S]*?)(##|$)/i);
        idea = m ? m[1].trim() : a.content.substring(0, 140);
      }
      return {
        id: aId,
        titulo: (a && a.data && a.data.titulo) || aId,
        busqueda_google: (a && a.data && a.data.busqueda_google) || '',
        idea,
        campo: (a && a.campo) || '',
        proyecto: (a && a.proyecto) || ''
      };
    });
  } else if (tipo === 'mapa') {
    const allAtomicas = getAllNotesFromDir('atomica');
    const allFuentes = getAllNotesFromDir('fuente');
    const allMapas = getAllNotesFromDir('mapa');
    const atomicMap = {};
    allAtomicas.forEach(a => { atomicMap[a.id] = a; });
    extra.subtemasDetalle = (parsed.data.subtemas || []).map(s => {
      const a = atomicMap[s.nota_id];
      let idea = '';
      if (a) {
        const m = a.content.match(/## (?:Idea \(con mis palabras\)|Idea \(in my own words\)|Idea)([\s\S]*?)(##|$)/i);
        idea = m ? m[1].trim() : a.content.substring(0, 140);
      }
      return {
        nota_id: s.nota_id,
        razon: s.razon || '',
        titulo: a ? (a.data.titulo || s.nota_id) : s.nota_id,
        busqueda_google: (a && a.data && a.data.busqueda_google) || '',
        idea,
        carpeta: a ? (a.data.carpeta || '') : '',
        campo: a ? (a.campo || '') : '',
        proyecto: a ? (a.proyecto || '') : '',
        modulo: a ? (a.data.modulo || '') : '',
        leccion: a ? (a.data.leccion ?? '') : '',
        leccion_titulo: a ? (a.data.leccion_titulo || '') : '',
        fuente: a ? (a.data.fuente || '') : ''
      };
    });

    // Fuente conectada al mapa
    const mapFuenteId = parsed.data.fuente || (extra.subtemasDetalle.find(s => s.fuente)?.fuente) || '';
    if (mapFuenteId) {
      const fObj = allFuentes.find(f => f.id === mapFuenteId);
      if (fObj) {
        extra.connectedFuente = {
          id: fObj.id,
          titulo: (fObj.data && fObj.data.titulo) || fObj.id,
          autor: (fObj.data && fObj.data.autor) || '',
          tipo_fuente: (fObj.data && fObj.data.tipo_fuente) || 'fuente'
        };
      }
    }

    // Otros mapas del mismo proyecto
    if (proyecto) {
      const pSlug = slugify(proyecto);
      extra.connectedMapas = allMapas
        .filter(m => m.id !== id && slugify(m.proyecto || m.data?.proyecto || '') === pSlug)
        .map(m => ({
          id: m.id,
          titulo: (m.data && m.data.titulo) || m.id,
          tipo_mapa: (m.data && m.data.tipo_mapa) || (m.id.startsWith('mapa-curso-') ? 'curso' : 'tematico'),
          modulo: (m.data && m.data.modulo) || '',
          leccion: (m.data && m.data.leccion) ?? '',
          leccion_titulo: (m.data && m.data.leccion_titulo) || '',
          subtemasCount: Array.isArray(m.data && m.data.subtemas) ? m.data.subtemas.length : 0
        }));
    } else {
      extra.connectedMapas = [];
    }
  } else if (tipo === 'fuente') {
    const allAtomicas = getAllNotesFromDir('atomica');
    const allMapas = getAllNotesFromDir('mapa');
    const ideasList = Array.isArray(parsed.data.ideas_disparadas) ? parsed.data.ideas_disparadas : [];
    const connected = allAtomicas.filter(a => {
      const aFuente = (a.data && a.data.fuente) || a.fuente;
      return aFuente === id || ideasList.includes(a.id);
    });
    const connectedAtomicIdSet = new Set(connected.map(a => a.id));
    extra.connectedAtomicas = connected.map(a => {
      let idea = '';
      if (a.content) {
        const m = a.content.match(/## (?:Idea \(con mis palabras\)|Idea \(in my own words\)|Idea)([\s\S]*?)(##|$)/i);
        idea = m ? m[1].trim() : a.content.substring(0, 160);
      }
      return {
        id: a.id,
        titulo: (a.data && a.data.titulo) || a.id,
        busqueda_google: (a.data && a.data.busqueda_google) || '',
        idea,
        carpeta: a.carpeta || (a.data && a.data.carpeta) || '',
        campo: a.campo || (a.data && a.data.campo) || '',
        proyecto: a.proyecto || (a.data && a.data.proyecto) || '',
        tags: a.tags || []
      };
    });
    extra.connectedMapas = allMapas.filter(m => {
      if (m.data && m.data.fuente === id) return true;
      const subs = Array.isArray(m.data && m.data.subtemas) ? m.data.subtemas : [];
      return subs.some(s => s && connectedAtomicIdSet.has(s.nota_id));
    }).map(m => ({
      id: m.id,
      titulo: (m.data && m.data.titulo) || m.id,
      tipo_mapa: (m.data && m.data.tipo_mapa) || (m.id.startsWith('mapa-curso-') ? 'curso' : 'tematico'),
      subtemasCount: Array.isArray(m.data && m.data.subtemas) ? m.data.subtemas.length : 0
    }));
  }

  res.json({
    id: parsed.data.id || id,
    tipo,
    carpeta: parsed.data.carpeta || '',
    campo,
    proyecto,
    tags,
    data: parsed.data,
    content: parsed.content,
    raw: parsed.raw,
    filePath,
    ...extra
  });
});

// Crear nueva nota (soporta subcarpetas, campos, proyectos y tags)
app.post('/api/notes', (req, res) => {
  const { tipo, data, content } = req.body;
  const dir = DIRS[tipo];
  if (!dir) return res.status(400).json({ error: 'Tipo inválido' });

  // Regla estricta para mapas: todo subtema debe tener razon obligatoria
  if (!data || typeof data !== 'object' || Array.isArray(data)) return res.status(400).json({ error: 'Note data must be an object' });
  if (content !== undefined && typeof content !== 'string') return res.status(400).json({ error: 'Content must be text' });
  if (tipo === 'mapa' && Array.isArray(data.subtemas)) {
    for (const sub of data.subtemas) {
      if (!sub || typeof sub.razon !== 'string' || !sub.razon.trim()) {
        return res.status(400).json({
          error: 'Regla de negocio: Enlazar notas atómicas a un mapa exige rellenar el campo "razon" para justificar la relación.'
        });
      }
    }
  }

  const id = data.id ? slugify(data.id) : (tipo + '-' + slugify(data.titulo || Date.now()));
  data.id = id;
  if (!data.creado) data.creado = getTodayString();
  data.tipo = tipo;

  // Extraer tags
  data.tags = extractTags(data, content);

  // Campo y Proyecto
  const rawCampo = (data.campo && typeof data.campo === 'string') ? data.campo.trim() : '';
  const rawProyecto = (data.proyecto && typeof data.proyecto === 'string') ? data.proyecto.trim() : '';

  let folder = data.carpeta ? String(data.carpeta).trim() : '';
  if (!folder && (rawCampo || rawProyecto)) {
    const cSlug = rawCampo ? slugify(rawCampo) : 'general';
    const pSlug = rawProyecto ? slugify(rawProyecto) : '';
    folder = pSlug ? `${cSlug}/${pSlug}` : cSlug;
  }
  data.carpeta = folder;
  if (rawCampo) data.campo = rawCampo;
  if (rawProyecto) data.proyecto = rawProyecto;
  if (!data.campo && folder) {
    const { campo, proyecto } = resolveNoteFieldAndProject(data, folder);
    if (campo) data.campo = campo;
    if (proyecto) data.proyecto = proyecto;
  }

  // Registrar en proyectos.json si tiene campo
  if (data.campo) {
    const meta = readProjectsMetadata();
    if (!meta.campos) meta.campos = {};
    const cSlug = slugify(data.campo);
    if (!meta.campos[cSlug]) meta.campos[cSlug] = { nombre: data.campo, proyectos: {} };
    if (data.proyecto) {
      const pSlug = slugify(data.proyecto);
      if (!meta.campos[cSlug].proyectos) meta.campos[cSlug].proyectos = {};
      if (!meta.campos[cSlug].proyectos[pSlug]) {
        const pTipo = (data.proyectoTipo || req.body.proyectoTipo || 'curso').trim().toLowerCase();
        meta.campos[cSlug].proyectos[pSlug] = {
          nombre: data.proyecto,
          descripcion: (data.proyectoDescripcion || req.body.proyectoDescripcion || '').trim(),
          tipo: pTipo,
          estado: 'activo',
          lecciones: [],
          mapa_curso_id: pTipo === 'curso' ? `mapa-curso-${pSlug}` : null
        };
      }
    }
    saveProjectsMetadata(meta);
  }

  const targetDir = folder ? path.join(dir, folder) : dir;
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const filePath = path.join(targetDir, `${id}.md`);
  if (findNoteFilePath(tipo, id)) {
    return res.status(409).json({ error: `Ya existe una nota con el id '${id}'` });
  }

  saveMarkdownFile(filePath, data, content || '');
  res.status(201).json({ success: true, id, tipo, data, carpeta: folder, campo: data.campo, proyecto: data.proyecto, tags: data.tags });
});

// Actualizar nota (permite mover a otra subcarpeta, campo o proyecto)
app.put('/api/notes/:tipo/:id', (req, res) => {
  const { tipo, id } = req.params;
  let { data, content } = req.body;
  const dir = DIRS[tipo];
  if (!dir) return res.status(400).json({ error: 'Tipo inválido' });

  // Regla estricta para mapas: todo subtema debe tener razon obligatoria
  if (!data || typeof data !== 'object' || Array.isArray(data)) return res.status(400).json({ error: 'Note data must be an object' });
  if (content !== undefined && typeof content !== 'string') return res.status(400).json({ error: 'Content must be text' });
  if (tipo === 'mapa' && Array.isArray(data.subtemas)) {
    for (const sub of data.subtemas) {
      if (!sub || typeof sub.razon !== 'string' || !sub.razon.trim()) {
        return res.status(400).json({
          error: 'Regla de negocio: Enlazar notas atómicas a un mapa exige rellenar el campo "razon" para justificar la relación.'
        });
      }
    }
  }

  const currentPath = findNoteFilePath(tipo, id) || path.join(dir, `${id}.md`);
  if (!fs.existsSync(currentPath)) {
    return res.status(404).json({ error: 'Nota no encontrada' });
  }

  const previous = parseMarkdownFile(currentPath);
  if (!previous) return res.status(500).json({error:'Could not read existing note'});
  data = {...previous.data, ...data, id, tipo};
  if (content === undefined) content = previous.content;
  // Extraer tags actualizados
  data.tags = extractTags(data, content);

  // Campo y Proyecto
  const rawCampo = (data.campo && typeof data.campo === 'string') ? data.campo.trim() : '';
  const rawProyecto = (data.proyecto && typeof data.proyecto === 'string') ? data.proyecto.trim() : '';

  let targetFolder = data.carpeta != null ? String(data.carpeta).trim() : '';
  if (!targetFolder && (rawCampo || rawProyecto)) {
    const cSlug = rawCampo ? slugify(rawCampo) : 'general';
    const pSlug = rawProyecto ? slugify(rawProyecto) : '';
    targetFolder = pSlug ? `${cSlug}/${pSlug}` : cSlug;
  }
  data.carpeta = targetFolder;
  if (rawCampo) data.campo = rawCampo;
  if (rawProyecto) data.proyecto = rawProyecto;
  if (!data.campo && targetFolder) {
    const { campo, proyecto } = resolveNoteFieldAndProject(data, targetFolder);
    if (campo) data.campo = campo;
    if (proyecto) data.proyecto = proyecto;
  }

  // Si tiene campo, persistir en proyectos.json
  if (data.campo) {
    const meta = readProjectsMetadata();
    if (!meta.campos) meta.campos = {};
    const cSlug = slugify(data.campo);
    if (!meta.campos[cSlug]) meta.campos[cSlug] = { nombre: data.campo, proyectos: {} };
    if (data.proyecto) {
      const pSlug = slugify(data.proyecto);
      if (!meta.campos[cSlug].proyectos) meta.campos[cSlug].proyectos = {};
      if (!meta.campos[cSlug].proyectos[pSlug]) {
        meta.campos[cSlug].proyectos[pSlug] = { nombre: data.proyecto };
      }
    }
    saveProjectsMetadata(meta);
  }

  const targetDir = targetFolder ? path.join(dir, targetFolder) : dir;
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const newPath = path.join(targetDir, `${id}.md`);

  if (path.resolve(newPath) !== path.resolve(currentPath) && fs.existsSync(newPath)) return res.status(409).json({ error: 'Destination already exists' });
  saveMarkdownFile(newPath, data, content || '');

  // Si se movió a otra carpeta, eliminar archivo anterior
  if (path.resolve(newPath) !== path.resolve(currentPath) && fs.existsSync(currentPath)) {
    fs.unlinkSync(currentPath);
  }
  res.json({ success: true, id, data, carpeta: targetFolder, campo: data.campo, proyecto: data.proyecto, tags: data.tags });
});

// Eliminar nota
app.delete('/api/notes/:tipo/:id', (req, res) => {
  const { tipo, id } = req.params;
  const dir = DIRS[tipo];
  if (!dir) return res.status(400).json({ error: 'Tipo inválido' });

  const filePath = findNoteFilePath(tipo, id) || path.join(dir, `${id}.md`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Nota no encontrada' });
  }

  fs.unlinkSync(filePath);

  // Si se elimina una nota atómica, verificar si tiene pregunta asociada y eliminarla también
  if (tipo === 'atomica') {
    const qFile = path.join(DIRS.pregunta, `pregunta-${id.replace(/^atomica-/, '')}.md`);
    if (fs.existsSync(qFile)) {
      try { fs.unlinkSync(qFile); } catch (e) { /* ignore */ }
    }
  }

  res.json({ success: true });
});

// -------------------------------------------------------------
// Gestión de Carpetas y Hashtags
// -------------------------------------------------------------

app.get('/api/folders', (req, res) => {
  const folders = {
    bandeja: [],
    fuente: [],
    atomica: [],
    mapa: []
  };
  const allTags = new Set();

  ['bandeja', 'fuente', 'atomica', 'mapa'].forEach(tipo => {
    const baseDir = DIRS[tipo];
    if (fs.existsSync(baseDir)) {
      const getSubdirs = (dir, rel = '') => {
        const list = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
          if (e.isDirectory()) {
            const subRel = rel ? `${rel}/${e.name}` : e.name;
            list.push(subRel);
            list.push(...getSubdirs(path.join(dir, e.name), subRel));
          }
        }
        return list;
      };
      folders[tipo] = getSubdirs(baseDir);
    }
    const notes = getAllNotesFromDir(tipo);
    notes.forEach(n => {
      (n.tags || []).forEach(t => allTags.add(t));
    });
  });

  res.json({
    folders,
    metadata: readFoldersMetadata(),
    tags: Array.from(allTags).sort()
  });
});

app.post('/api/folders', (req, res) => {
  const { tipo, folderName, nombre, parentFolder, color } = req.body;
  const nameToUse = (nombre || folderName || '').trim();
  const baseDir = DIRS[tipo];
  if (!baseDir) return res.status(400).json({ error: 'Tipo inválido' });
  if (!nameToUse) return res.status(400).json({ error: 'Nombre de carpeta requerido' });

  const cleanName = slugify(nameToUse);
  const targetDir = parentFolder ? path.join(baseDir, parentFolder, cleanName) : path.join(baseDir, cleanName);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const createdPath = parentFolder ? `${parentFolder}/${cleanName}` : cleanName;
  if (color && typeof color === 'string') {
    const meta = readFoldersMetadata();
    if (!meta[tipo]) meta[tipo] = {};
    if (!meta[tipo][createdPath]) meta[tipo][createdPath] = {};
    meta[tipo][createdPath].color = color;
    saveFoldersMetadata(meta);
  }

  res.status(201).json({ success: true, folder: createdPath });
});

// Renombrar carpeta
app.post('/api/folders/rename', (req, res) => {
  const { tipo, oldPath, newName } = req.body;
  const baseDir = DIRS[tipo];
  if (!baseDir) return res.status(400).json({ error: 'Tipo inválido' });
  if (!oldPath || !newName) return res.status(400).json({ error: 'oldPath y newName requeridos' });

  const cleanName = slugify(newName);
  if (!cleanName) return res.status(400).json({ error: 'Nombre inválido' });

  const parts = oldPath.split('/');
  parts[parts.length - 1] = cleanName;
  const newPath = parts.join('/');

  if (oldPath === newPath) return res.json({ success: true, oldPath, newPath });

  const oldFullPath = path.join(baseDir, oldPath);
  const newFullPath = path.join(baseDir, newPath);

  if (!fs.existsSync(oldFullPath)) return res.status(404).json({ error: 'Carpeta de origen no encontrada' });
  if (fs.existsSync(newFullPath)) return res.status(409).json({ error: 'Ya existe una carpeta con ese nombre en este nivel' });

  fs.mkdirSync(path.dirname(newFullPath), { recursive: true });
  fs.renameSync(oldFullPath, newFullPath);

  updateNotesFolderOnRename(tipo, oldPath, newPath);
  migrateFolderMetadata(tipo, oldPath, newPath);

  res.json({ success: true, oldPath, newPath });
});

// Mover carpeta a otra carpeta superior o a la raíz
app.post('/api/folders/move', (req, res) => {
  const { tipo, folderPath, targetParent } = req.body;
  const baseDir = DIRS[tipo];
  if (!baseDir) return res.status(400).json({ error: 'Tipo inválido' });
  if (!folderPath) return res.status(400).json({ error: 'folderPath requerido' });

  const cleanTarget = (targetParent || '').trim();
  if (folderPath === cleanTarget || cleanTarget.startsWith(folderPath + '/')) {
    return res.status(400).json({ error: 'No se puede mover una carpeta dentro de sí misma o de una de sus subcarpetas' });
  }

  const folderBaseName = folderPath.split('/').pop();
  const newPath = cleanTarget ? `${cleanTarget}/${folderBaseName}` : folderBaseName;

  if (folderPath === newPath) return res.json({ success: true, oldPath: folderPath, newPath });

  const oldFullPath = path.join(baseDir, folderPath);
  const newFullPath = path.join(baseDir, newPath);

  if (!fs.existsSync(oldFullPath)) return res.status(404).json({ error: 'Carpeta de origen no encontrada' });
  if (fs.existsSync(newFullPath)) return res.status(409).json({ error: 'Ya existe una carpeta de destino con ese nombre' });

  if (cleanTarget) {
    fs.mkdirSync(path.join(baseDir, cleanTarget), { recursive: true });
  }
  fs.renameSync(oldFullPath, newFullPath);

  updateNotesFolderOnRename(tipo, folderPath, newPath);
  migrateFolderMetadata(tipo, folderPath, newPath);

  res.json({ success: true, oldPath: folderPath, newPath });
});

// Actualizar color de carpeta
app.post('/api/folders/color', (req, res) => {
  const { tipo, folderPath, color } = req.body;
  const baseDir = DIRS[tipo];
  if (!baseDir) return res.status(400).json({ error: 'Tipo inválido' });
  if (!folderPath || !color) return res.status(400).json({ error: 'folderPath y color requeridos' });

  const meta = readFoldersMetadata();
  if (!meta[tipo]) meta[tipo] = {};
  if (!meta[tipo][folderPath]) meta[tipo][folderPath] = {};
  meta[tipo][folderPath].color = color;
  saveFoldersMetadata(meta);

  res.json({ success: true, tipo, folderPath, color });
});

// Eliminar carpeta (preserva notas moviéndolas a raíz por defecto)
app.delete('/api/folders', (req, res) => {
  const { tipo, folderPath, keepNotes } = req.body;
  const baseDir = DIRS[tipo];
  if (!baseDir) return res.status(400).json({ error: 'Tipo inválido' });
  if (!folderPath) return res.status(400).json({ error: 'folderPath requerido' });

  const fullPath = path.join(baseDir, folderPath);
  if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'Carpeta no encontrada' });

  if (keepNotes !== false) {
    const files = getFilesRecursively(fullPath);
    for (const f of files) {
      const note = parseMarkdownFile(f.fullPath);
      if (note && note.data) {
        note.data.carpeta = '';
        const destPath = path.join(baseDir, `${f.fileName}.md`);
        saveMarkdownFile(destPath, note.data, note.content || '');
      }
    }
  }

  fs.rmSync(fullPath, { recursive: true, force: true });
  migrateFolderMetadata(tipo, folderPath, '');

  res.json({ success: true, folderPath });
});

// -------------------------------------------------------------
// Gestión de Campos y Proyectos (Áreas de Conocimiento y Cursos)
// -------------------------------------------------------------

app.get('/api/projects', (req, res) => {
  const metadata = readProjectsMetadata();
  const atomicas = getAllNotesFromDir('atomica');
  const fuentes = getAllNotesFromDir('fuente');
  const mapas = getAllNotesFromDir('mapa');
  const bandeja = getAllNotesFromDir('bandeja');
  const questions = getAllQuestions();
  const today = getTodayString();

  const dueByNoteId = new Set(
    questions.filter(q => q.proxima_revision && q.proxima_revision <= today).map(q => q.nota_id)
  );

  const camposMap = new Map();

  // 1. Cargar desde metadatos si existen
  if (metadata.campos && typeof metadata.campos === 'object') {
    for (const [cSlug, cData] of Object.entries(metadata.campos)) {
      if (!cSlug) continue;
      const cObj = {
        id: cSlug,
        nombre: cData.nombre || humanizeSlug(cSlug),
        descripcion: cData.descripcion || '',
        proyectos: new Map(),
        counts: { atomica: 0, fuente: 0, mapa: 0, bandeja: 0, total: 0 },
        dueReviews: 0
      };
      if (cData.proyectos && typeof cData.proyectos === 'object') {
        for (const [pSlug, pData] of Object.entries(cData.proyectos)) {
          cObj.proyectos.set(pSlug, {
            id: pSlug,
            nombre: pData.nombre || humanizeSlug(pSlug),
            descripcion: pData.descripcion || '',
            tipo: pData.tipo || 'curso',
            estado: pData.estado || 'activo',
            lecciones: Array.isArray(pData.lecciones) ? pData.lecciones : [],
            mapa_curso_id: pData.mapa_curso_id || null,
            counts: { atomica: 0, fuente: 0, mapa: 0, bandeja: 0, total: 0 },
            dueReviews: 0
          });
        }
      }
      camposMap.set(cSlug, cObj);
    }
  }

  // 2. Explorar carpetas físicas existentes en disco (solo estructuras de 2 niveles campo/proyecto o campos ya registrados)
  ['fuente', 'atomica', 'mapa'].forEach(tipo => {
    const baseDir = DIRS[tipo];
    if (fs.existsSync(baseDir)) {
      const topEntries = fs.readdirSync(baseDir, { withFileTypes: true });
      for (const entry of topEntries) {
        if (entry.isDirectory()) {
          const subDirPath = path.join(baseDir, entry.name);
          const subEntries = fs.readdirSync(subDirPath, { withFileTypes: true });
          const subDirs = subEntries.filter(sub => sub.isDirectory());
          const cSlug = slugify(entry.name);
          if (!camposMap.has(cSlug) && subDirs.length === 0) {
            continue;
          }
          if (!camposMap.has(cSlug)) {
            camposMap.set(cSlug, {
              id: cSlug,
              nombre: humanizeSlug(entry.name),
              descripcion: '',
              proyectos: new Map(),
              counts: { atomica: 0, fuente: 0, mapa: 0, bandeja: 0, total: 0 },
              dueReviews: 0
            });
          }
          const cObj = camposMap.get(cSlug);
          for (const sub of subDirs) {
            const pSlug = slugify(sub.name);
            if (!cObj.proyectos.has(pSlug)) {
              cObj.proyectos.set(pSlug, {
                id: pSlug,
                nombre: humanizeSlug(sub.name),
                descripcion: '',
                tipo: 'curso',
                estado: 'activo',
                lecciones: [],
                mapa_curso_id: null,
                counts: { atomica: 0, fuente: 0, mapa: 0, bandeja: 0, total: 0 },
                dueReviews: 0
              });
            }
          }
        }
      }
    }
  });

  // 3. Agregar conteos de todas las notas
  const allNotes = [
    ...atomicas.map(n => ({ ...n, type: 'atomica' })),
    ...fuentes.map(n => ({ ...n, type: 'fuente' })),
    ...mapas.map(n => ({ ...n, type: 'mapa' })),
    ...bandeja.map(n => ({ ...n, type: 'bandeja' }))
  ];

  allNotes.forEach(note => {
    const rawCampo = note.campo || (note.data && note.data.campo) || '';
    if (!rawCampo) return;
    const cSlug = slugify(rawCampo);
    if (!camposMap.has(cSlug)) {
      camposMap.set(cSlug, {
        id: cSlug,
        nombre: typeof rawCampo === 'string' && rawCampo.length > 2 ? rawCampo : humanizeSlug(cSlug),
        descripcion: '',
        proyectos: new Map(),
        counts: { atomica: 0, fuente: 0, mapa: 0, bandeja: 0, total: 0 },
        dueReviews: 0
      });
    }
    const cObj = camposMap.get(cSlug);
    cObj.counts[note.type] = (cObj.counts[note.type] || 0) + 1;
    cObj.counts.total = (cObj.counts.total || 0) + 1;

    const rawProyecto = note.proyecto || (note.data && note.data.proyecto) || '';
    if (rawProyecto) {
      const pSlug = slugify(rawProyecto);
      if (!cObj.proyectos.has(pSlug)) {
        cObj.proyectos.set(pSlug, {
          id: pSlug,
          nombre: typeof rawProyecto === 'string' && rawProyecto.length > 2 ? rawProyecto : humanizeSlug(pSlug),
          descripcion: '',
          tipo: 'curso',
          estado: 'activo',
          lecciones: [],
          mapa_curso_id: null,
          counts: { atomica: 0, fuente: 0, mapa: 0, bandeja: 0, total: 0 },
          dueReviews: 0
        });
      }
      const pObj = cObj.proyectos.get(pSlug);
      pObj.counts[note.type] = (pObj.counts[note.type] || 0) + 1;
      pObj.counts.total = (pObj.counts.total || 0) + 1;

      if (note.type === 'atomica' && dueByNoteId.has(note.id)) {
        pObj.dueReviews++;
        cObj.dueReviews++;
      }
    } else {
      if (note.type === 'atomica' && dueByNoteId.has(note.id)) {
        cObj.dueReviews++;
      }
    }
  });

  const campos = Array.from(camposMap.values()).map(c => ({
    ...c,
    proyectos: Array.from(c.proyectos.values())
  }));

  const flatProyectos = [];
  campos.forEach(c => {
    c.proyectos.forEach(p => {
      flatProyectos.push({
        campo: c.nombre,
        campoSlug: c.id,
        proyecto: p.nombre,
        proySlug: p.id,
        descripcion: p.descripcion,
        tipo: p.tipo || 'curso',
        estado: p.estado || 'activo',
        lecciones: p.lecciones || [],
        mapa_curso_id: p.mapa_curso_id || null,
        stats: {
          atomicas: p.counts.atomica || 0,
          fuentes: p.counts.fuente || 0,
          mapas: p.counts.mapa || 0,
          bandeja: p.counts.bandeja || 0,
          total: p.counts.total || 0,
          repasosPendientes: p.dueReviews || 0
        },
        dueReviews: p.dueReviews
      });
    });
  });

  res.json({
    campos,
    proyectos: flatProyectos,
    totalCampos: campos.length,
    totalProyectos: flatProyectos.length
  });
});

app.post('/api/projects', (req, res) => {
  const { campo, proyecto, descripcion, tipo, estado } = req.body;
  if (!campo || typeof campo !== 'string' || !campo.trim()) {
    return res.status(400).json({ error: 'El nombre del campo es obligatorio' });
  }

  const rawCampo = campo.trim();
  const campoSlug = slugify(rawCampo);
  const rawProyecto = (proyecto && typeof proyecto === 'string') ? proyecto.trim() : '';
  const proySlug = rawProyecto ? slugify(rawProyecto) : '';
  const desc = (descripcion && typeof descripcion === 'string') ? descripcion.trim() : '';
  const validTipo = (tipo && typeof tipo === 'string' && tipo.trim()) ? tipo.trim().toLowerCase() : 'curso';
  const validEstado = (estado && typeof estado === 'string' && estado.trim()) ? estado.trim().toLowerCase() : 'activo';

  // Crear carpetas físicas
  ['fuente', 'atomica', 'mapa'].forEach(t => {
    const baseDir = DIRS[t];
    const targetDir = proySlug
      ? path.join(baseDir, campoSlug, proySlug)
      : path.join(baseDir, campoSlug);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
  });

  // Guardar en proyectos.json
  const metadata = readProjectsMetadata();
  if (!metadata.campos) metadata.campos = {};
  if (!metadata.campos[campoSlug]) {
    metadata.campos[campoSlug] = {
      nombre: rawCampo,
      descripcion: proySlug ? '' : desc,
      proyectos: {}
    };
  } else if (!metadata.campos[campoSlug].nombre) {
    metadata.campos[campoSlug].nombre = rawCampo;
  }

  if (proySlug) {
    if (!metadata.campos[campoSlug].proyectos) metadata.campos[campoSlug].proyectos = {};
    const existing = metadata.campos[campoSlug].proyectos[proySlug] || {};
    metadata.campos[campoSlug].proyectos[proySlug] = {
      ...existing,
      nombre: rawProyecto,
      descripcion: desc,
      tipo: validTipo,
      estado: validEstado,
      lecciones: Array.isArray(existing.lecciones) ? existing.lecciones : [],
      mapa_curso_id: existing.mapa_curso_id || (validTipo === 'curso' ? `mapa-curso-${proySlug}` : null)
    };
  }

  saveProjectsMetadata(metadata);

  res.status(201).json({
    success: true,
    campo: rawCampo,
    campoSlug,
    proyecto: rawProyecto || null,
    proySlug: proySlug || null,
    tipo: validTipo,
    estado: validEstado,
    descripcion: desc,
    folder: proySlug ? `${campoSlug}/${proySlug}` : campoSlug
  });
});

app.put('/api/projects/:campoSlug/:proySlug', (req, res) => {
  const { campoSlug, proySlug } = req.params;
  const { nuevoNombre, nuevoCampo, descripcion, tipo, estado } = req.body;

  const metadata = readProjectsMetadata();
  if (!metadata.campos) metadata.campos = {};

  let currentCampoData = metadata.campos[campoSlug];
  let currentProyData = currentCampoData?.proyectos?.[proySlug];

  if (!currentProyData) {
    currentProyData = {
      nombre: humanizeSlug(proySlug),
      descripcion: '',
      tipo: 'curso',
      estado: 'activo',
      lecciones: []
    };
  }

  const updatedNombre = (nuevoNombre && typeof nuevoNombre === 'string' && nuevoNombre.trim())
    ? nuevoNombre.trim()
    : (currentProyData.nombre || humanizeSlug(proySlug));
  const newProySlug = slugify(updatedNombre);

  const updatedCampo = (nuevoCampo && typeof nuevoCampo === 'string' && nuevoCampo.trim())
    ? nuevoCampo.trim()
    : (currentCampoData?.nombre || humanizeSlug(campoSlug));
  const newCampoSlug = slugify(updatedCampo);

  const updatedDesc = descripcion !== undefined ? String(descripcion).trim() : (currentProyData.descripcion || '');
  const updatedTipo = tipo !== undefined ? String(tipo).trim().toLowerCase() : (currentProyData.tipo || 'curso');
  const updatedEstado = estado !== undefined ? String(estado).trim().toLowerCase() : (currentProyData.estado || 'activo');
  const lecciones = Array.isArray(currentProyData.lecciones) ? currentProyData.lecciones : [];
  const mapaCursoId = currentProyData.mapa_curso_id || (updatedTipo === 'curso' ? `mapa-curso-${newProySlug}` : null);

  const hasMoved = (campoSlug !== newCampoSlug || proySlug !== newProySlug);
  if (hasMoved) {
    ['fuente', 'atomica', 'mapa'].forEach(noteTipo => {
      const baseDir = DIRS[noteTipo];
      const oldDir = path.join(baseDir, campoSlug, proySlug);
      const newDir = path.join(baseDir, newCampoSlug, newProySlug);

      if (fs.existsSync(oldDir)) {
        if (!fs.existsSync(newDir)) {
          fs.mkdirSync(newDir, { recursive: true });
        }
        try {
          const files = fs.readdirSync(oldDir);
          for (const file of files) {
            const oldFile = path.join(oldDir, file);
            const newFile = path.join(newDir, file);
            if (fs.statSync(oldFile).isFile() && file.endsWith('.md')) {
              const parsed = parseMarkdownFile(oldFile);
              if (parsed) {
                parsed.data.campo = updatedCampo;
                parsed.data.proyecto = updatedNombre;
                parsed.data.carpeta = `${newCampoSlug}/${newProySlug}`;
                saveMarkdownFile(newFile, parsed.data, parsed.content);
                try { fs.unlinkSync(oldFile); } catch (e) {}
              } else {
                fs.renameSync(oldFile, newFile);
              }
            }
          }
          try { fs.rmdirSync(oldDir); } catch (e) {}
        } catch (err) {
          console.error('Error moviendo archivos de proyecto:', err);
        }
      }
    });

    if (metadata.campos[campoSlug]?.proyectos?.[proySlug]) {
      delete metadata.campos[campoSlug].proyectos[proySlug];
    }
  }

  if (!metadata.campos[newCampoSlug]) {
    metadata.campos[newCampoSlug] = {
      nombre: updatedCampo,
      descripcion: '',
      proyectos: {}
    };
  } else {
    metadata.campos[newCampoSlug].nombre = updatedCampo;
  }
  if (!metadata.campos[newCampoSlug].proyectos) {
    metadata.campos[newCampoSlug].proyectos = {};
  }

  metadata.campos[newCampoSlug].proyectos[newProySlug] = {
    nombre: updatedNombre,
    descripcion: updatedDesc,
    tipo: updatedTipo,
    estado: updatedEstado,
    lecciones,
    mapa_curso_id: mapaCursoId
  };

  saveProjectsMetadata(metadata);

  res.json({
    success: true,
    campo: updatedCampo,
    campoSlug: newCampoSlug,
    proyecto: updatedNombre,
    proySlug: newProySlug,
    descripcion: updatedDesc,
    tipo: updatedTipo,
    estado: updatedEstado,
    lecciones,
    mapa_curso_id: mapaCursoId,
    folder: `${newCampoSlug}/${newProySlug}`
  });
});

app.delete('/api/projects/:campoSlug/:proySlug', (req, res) => {
  const { campoSlug, proySlug } = req.params;
  const metadata = readProjectsMetadata();
  if (metadata.campos?.[campoSlug]?.proyectos?.[proySlug]) {
    delete metadata.campos[campoSlug].proyectos[proySlug];
  }

  // Si la carpeta física del proyecto está vacía, eliminarla para que no reaparezca
  ['fuente', 'atomica', 'mapa'].forEach(t => {
    const baseDir = DIRS[t];
    const proyDir = path.join(baseDir, campoSlug, proySlug);
    try {
      if (fs.existsSync(proyDir) && fs.readdirSync(proyDir).length === 0) {
        fs.rmdirSync(proyDir);
      }
    } catch (e) {}
    const campoDir = path.join(baseDir, campoSlug);
    try {
      if (fs.existsSync(campoDir) && fs.readdirSync(campoDir).length === 0) {
        fs.rmdirSync(campoDir);
      }
    } catch (e) {}
  });

  if (metadata.campos?.[campoSlug]) {
    const remainingProjs = Object.keys(metadata.campos[campoSlug].proyectos || {}).length;
    const anyCampoDirHasContent = ['fuente', 'atomica', 'mapa'].some(t => {
      const campoDir = path.join(DIRS[t], campoSlug);
      return fs.existsSync(campoDir) && fs.readdirSync(campoDir).length > 0;
    });
    if (remainingProjs === 0 && !anyCampoDirHasContent) {
      delete metadata.campos[campoSlug];
    }
  }
  saveProjectsMetadata(metadata);
  res.json({ success: true });
});

// -------------------------------------------------------------
// Captura Rápida (Bandeja de Entrada)
// -------------------------------------------------------------
app.post('/api/inbox/quick-capture', (req, res) => {
  const { titulo, contenido } = req.body;
  if ((titulo !== undefined && typeof titulo !== 'string') || typeof contenido !== 'string' || !contenido.trim()) return res.status(400).json({error:'Capture content must be non-empty text'});
  const today = getTodayString();
  const slug = 'capture-' + today + '-' + randomUUID();
  const data = {
    id: slug,
    titulo: titulo && titulo.trim() ? titulo.trim() : `Capture on ${today}`,
    tipo: 'bandeja',
    creado: today,
    procesada: false
  };

  const filePath = path.join(DIRS.bandeja, `${slug}.md`);
  saveMarkdownFile(filePath, data, contenido || '');
  res.status(201).json({ success: true, note: { id: slug, data, content: contenido } });
});

// -------------------------------------------------------------
// Flujo "Procesar" de Bandeja de Entrada
// -------------------------------------------------------------
app.post('/api/inbox/process', (req, res) => {
  const { inboxId, fuenteData, atomicasData } = req.body;
  const inboxPath = typeof inboxId === 'string' ? findNoteFilePath('bandeja', inboxId) : null;
  if (!inboxPath) return res.status(404).json({error:'Inbox note not found'});
  if (!Array.isArray(atomicasData) || !atomicasData.length || atomicasData.some(a=>!a||typeof a.titulo!=='string'||!a.titulo.trim()||typeof a.idea!=='string'||!a.idea.trim()||[a.pregunta,a.respuesta].some(v=>v!==undefined&&typeof v!=='string'))) return res.status(400).json({error:'Atomic notes require a title and idea'});
  if (fuenteData && (typeof fuenteData!=='object'||typeof fuenteData.titulo!=='string'||!fuenteData.titulo.trim())) return res.status(400).json({error:'Invalid source'});
  const destinations=atomicasData.map(a=>['atomica', a.id?slugify(a.id):'atomica-'+slugify(a.titulo)]);
  if(fuenteData) destinations.push(['fuente',fuenteData.id?slugify(fuenteData.id):'fuente-'+slugify(fuenteData.titulo)]);
  const unique=new Set();
  for(const [type,id] of destinations){if(unique.has(type+id)||findNoteFilePath(type,id))return res.status(409).json({error:'A destination note already exists'});unique.add(type+id);}
  const today = getTodayString();

  let createdFuenteId = null;
  const createdAtomicIds = [];

  const globalCampo = req.body.campo ? String(req.body.campo).trim() : '';
  const globalProyecto = req.body.proyecto ? String(req.body.proyecto).trim() : '';

  // 1. Crear nota fuente si fue enviada
  if (fuenteData && fuenteData.titulo) {
    const fId = fuenteData.id ? slugify(fuenteData.id) : ('fuente-' + slugify(fuenteData.titulo));
    createdFuenteId = fId;
    const fCampo = (fuenteData.campo ? String(fuenteData.campo).trim() : '') || globalCampo;
    const fProyecto = (fuenteData.proyecto ? String(fuenteData.proyecto).trim() : '') || globalProyecto;
    let fFolder = fuenteData.carpeta ? String(fuenteData.carpeta).trim() : '';
    if (!fFolder && (fCampo || fProyecto)) {
      const cS = fCampo ? slugify(fCampo) : 'general';
      const pS = fProyecto ? slugify(fProyecto) : '';
      fFolder = pS ? `${cS}/${pS}` : cS;
    }
    const fTargetDir = fFolder ? path.join(DIRS.fuente, fFolder) : DIRS.fuente;
    if (!fs.existsSync(fTargetDir)) fs.mkdirSync(fTargetDir, { recursive: true });

    const fData = {
      id: fId,
      titulo: fuenteData.titulo,
      autor: fuenteData.autor || 'Autor desconocido',
      tipo: 'fuente',
      tipo_fuente: fuenteData.tipo_fuente || 'articulo',
      creado: today,
      carpeta: fFolder,
      campo: fCampo,
      proyecto: fProyecto,
      ideas_disparadas: []
    };

    let fContent = `## Puntos clave (parafraseados, no copiados)\n${fuenteData.puntosClave || ''}\n\n## Ideas propias que dispara\n`;
    if (Array.isArray(atomicasData)) {
      atomicasData.forEach(a => {
        const aId = a.id ? slugify(a.id) : ('atomica-' + slugify(a.titulo));
        fData.ideas_disparadas.push(aId);
        fContent += `- [[${aId}]]\n`;
      });
    }

    const fPath = path.join(fTargetDir, `${fId}.md`);
    saveMarkdownFile(fPath, fData, fContent);
  }

  // 2. Crear notas atómicas si fueron enviadas
  if (Array.isArray(atomicasData)) {
    atomicasData.forEach(a => {
      if (!a.titulo) return;
      const aId = a.id ? slugify(a.id) : ('atomica-' + slugify(a.titulo));
      createdAtomicIds.push(aId);

      const aCampo = (a.campo ? String(a.campo).trim() : '') || globalCampo;
      const aProyecto = (a.proyecto ? String(a.proyecto).trim() : '') || globalProyecto;
      let aFolder = a.carpeta ? String(a.carpeta).trim() : '';
      if (!aFolder && (aCampo || aProyecto)) {
        const cS = aCampo ? slugify(aCampo) : 'general';
        const pS = aProyecto ? slugify(aProyecto) : '';
        aFolder = pS ? `${cS}/${pS}` : cS;
      }
      const aTargetDir = aFolder ? path.join(DIRS.atomica, aFolder) : DIRS.atomica;
      if (!fs.existsSync(aTargetDir)) fs.mkdirSync(aTargetDir, { recursive: true });

      const aData = {
        id: aId,
        titulo: a.titulo,
        tipo: 'atomica',
        fuente: createdFuenteId || a.fuente || null,
        carpeta: aFolder,
        campo: aCampo,
        proyecto: aProyecto,
        enlaces: Array.isArray(a.enlaces) ? a.enlaces : [],
        creado: today,
        ultimo_repaso: null
      };

      const aContent = `## Idea (con mis palabras)\n${a.idea || ''}\n\n## ¿Por qué importa?\n${a.porQueImporta || ''}\n\n## ¿Cómo se conecta con lo que ya sé?\n${a.comoSeConecta || ''}\n`;
      const aPath = path.join(aTargetDir, `${aId}.md`);
      saveMarkdownFile(aPath, aData, aContent);

      // Crear pregunta de autoevaluación asociada automáticamente si se incluye
      if (a.pregunta && a.respuesta) {
        const qId = `pregunta-${aId.replace(/^atomica-/, '')}`;
        const qData = {
          nota_id: aId,
          ease_factor: 2.5,
          intervalo_dias: 1,
          proxima_revision: today,
          historial: [],
          repeticiones: 0
        };
        const qContent = `- P: ${a.pregunta.trim()}\n- R: ${a.respuesta.trim()}\n`;
        const qPath = path.join(DIRS.pregunta, `${qId}.md`);
        saveMarkdownFile(qPath, qData, qContent);
      }
    });
  }

  // 3. Marcar nota de bandeja como procesada: true

  if (fs.existsSync(inboxPath)) {
    const parsed = parseMarkdownFile(inboxPath);
    if (parsed) {
      parsed.data.procesada = true;
      saveMarkdownFile(inboxPath, parsed.data, parsed.content);
    }
  }

  res.json({
    success: true,
    createdFuenteId,
    createdAtomicIds,
    inboxProcessed: inboxId
  });
});

// -------------------------------------------------------------
// Preguntas y Autoevaluación
// -------------------------------------------------------------

// Crear o actualizar pregunta asociada a nota atómica
app.post('/api/questions', (req, res) => {
  const { nota_id, pregunta, respuesta } = req.body;
  if (![nota_id,pregunta,respuesta].every(v => typeof v === 'string' && v.trim()) || !/^[a-z0-9_-]+$/.test(nota_id)) {
    return res.status(400).json({ error: 'nota_id, pregunta y respuesta son obligatorios' });
  }

  const today = getTodayString();
  if (!findNoteFilePath('atomica', nota_id)) return res.status(404).json({error:'Atomic note not found'});
  const qId = `pregunta-${nota_id.replace(/^atomica-/, '')}`;
  const qPath = path.join(DIRS.pregunta, `${qId}.md`);

  let qData = {
    nota_id,
    ease_factor: 2.5,
    intervalo_dias: 1,
    proxima_revision: today,
    historial: [],
    repeticiones: 0
  };

  if (fs.existsSync(qPath)) {
    const existing = parseMarkdownFile(qPath);
    if (existing) {
      qData = { ...qData, ...existing.data };
    }
  }

  const content = `- P: ${pregunta.trim()}\n- R: ${respuesta.trim()}\n`;
  saveMarkdownFile(qPath, qData, content);

  res.json({ success: true, id: qId, data: qData });
});

// -------------------------------------------------------------
// Cola de Repaso y Calificación SM-2
// -------------------------------------------------------------

app.get('/api/reviews/queue', (req, res) => {
  const result = buildInterleavedQueue(req.query.all === 'true', req.query.campo, req.query.proyecto);
  res.json(result);
});

app.post('/api/reviews/grade', (req, res) => {
  const { preguntaId, q } = req.body;
  if (typeof preguntaId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(preguntaId) || !Number.isInteger(q) || q < 0 || q > 5) {
    return res.status(400).json({ error: 'Parámetros inválidos. q debe estar entre 0 y 5.' });
  }

  const qPath = path.join(DIRS.pregunta, `${preguntaId}.md`);
  if (!fs.existsSync(qPath)) {
    return res.status(404).json({ error: 'Pregunta no encontrada' });
  }

  const parsed = parseMarkdownFile(qPath);
  const data = parsed.data;
  const currentEase = Number(data.ease_factor) || 2.5;
  const currentInterval = Number(data.intervalo_dias) || 1;
  const repeticiones = Number(data.repeticiones) || 0;

  const sm2Result = calculateSM2(currentEase, currentInterval, repeticiones, Number(q));
  const today = getTodayString();

  // Actualizar datos de la pregunta
  data.ease_factor = sm2Result.ease_factor;
  data.intervalo_dias = sm2Result.intervalo_dias;
  data.repeticiones = sm2Result.repeticiones;
  data.proxima_revision = sm2Result.proxima_revision;

  if (!Array.isArray(data.historial)) data.historial = [];
  data.historial.push({
    fecha: today,
    acierto: q >= 3,
    calificacion: q,
    intervalo: sm2Result.intervalo_dias,
    ease: sm2Result.ease_factor
  });

  saveMarkdownFile(qPath, data, parsed.content);

  // Actualizar ultimo_repaso en la nota atómica asociada
  if (data.nota_id) {
    const aPath = findNoteFilePath('atomica', data.nota_id);
    if (aPath && fs.existsSync(aPath)) {
      const aParsed = parseMarkdownFile(aPath);
      if (aParsed) {
        aParsed.data.ultimo_repaso = today;
        saveMarkdownFile(aPath, aParsed.data, aParsed.content);
      }
    }
  }

  // Registrar en 06-spaced-repetition/registro-repasos.md
  try {
    const regPath = path.join(DIRS.repaso, 'registro-repasos.md');
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const logEntry = `- fecha: "${timestamp}"\n  pregunta: "${preguntaId}"\n  nota_id: "${data.nota_id}"\n  calificacion: ${q}\n  intervalo_dias: ${sm2Result.intervalo_dias}\n  ease_factor: ${sm2Result.ease_factor}\n`;

    let regParsed = { data: { tipo: 'registro-repasos' }, content: '' };
    if (fs.existsSync(regPath)) {
      const p = parseMarkdownFile(regPath);
      if (p) regParsed = p;
    }
    const updatedContent = (regParsed.content.trim() + '\n' + logEntry).trim() + '\n';
    saveMarkdownFile(regPath, regParsed.data, updatedContent);
  } catch (err) {
    console.error('Error actualizando registro-repasos.md:', err.message);
  }

  // Regenerar cola de repaso
  const queueResult = buildInterleavedQueue();

  res.json({
    success: true,
    sm2: sm2Result,
    queue: queueResult
  });
});

// -------------------------------------------------------------
// Grafo de Conocimiento
// -------------------------------------------------------------
app.get('/api/graph', (req, res) => {
  const atomicas = getAllNotesFromDir('atomica');
  const fuentes = getAllNotesFromDir('fuente');
  const mapas = getAllNotesFromDir('mapa');

  const nodes = [];
  const links = [];
  const nodeSet = new Set();

  function addNode(id, label, type, extra = {}) {
    if (!nodeSet.has(id)) {
      nodeSet.add(id);
      nodes.push({ id, label, type, ...extra });
    }
  }

  // Nodos de mapas
  mapas.forEach(m => {
    addNode(m.id, m.data.titulo || m.id, 'mapa', {
      carpeta: m.carpeta || '',
      campo: m.campo || '',
      proyecto: m.proyecto || '',
      tags: m.tags || [],
      subtemas: Array.isArray(m.data.subtemas) ? m.data.subtemas : []
    });
    const subtemas = Array.isArray(m.data.subtemas) ? m.data.subtemas : [];
    subtemas.forEach(s => {
      if (s && s.nota_id) {
        links.push({
          source: m.id,
          target: s.nota_id,
          label: s.razon || 'subtema',
          type: 'mapa-subtema'
        });
      }
    });
  });

  // Nodos fuentes
  fuentes.forEach(f => {
    addNode(f.id, f.data.titulo || f.id, 'fuente', {
      autor: f.data.autor,
      carpeta: f.carpeta || '',
      campo: f.campo || '',
      proyecto: f.proyecto || '',
      tags: f.tags || []
    });
    const ideas = Array.isArray(f.data.ideas_disparadas) ? f.data.ideas_disparadas : [];
    ideas.forEach(i => {
      links.push({
        source: f.id,
        target: i,
        label: 'dispara idea',
        type: 'fuente-idea'
      });
    });
  });

  // Nodos atómicas
  atomicas.forEach(a => {
    addNode(a.id, a.data.titulo || a.id, 'atomica', {
      ultimo_repaso: a.data.ultimo_repaso,
      carpeta: a.carpeta || '',
      campo: a.campo || '',
      proyecto: a.proyecto || '',
      tags: a.tags || []
    });

    if (a.data.fuente) {
      links.push({
        source: a.data.fuente,
        target: a.id,
        label: 'fuente',
        type: 'fuente-idea'
      });
    }

    const wikilinks = (a.content.match(/\[\[([a-zA-Z0-9_-]+)\]\]/g) || []).map(m => m.replace(/\[\[|\]\]/g, ''));
    const explicitLinks = Array.isArray(a.data.enlaces) ? a.data.enlaces : [];
    new Set([...wikilinks, ...explicitLinks]).forEach(t => {
      links.push({
        source: a.id,
        target: t,
        label: 'conecta',
        type: 'atomica-enlace'
      });
    });
  });

  // Filtrar links con extremos válidos y deduplicar pares
  const validLinks = [];
  const seenLinkPairs = new Set();
  links.forEach(l => {
    if (l.source !== l.target && nodeSet.has(l.source) && nodeSet.has(l.target)) {
      const pairKey = [l.source, l.target].sort().join('::') + '::' + l.type;
      if (!seenLinkPairs.has(pairKey)) {
        seenLinkPairs.add(pairKey);
        validLinks.push(l);
      }
    }
  });

  // Calcular grado de conectividad por nodo
  const degreeMap = {};
  validLinks.forEach(l => {
    degreeMap[l.source] = (degreeMap[l.source] || 0) + 1;
    degreeMap[l.target] = (degreeMap[l.target] || 0) + 1;
  });

  nodes.forEach(n => {
    n.degree = degreeMap[n.id] || 0;
  });

  res.json({ nodes, links: validLinks });
});

// -------------------------------------------------------------
// Estadísticas del Sistema
// -------------------------------------------------------------
app.get('/api/stats', (req, res) => {
  const bandeja = getAllNotesFromDir('bandeja');
  const atomica = getAllNotesFromDir('atomica');
  const fuente = getAllNotesFromDir('fuente');
  const mapa = getAllNotesFromDir('mapa');
  const preguntas = getAllQuestions();
  const today = getTodayString();

  const inboxPendientes = bandeja.filter(b => !b.data.procesada).length;
  const repasosPendientes = preguntas.filter(q => q.proxima_revision <= today).length;

  // Total de repasos registrados
  let totalRepasosHechos = 0;
  preguntas.forEach(q => {
    totalRepasosHechos += (q.historial || []).length;
  });

  res.json({
    inboxTotal: bandeja.length,
    inboxPendientes,
    atomicasTotal: atomica.length,
    fuentesTotal: fuente.length,
    mapasTotal: mapa.length,
    preguntasTotal: preguntas.length,
    repasosPendientes,
    totalRepasosHechos,
    today
  });
});

// -------------------------------------------------------------
// Analítica de Aprendizaje y Retención SM-2
// -------------------------------------------------------------
app.get('/api/analytics', (req, res) => {
  const preguntas = getAllQuestions();
  const today = getTodayString();
  const todayDate = new Date(today);

  let totalReviews = 0;
  let successfulReviews = 0;
  let sumEase = 0;

  let nuevas = 0;
  let enAprendizaje = 0;
  let maduras = 0;

  let dueToday = 0;
  let due1to7 = 0;
  let due8to30 = 0;
  let dueLater = 0;

  preguntas.forEach(q => {
    sumEase += q.ease_factor;
    const reps = q.repeticiones || 0;
    const interval = q.intervalo_dias || 1;

    // Madurez de tarjetas
    if (reps === 0) nuevas++;
    else if (interval < 21) enAprendizaje++;
    else maduras++;

    // Historial y tasa de retención
    (q.historial || []).forEach(h => {
      totalReviews++;
      if (h.acierto || (h.calificacion !== undefined && h.calificacion >= 3)) {
        successfulReviews++;
      }
    });

    // Pronóstico según proxima_revision
    const qDate = new Date(q.proxima_revision);
    const diffDays = Math.ceil((qDate - todayDate) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) dueToday++;
    else if (diffDays <= 7) due1to7++;
    else if (diffDays <= 30) due8to30++;
    else dueLater++;
  });

  const retentionRate = totalReviews > 0 ? Math.round((successfulReviews / totalReviews) * 100) : 100;
  const avgEase = preguntas.length > 0 ? Number((sumEase / preguntas.length).toFixed(2)) : 2.5;

  // Cálculo de racha (streak) desde registro-repasos.md
  let streak = 0;
  try {
    const regPath = path.join(DIRS.repaso, 'registro-repasos.md');
    if (fs.existsSync(regPath)) {
      const regContent = fs.readFileSync(regPath, 'utf-8');
      const dateMatches = regContent.match(/fecha:\s*"?(\d{4}-\d{2}-\d{2})/g) || [];
      const distinctDates = new Set(dateMatches.map(m => m.replace(/fecha:\s*"?/, '')));

      let checkDate = new Date(today);
      let dayStr = checkDate.toISOString().split('T')[0];

      if (!distinctDates.has(dayStr)) {
        checkDate.setDate(checkDate.getDate() - 1);
        dayStr = checkDate.toISOString().split('T')[0];
      }

      while (distinctDates.has(dayStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
        dayStr = checkDate.toISOString().split('T')[0];
      }
    }
  } catch (e) {
    console.error('Error calculando racha:', e.message);
  }

  res.json({
    totalCards: preguntas.length,
    totalReviews,
    retentionRate,
    avgEase,
    streak,
    maturity: {
      nuevas,
      enAprendizaje,
      maduras
    },
    forecast: {
      dueToday,
      due1to7,
      due8to30,
      dueLater
    }
  });
});

// -------------------------------------------------------------
// Exportación a Anki (TSV)
// -------------------------------------------------------------
app.get('/api/export/anki', (req, res) => {
  const preguntas = getAllQuestions();
  let tsv = '#separator:tab\n#html:true\n#tags column:3\n';

  preguntas.forEach(q => {
    const p = (q.pregunta || '').replace(/\t/g, ' ').replace(/\n/g, '<br>');
    const r = (q.respuesta || '').replace(/\t/g, ' ').replace(/\n/g, '<br>');
    const tag = `notesapp_${q.nota_id || 'general'}`;
    tsv += `${p}\t${r}\t${tag}\n`;
  });

  res.setHeader('Content-Type', 'text/tab-separated-values; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="notesapp-anki-deck.txt"');
  res.send(tsv);
});

// -------------------------------------------------------------
// Exportación de Guía de Estudio Compilada en Markdown
// -------------------------------------------------------------
app.get('/api/export/study-guide/:mapaId', (req, res) => {
  const { mapaId } = req.params;
  const lang = req.query.lang || 'es';
  const mapaPath = findNoteFilePath('mapa', mapaId);
  if (!mapaPath || !fs.existsSync(mapaPath)) {
    return res.status(404).json({ error: 'note_not_found' });
  }

  const mapa = parseMarkdownFile(mapaPath);
  const subtemas = Array.isArray(mapa.data.subtemas) ? mapa.data.subtemas : [];
  const atomicNotes = getAllNotesFromDir('atomica');
  const atomicMap = {};
  atomicNotes.forEach(a => { atomicMap[a.id] = a; });
  const questions = getAllQuestions();
  const questionMap = {};
  questions.forEach(q => { questionMap[q.nota_id] = q; });

  const L = lang === 'en' ? {
    title: 'Study Guide', compiled: 'Automatically compiled from NotesApp', generated: 'Generated on',
    structure: 'Map Structure & Relationships', reason: 'Connection reason',
    detail: 'Detailed Concept Development', reasonInMap: 'Reason in this map',
    questions: 'Self-Assessment Questions (Active Recall)', question: 'Question',
    showAnswer: 'Show Answer', q: 'Q', a: 'A'
  } : {
    title: 'Guía de Estudio', compiled: 'Compilado automáticamente desde NotesApp', generated: 'Generado el',
    structure: 'Estructura y Relaciones del Mapa', reason: 'Razón de conexión',
    detail: 'Desarrollo Detallado de Conceptos', reasonInMap: 'Razón en este mapa',
    questions: 'Preguntas de Autoevaluación (Recuperación Activa)', question: 'Pregunta',
    showAnswer: 'Mostrar Respuesta', q: 'P', a: 'R'
  };

  let doc = `# ${L.title}: ${mapa.data.titulo || mapaId}\n\n`;
  doc += `> ${L.compiled}. ${L.generated} ${getTodayString()}.\n\n`;
  doc += `## ${L.structure}\n\n`;

  subtemas.forEach((s, idx) => {
    const a = atomicMap[s.nota_id];
    const title = a ? (a.data.titulo || s.nota_id) : s.nota_id;
    doc += `${idx + 1}. **${title}**\n   - *${L.reason}:* ${s.razon}\n\n`;
  });

  doc += `---\n\n## ${L.detail}\n\n`;

  subtemas.forEach((s, idx) => {
    const a = atomicMap[s.nota_id];
    if (a) {
      doc += `### ${idx + 1}. ${a.data.titulo || s.nota_id}\n\n`;
      doc += `*${L.reasonInMap}:* ${s.razon}\n\n`;
      doc += `${a.content}\n\n`;
    }
  });

  doc += `---\n\n## ${L.questions}\n\n`;
  subtemas.forEach((s, idx) => {
    const q = questionMap[s.nota_id];
    if (q) {
      doc += `### ${L.question} ${idx + 1}\n`;
      doc += `**${L.q}:** ${q.pregunta}\n\n`;
      doc += `<details><summary>${L.showAnswer}</summary>\n\n**${L.a}:** ${q.respuesta}\n\n</details>\n\n`;
    }
  });

  const filename = lang === 'en' ? `study-guide-${mapaId}.md` : `guia-${mapaId}.md`;
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(doc);
});

// -------------------------------------------------------------
// Importación de Paquetes JSON Categorizados
// -------------------------------------------------------------
app.post('/api/import/json', (req, res) => {
  try {
    let payload = req.body;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (err) {
        return res.status(400).json({ error: 'El cuerpo de la petición no es un JSON válido: ' + err.message });
      }
    } else if (payload && typeof payload.json === 'string') {
      try {
        payload = JSON.parse(payload.json);
      } catch (err) {
        return res.status(400).json({ error: 'El contenido JSON no es válido: ' + err.message });
      }
    }

    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'El payload debe ser un objeto JSON estructurado.' });
    }

    const carpetas = payload.carpetas || payload.folders;
    const notas_fuente = payload.notas_fuente || payload.source_notes || payload.sources || payload.fuentes;
    const notas_atomicas = payload.notas_atomicas || payload.atomic_notes || payload.atomics || payload.atomicas;
    const mapas_contenido = payload.mapas_contenido || payload.content_maps || payload.maps || payload.mapas;
    const bandeja = payload.bandeja || payload.inbox;

    const hasAnyContent = (Array.isArray(notas_fuente) && notas_fuente.length > 0) ||
      (Array.isArray(notas_atomicas) && notas_atomicas.length > 0) ||
      (Array.isArray(mapas_contenido) && mapas_contenido.length > 0) ||
      (Array.isArray(bandeja) && bandeja.length > 0) ||
      (carpetas && typeof carpetas === 'object' && Object.keys(carpetas).length > 0);

    if (!hasAnyContent) {
      return res.status(400).json({ error: 'El archivo JSON no contiene elementos válidos para importar (notas_fuente, notas_atomicas, mapas_contenido, bandeja o carpetas).' });
    }

    const reqBody = (req.body && typeof req.body === 'object') ? req.body : {};
    const hasExplicitWrapper = Boolean(reqBody && typeof reqBody.json === 'string');
    const explicitUICampo = hasExplicitWrapper ? String(reqBody.campo || '').trim() : '';
    const explicitUIProyecto = hasExplicitWrapper ? String(reqBody.proyecto || '').trim() : '';

    const metaObj = (payload.proyecto_meta || payload.project_meta || {});
    const importCampo = (explicitUICampo || reqBody.campo || payload.campo || payload.field || metaObj.campo || metaObj.field || '').trim();
    const importProyecto = (explicitUIProyecto || reqBody.proyecto || payload.proyecto || payload.project || metaObj.proyecto || metaObj.nombre || metaObj.name || '').trim();
    const rawImportTipo = (
      reqBody.proyectoTipo ||
      payload.proyecto_tipo ||
      payload.tipo_proyecto ||
      payload.proyectoTipo ||
      payload.project_type ||
      payload.projectType ||
      payload.tipo ||
      metaObj.tipo ||
      metaObj.type ||
      ''
    ).trim().toLowerCase();
    const validProjectTypes = ['curso', 'noticias', 'investigacion', 'libro', 'trabajo', 'otro'];
    const importTipo = validProjectTypes.includes(rawImportTipo) ? rawImportTipo : '';

    const rawImportDesc = (
      reqBody.proyectoDescripcion ||
      payload.proyecto_descripcion ||
      payload.descripcion_proyecto ||
      payload.proyectoDescripcion ||
      payload.project_description ||
      payload.projectDescription ||
      payload.descripcion ||
      metaObj.descripcion ||
      metaObj.description ||
      ''
    ).trim();

    let resolvedCampo = importCampo;
    let resolvedProyecto = importProyecto;
    if (!resolvedCampo && !explicitUIProyecto) {
      const firstWithCampo = [...(notas_fuente || []), ...(notas_atomicas || []), ...(mapas_contenido || [])].find(x => x && (x.campo || x.field));
      if (firstWithCampo) resolvedCampo = (firstWithCampo.campo || firstWithCampo.field || '').trim();
    }
    if (!resolvedProyecto) {
      const firstWithProj = [...(notas_fuente || []), ...(notas_atomicas || []), ...(mapas_contenido || [])].find(x => x && (x.proyecto || x.project));
      if (firstWithProj) resolvedProyecto = (firstWithProj.proyecto || firstWithProj.project || '').trim();
    }

    let importDesc = rawImportDesc;
    if (!importDesc && (resolvedCampo || resolvedProyecto)) {
      const fallbackMapDesc = Array.isArray(mapas_contenido) && mapas_contenido[0] && (mapas_contenido[0].descripcion || mapas_contenido[0].description);
      const fallbackSourceDesc = Array.isArray(notas_fuente) && notas_fuente[0] && (notas_fuente[0].puntos_clave || notas_fuente[0].key_points);
      importDesc = String(fallbackMapDesc || fallbackSourceDesc || '').trim().slice(0, 220);
    }

    let pSlug = resolvedProyecto ? slugify(resolvedProyecto) : '';
    let cSlug = resolvedCampo ? slugify(resolvedCampo) : '';

    const meta = readProjectsMetadata();
    if (!meta.campos) meta.campos = {};
    let existingProy = (cSlug && pSlug) ? meta.campos?.[cSlug]?.proyectos?.[pSlug] : null;

    // Si el proyecto ya existe en otro campo (o no se indicó campo, o el LLM varió el campo), vincular al proyecto existente
    if (!existingProy && pSlug) {
      for (const [cKey, cObj] of Object.entries(meta.campos)) {
        if (cObj && cObj.proyectos && cObj.proyectos[pSlug]) {
          if (!explicitUICampo || slugify(explicitUICampo) === cKey) {
            cSlug = cKey;
            resolvedCampo = cObj.nombre || humanizeSlug(cKey);
            existingProy = cObj.proyectos[pSlug];
            break;
          }
        }
      }
    }

    // Si sigue sin coincidir exactamente y no fue forzado manualmente en la UI, comprobar si el LLM añadió sufijos como "- Módulo 1" o "- Lección 2" a un proyecto existente
    if (!existingProy && pSlug && !explicitUIProyecto) {
      const suffixKeywords = /^(modulo|module|leccion|lesson|tema|unidad|unit|capitulo|chapter|parte|part|semana|week|clase|bloque|entrega|sesion)\b/;
      for (const [cKey, cObj] of Object.entries(meta.campos)) {
        if (!cObj || !cObj.proyectos) continue;
        for (const [pKey, pObj] of Object.entries(cObj.proyectos)) {
          if (pSlug.startsWith(pKey + '-')) {
            const remainder = pSlug.slice(pKey.length + 1);
            if (suffixKeywords.test(remainder)) {
              cSlug = cKey;
              pSlug = pKey;
              resolvedCampo = cObj.nombre || humanizeSlug(cKey);
              resolvedProyecto = pObj.nombre || humanizeSlug(pKey);
              existingProy = pObj;
              break;
            }
          }
        }
        if (existingProy) break;
      }
    }

    // Si hay proyecto pero no campo, asignar 'General' por defecto para no dejar el proyecto huérfano
    if (pSlug && !cSlug) {
      cSlug = 'general';
      resolvedCampo = meta.campos?.general?.nombre || 'General';
      existingProy = meta.campos?.[cSlug]?.proyectos?.[pSlug] || null;
    }

    // Canonicalizar nombres con los registrados en proyectos.json
    if (cSlug && meta.campos[cSlug]?.nombre) {
      resolvedCampo = meta.campos[cSlug].nombre;
    }
    if (existingProy && existingProy.nombre) {
      resolvedProyecto = existingProy.nombre;
    }

    const wasNewProject = Boolean(cSlug && pSlug && !existingProy);

    const importModulo = (
      reqBody.modulo ||
      payload.modulo ||
      payload.module ||
      payload.unidad ||
      metaObj.modulo ||
      metaObj.module ||
      ''
    ).trim();

    const hasExplicitLesson = Boolean(
      reqBody.leccionNumero ||
      payload.leccion_numero ||
      payload.numero_leccion ||
      payload.leccionNumero ||
      payload.leccion ||
      payload.lesson ||
      payload.tema_numero ||
      metaObj.leccion_numero
    );
    const effectiveTipo = importTipo || (existingProy && existingProy.tipo) || (hasExplicitLesson ? 'curso' : (cSlug && pSlug ? 'curso' : 'otro'));
    const isCourse = effectiveTipo === 'curso' || hasExplicitLesson || Boolean(importModulo);

    let lessonNum = 1;
    let lessonTitle = '';
    if (isCourse) {
      const rawNum = reqBody.leccionNumero || payload.leccion_numero || payload.numero_leccion || payload.leccionNumero || payload.leccion || payload.lesson || payload.tema_numero || metaObj.leccion_numero;
      if (rawNum !== undefined && rawNum !== null && rawNum !== '') {
        lessonNum = parseInt(rawNum, 10) || 1;
      } else if (existingProy && Array.isArray(existingProy.lecciones) && existingProy.lecciones.length > 0) {
        lessonNum = existingProy.lecciones.length + 1;
      } else {
        lessonNum = 1;
      }
      lessonTitle = (
        reqBody.leccionTitulo ||
        payload.leccion_titulo ||
        payload.titulo_leccion ||
        payload.leccionTitulo ||
        payload.lesson_title ||
        payload.lessonTitle ||
        payload.tema_titulo ||
        payload.tema ||
        metaObj.leccion_titulo ||
        (Array.isArray(notas_fuente) && notas_fuente[0] && (notas_fuente[0].titulo || notas_fuente[0].title)) ||
        ''
      ).trim();
      if (!lessonTitle) {
        lessonTitle = `Lección ${lessonNum}`;
      }
    }

    const planned = new Set();
    const idRemap = new Map();
    const isProjectScopedImport = Boolean(cSlug || pSlug);
    const placeholderIds = new Set([
      'fuente-nombre-documento',
      'fuente-document-name',
      'atomica-concepto-uno',
      'atomica-concepto-dos',
      'atomica-concepto-tres',
      'atomica-concept-one',
      'atomica-concept-two',
      'atomica-concept-three',
      'mapa-tema-principal',
      'mapa-main-topic'
    ]);
    const collections = [
      [notas_fuente, 'fuente', 'fuente-'],
      [notas_atomicas, 'atomica', 'atomica-'],
      [mapas_contenido, 'mapa', 'mapa-']
    ];

    for (const [col, type, prefix] of collections) {
      if (col !== undefined && !Array.isArray(col)) return res.status(400).json({ error: 'Import collections must be arrays' });
      for (const note of col || []) {
        if (!note) return res.status(400).json({ error: 'Every imported note needs a title' });
        if (!note.titulo && note.title) note.titulo = note.title;
        if (typeof note.titulo !== 'string' || !note.titulo.trim()) return res.status(400).json({ error: 'Every imported note needs a title' });
        for (const arrField of ['puntos_clave', 'puntosClave', 'key_points']) {
          if (Array.isArray(note[arrField]) && note[arrField].every(v => typeof v === 'string')) {
            note[arrField] = note[arrField].map(v => v.trim().startsWith('-') ? v.trim() : `- ${v.trim()}`).join('\n');
          }
        }
        for (const field of ['content', 'contenido', 'descripcion', 'description', 'idea', 'puntos_clave', 'puntosClave', 'key_points']) {
          if (note[field] !== undefined && typeof note[field] !== 'string') return res.status(400).json({ error: 'Import text fields must be strings' });
        }
        let rawId = note.id ? slugify(note.id) : prefix + slugify(note.titulo);
        if (!rawId.startsWith(prefix)) rawId = prefix + rawId;
        let id = rawId;

        if (isProjectScopedImport) {
          const titleSlug = slugify(note.titulo);
          if (placeholderIds.has(id) && titleSlug) {
            id = prefix + titleSlug;
          }
          if (type !== 'mapa') {
            if (planned.has(type + id) || findNoteFilePath(type, id)) {
              const titleBasedId = titleSlug ? (prefix + titleSlug) : id;
              if (!planned.has(type + titleBasedId) && !findNoteFilePath(type, titleBasedId)) {
                id = titleBasedId;
              } else {
                const baseCandidate = titleBasedId;
                let suffix = 2;
                let candidate = `${baseCandidate}-${suffix}`;
                while (planned.has(type + candidate) || findNoteFilePath(type, candidate)) {
                  suffix++;
                  candidate = `${baseCandidate}-${suffix}`;
                }
                id = candidate;
              }
            }
          }
          if (id !== rawId) {
            idRemap.set(rawId, id);
            const rawWithoutPrefix = rawId.slice(prefix.length);
            if (rawWithoutPrefix) idRemap.set(rawWithoutPrefix, id);
          }
          note.id = id;
        } else {
          if (planned.has(type + id)) return res.status(409).json({ error: 'Import would overwrite an existing or duplicate note: ' + id });
          if (findNoteFilePath(type, id)) {
            return res.status(409).json({ error: 'Import would overwrite an existing or duplicate note: ' + id });
          }
        }
        planned.add(type + id);
        if (type === 'mapa') {
          if (note.subtopics && !note.subtemas) note.subtemas = note.subtopics;
          if (note.subtemas !== undefined && !Array.isArray(note.subtemas)) return res.status(400).json({ error: 'Every map connection needs an explicit reason' });
          if (Array.isArray(note.subtemas)) {
            for (const sub of note.subtemas) {
              if (sub && sub.note_id && !sub.nota_id) sub.nota_id = sub.note_id;
              if (sub && sub.reason && !sub.razon) sub.razon = sub.reason;
              if (isProjectScopedImport && sub && typeof sub.nota_id === 'string' && (!sub.razon || !String(sub.razon).trim())) {
                sub.razon = 'Subtema estructurado dentro del mapa conceptual';
              }
              if (!sub || typeof sub.nota_id !== 'string' || typeof sub.razon !== 'string' || !sub.razon.trim()) {
                return res.status(400).json({ error: 'Every map connection needs an explicit reason' });
              }
            }
          }
        }
      }
    }

    // Si se renombraron IDs por colisión o placeholder, actualizar referencias internas del lote
    if (idRemap.size > 0) {
      const remapRef = (ref, expectedPrefix) => {
        if (!ref || typeof ref !== 'string') return ref;
        const s = slugify(ref);
        const withPref = s.startsWith(expectedPrefix) ? s : expectedPrefix + s;
        return idRemap.get(withPref) || idRemap.get(s) || ref;
      };
      const remapTextWikilinks = (txt) => {
        if (!txt || typeof txt !== 'string') return txt;
        return txt.replace(/\[\[([a-zA-Z0-9_-]+)\]\]/g, (match, slug) => {
          const s = slugify(slug);
          const withAtom = s.startsWith('atomica-') ? s : 'atomica-' + s;
          const mapped = idRemap.get(withAtom) || idRemap.get(s);
          return mapped ? `[[${mapped}]]` : match;
        });
      };
      for (const f of notas_fuente || []) {
        if (Array.isArray(f.ideas_disparadas)) f.ideas_disparadas = f.ideas_disparadas.map(x => remapRef(x, 'atomica-'));
        if (Array.isArray(f.ideas_sparked)) f.ideas_sparked = f.ideas_sparked.map(x => remapRef(x, 'atomica-'));
      }
      for (const a of notas_atomicas || []) {
        if (a.fuente) a.fuente = remapRef(a.fuente, 'fuente-');
        if (a.source) a.source = remapRef(a.source, 'fuente-');
        if (Array.isArray(a.enlaces)) a.enlaces = a.enlaces.map(x => remapRef(x, 'atomica-'));
        if (Array.isArray(a.links)) a.links = a.links.map(x => remapRef(x, 'atomica-'));
        for (const tf of ['idea', 'por_que_importa', 'porQueImporta', 'why_it_matters', 'como_se_conecta', 'comoSeConecta', 'how_it_connects']) {
          if (typeof a[tf] === 'string') a[tf] = remapTextWikilinks(a[tf]);
        }
      }
      for (const m of mapas_contenido || []) {
        if (Array.isArray(m.subtemas)) {
          m.subtemas.forEach(s => {
            if (s && s.nota_id) s.nota_id = remapRef(s.nota_id, 'atomica-');
          });
        }
      }
    }

    if (bandeja !== undefined && (!Array.isArray(bandeja) || bandeja.some(b => typeof b !== 'string' && (!b || typeof (b.contenido || b.texto || b.content || b.text) !== 'string')))) return res.status(400).json({ error: 'Invalid inbox import' });
    const stats = {
      carpetas: 0,
      fuentes: 0,
      atomicas: 0,
      preguntas: 0,
      mapas: 0,
      bandeja: 0,
      enlaces_inter_leccion: 0,
      proyecto_creado: wasNewProject,
      campo: resolvedCampo || null,
      proyecto: resolvedProyecto || null,
      proyecto_tipo: (cSlug && pSlug) ? effectiveTipo : null
    };

    const today = getTodayString();
    const rawLang = req.query.lang || (reqBody && reqBody.lang) || (payload && (payload.lang || payload.language));
    let defaultLang = rawLang === 'en' ? 'en' : (rawLang === 'es' ? 'es' : null);

    if (!defaultLang) {
      if (payload.source_notes || payload.atomic_notes || payload.content_maps) {
        defaultLang = 'en';
      }
    }

    function detectNoteLanguage(note, fallback) {
      if (!note) return fallback || 'es';
      if (note.lang === 'en' || note.language === 'en') return 'en';
      if (note.lang === 'es' || note.language === 'es') return 'es';
      if (note.why_it_matters || note.how_it_connects || note.key_points || note.ideas_sparked || note.self_assessment || note.question) return 'en';
      if (note.por_que_importa || note.como_se_conecta || note.puntos_clave || note.ideas_disparadas || note.autoevaluacion || note.pregunta) return 'es';
      const sample = `${note.titulo || note.title || ''} ${note.idea || ''} ${note.puntos_clave || note.key_points || ''} ${note.puntosClave || ''}`;
      const enWords = (sample.match(/\b(the|is|in|at|which|on|and|a|an|with|that|this|as|to|of|for|by|from|not|are|it|have)\b/gi) || []).length;
      const esWords = (sample.match(/\b(el|la|los|las|un|una|es|en|con|que|por|para|como|del|al|su|sus|no|son|este|esta)\b/gi) || []).length;
      if (enWords > esWords + 1) return 'en';
      if (esWords > enWords + 1) return 'es';
      return fallback || 'es';
    }

    // 1. Crear carpetas físicas del proyecto o carpetas explícitas si vienen sin proyecto
    if (cSlug && pSlug) {
      ['fuente', 'atomica', 'mapa'].forEach(t => {
        const projDir = path.join(DIRS[t], cSlug, pSlug);
        if (!fs.existsSync(projDir)) {
          fs.mkdirSync(projDir, { recursive: true });
          stats.carpetas++;
        }
      });
    } else if (carpetas && typeof carpetas === 'object') {
      Object.keys(carpetas).forEach(tipo => {
        const mappedTipo = tipo === 'sources' ? 'fuente' : (tipo === 'atomics' ? 'atomica' : (tipo === 'maps' ? 'mapa' : tipo));
        if (DIRS[mappedTipo] && Array.isArray(carpetas[tipo])) {
          carpetas[tipo].forEach(folderName => {
            const cleanFolder = slugify(folderName);
            if (cleanFolder) {
              const fullFolderPath = path.join(DIRS[mappedTipo], cleanFolder);
              if (!fs.existsSync(fullFolderPath)) {
                fs.mkdirSync(fullFolderPath, { recursive: true });
                stats.carpetas++;
              }
            }
          });
        }
      });
    }

    let firstFuenteId = null;

    // 2. Importar Notas Fuente (02-source-notes)
    if (Array.isArray(notas_fuente)) {
      notas_fuente.forEach(f => {
        if (!f) return;
        if (!f.titulo && f.title) f.titulo = f.title;
        if (!f.titulo) return;
        let fId = f.id ? slugify(f.id) : ('fuente-' + slugify(f.titulo));
        if (!fId.startsWith('fuente-')) fId = 'fuente-' + fId;
        if (!firstFuenteId) firstFuenteId = fId;

        const fCampo = (resolvedCampo || f.campo || f.field || '').trim();
        const fProyecto = (resolvedProyecto || f.proyecto || f.project || '').trim();
        let folder = '';
        if (fCampo || fProyecto) {
          const cS = fCampo ? slugify(fCampo) : 'general';
          const pS = fProyecto ? slugify(fProyecto) : '';
          folder = pS ? `${cS}/${pS}` : cS;
        } else if (f.carpeta || f.folder) {
          folder = slugify(f.carpeta || f.folder);
        }

        const targetDir = folder ? path.join(DIRS.fuente, folder) : DIRS.fuente;
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
          stats.carpetas++;
        }

        const ideasDisparadasRaw = f.ideas_disparadas || f.ideas_sparked || [];
        const ideasDisparadas = Array.isArray(ideasDisparadasRaw)
          ? ideasDisparadasRaw.map(id => slugify(id).startsWith('atomica-') ? slugify(id) : 'atomica-' + slugify(id))
          : [];

        const fModulo = (f.modulo || f.module || importModulo || '').trim();
        const tags = Array.isArray(f.tags) ? f.tags.map(t => slugify(t)) : [];
        if (fModulo) {
          const modSlug = slugify(fModulo);
          if (modSlug && !tags.includes(modSlug)) tags.push(modSlug);
        }
        if (isCourse) {
          if (!tags.includes('leccion-' + lessonNum)) tags.push('leccion-' + lessonNum);
          if (!tags.includes('curso')) tags.push('curso');
        }

        const fData = {
          id: fId,
          titulo: f.titulo,
          autor: f.autor || f.author || 'Autor desconocido',
          tipo: 'fuente',
          tipo_fuente: f.tipo_fuente || f.source_type || 'articulo',
          creado: f.creado || today,
          carpeta: folder,
          campo: fCampo,
          proyecto: fProyecto,
          tags,
          ideas_disparadas: ideasDisparadas,
          busqueda_google: f.busqueda_google || f.google_search || null
        };

        if (fModulo) fData.modulo = fModulo;
        if (isCourse) {
          fData.leccion = lessonNum;
          fData.leccion_titulo = lessonTitle;
        }

        const noteLang = detectNoteLanguage(f, defaultLang || 'es');
        let fContent = noteLang === 'en'
          ? `## Key points (paraphrased, not copied)\n${f.puntos_clave || f.puntosClave || f.key_points || ''}\n\n`
          : `## Puntos clave (parafraseados, no copiados)\n${f.puntos_clave || f.puntosClave || f.key_points || ''}\n\n`;
        const quotes = f.citas_textuales || f.quotes || [];
        if (Array.isArray(quotes) && quotes.length > 0) {
          fContent += noteLang === 'en'
            ? `## Relevant verbatim quotations\n${quotes.map(c => `> ${c}`).join('\n\n')}\n\n`
            : `## Citas textuales relevantes\n${quotes.map(c => `> ${c}`).join('\n\n')}\n\n`;
        }
        fContent += noteLang === 'en' ? `## Ideas it sparks\n` : `## Ideas propias que dispara\n`;
        ideasDisparadas.forEach(iId => {
          fContent += `- [[${iId}]]\n`;
        });

        const fPath = path.join(targetDir, `${fId}.md`);
        saveMarkdownFile(fPath, fData, fContent);
        stats.fuentes++;
      });
    }

    const importedAtomicIds = [];

    // 3. Importar Notas Atómicas (03-atomic-notes) y Autoevaluación (05-self-assessment)
    if (Array.isArray(notas_atomicas)) {
      notas_atomicas.forEach(a => {
        if (!a) return;
        if (!a.titulo && a.title) a.titulo = a.title;
        if (!a.titulo) return;
        let aId = a.id ? slugify(a.id) : ('atomica-' + slugify(a.titulo));
        if (!aId.startsWith('atomica-')) aId = 'atomica-' + aId;

        const aCampo = (resolvedCampo || a.campo || a.field || '').trim();
        const aProyecto = (resolvedProyecto || a.proyecto || a.project || '').trim();
        let folder = '';
        if (aCampo || aProyecto) {
          const cS = aCampo ? slugify(aCampo) : 'general';
          const pS = aProyecto ? slugify(aProyecto) : '';
          folder = pS ? `${cS}/${pS}` : cS;
        } else if (a.carpeta || a.folder) {
          folder = slugify(a.carpeta || a.folder);
        }

        const targetDir = folder ? path.join(DIRS.atomica, folder) : DIRS.atomica;
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
          stats.carpetas++;
        }

        // Sanitizar fuente
        let fuenteId = null;
        const rawFuente = a.fuente || a.source || firstFuenteId;
        if (rawFuente) {
          fuenteId = slugify(rawFuente);
          if (!fuenteId.startsWith('fuente-')) fuenteId = 'fuente-' + fuenteId;
        }

        // Enlaces wikilink
        const explicitLinks = Array.isArray(a.enlaces || a.links) ? (a.enlaces || a.links).map(l => slugify(l)) : [];
        const aModulo = (a.modulo || a.module || importModulo || '').trim();
        const tags = Array.isArray(a.tags) ? a.tags.map(t => slugify(t)) : [];
        if (aModulo) {
          const modSlug = slugify(aModulo);
          if (modSlug && !tags.includes(modSlug)) tags.push(modSlug);
        }
        if (isCourse) {
          if (!tags.includes('leccion-' + lessonNum)) tags.push('leccion-' + lessonNum);
          if (!tags.includes('curso')) tags.push('curso');
        }

        const aData = {
          id: aId,
          titulo: a.titulo,
          tipo: 'atomica',
          fuente: fuenteId,
          carpeta: folder,
          campo: aCampo,
          proyecto: aProyecto,
          tags,
          enlaces: explicitLinks,
          creado: a.creado || today,
          ultimo_repaso: a.ultimo_repaso || null,
          busqueda_google: a.busqueda_google || a.google_search || null
        };

        if (aModulo) aData.modulo = aModulo;
        if (isCourse) {
          aData.leccion = lessonNum;
          aData.leccion_titulo = lessonTitle;
        }

        const noteLang = detectNoteLanguage(a, defaultLang || 'es');
        const aContent = noteLang === 'en'
          ? `## Idea (in my own words)\n${a.idea || ''}\n\n## Why it matters\n${a.por_que_importa || a.porQueImporta || a.why_it_matters || ''}\n\n## How it connects with what I already know\n${a.como_se_conecta || a.comoSeConecta || a.how_it_connects || ''}\n`
          : `## Idea (con mis palabras)\n${a.idea || ''}\n\n## ¿Por qué importa?\n${a.por_que_importa || a.porQueImporta || a.why_it_matters || ''}\n\n## ¿Cómo se conecta con lo que ya sé?\n${a.como_se_conecta || a.comoSeConecta || a.how_it_connects || ''}\n`;
        const aPath = path.join(targetDir, `${aId}.md`);
        saveMarkdownFile(aPath, aData, aContent);
        stats.atomicas++;
        importedAtomicIds.push(aId);

        // Crear flashcard de autoevaluación asociada (recuperación activa)
        const qObj = a.autoevaluacion || a.pregunta_autoevaluacion || a.flashcard || a.self_assessment
          || (a.pregunta && a.respuesta ? { pregunta: a.pregunta, respuesta: a.respuesta } : null)
          || (a.question && a.answer ? { pregunta: a.question, respuesta: a.answer } : null);
        const qPregunta = qObj && (qObj.pregunta || qObj.question);
        const qRespuesta = qObj && (qObj.respuesta || qObj.answer);
        if (qPregunta && qRespuesta) {
          const qId = `pregunta-${aId.replace(/^atomica-/, '')}`;
          const qData = {
            nota_id: aId,
            ease_factor: Number(qObj.ease_factor) || 2.5,
            intervalo_dias: Number(qObj.intervalo_dias) || 1,
            proxima_revision: qObj.proxima_revision || today,
            historial: Array.isArray(qObj.historial) ? qObj.historial : [],
            repeticiones: Number(qObj.repeticiones) || 0
          };
          const qPrefix = noteLang === 'en' ? '- Q:' : '- P:';
          const rPrefix = noteLang === 'en' ? '- A:' : '- R:';
          const qContent = `${qPrefix} ${String(qPregunta).trim()}\n${rPrefix} ${String(qRespuesta).trim()}\n`;
          const qPath = path.join(DIRS.pregunta, `${qId}.md`);
          saveMarkdownFile(qPath, qData, qContent);
          stats.preguntas++;
        }
      });
    }

    // 4. Importar Mapas de Contenido explícitos (04-content-maps)
    const importedMapIds = [];
    if (Array.isArray(mapas_contenido)) {
      mapas_contenido.forEach(m => {
        if (!m) return;
        if (!m.titulo && m.title) m.titulo = m.title;
        if (!m.titulo) return;
        let mId = m.id ? slugify(m.id) : ('mapa-' + slugify(m.titulo));
        if (!mId.startsWith('mapa-')) mId = 'mapa-' + mId;

        const mCampo = (resolvedCampo || m.campo || m.field || '').trim();
        const mProyecto = (resolvedProyecto || m.proyecto || m.project || '').trim();
        const mModulo = (m.modulo || m.module || importModulo || '').trim();
        let folder = '';
        if (mCampo || mProyecto) {
          const cS = mCampo ? slugify(mCampo) : 'general';
          const pS = mProyecto ? slugify(mProyecto) : '';
          folder = pS ? `${cS}/${pS}` : cS;
        } else if (m.carpeta || m.folder) {
          folder = slugify(m.carpeta || m.folder);
        }

        const targetDir = folder ? path.join(DIRS.mapa, folder) : DIRS.mapa;
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
          stats.carpetas++;
        }

        const subtemas = [];
        const rawSubtemas = m.subtemas || m.subtopics;
        if (Array.isArray(rawSubtemas)) {
          rawSubtemas.forEach(s => {
            const subNotaId = s && (s.nota_id || s.note_id);
            if (!s || !subNotaId) return;
            let subId = slugify(subNotaId);
            if (!subId.startsWith('atomica-')) subId = 'atomica-' + subId;
            const rawRazon = s.razon || s.reason;
            const razon = (rawRazon && String(rawRazon).trim()) ? String(rawRazon).trim() : 'Subtema estructurado dentro de la jerarquía conceptual';
            subtemas.push({
              nota_id: subId,
              razon
            });
          });
        }

        const tags = Array.isArray(m.tags) ? m.tags.map(t => slugify(t)) : [];
        if (mModulo) {
          const mSlug = slugify(mModulo);
          if (mSlug && !tags.includes(mSlug)) tags.push(mSlug);
        }
        if (isCourse) {
          const lTag = `leccion-${lessonNum}`;
          if (!tags.includes(lTag)) tags.push(lTag);
        }

        // Si ya existe en disco (e.g. mapa acumulativo de proyecto/curso), fusionar subtemas
        const existingPath = findNoteFilePath('mapa', mId);
        if (existingPath && fs.existsSync(existingPath)) {
          const parsedExisting = parseMarkdownFile(existingPath);
          if (parsedExisting) {
            const mergedSubtemas = Array.isArray(parsedExisting.data.subtemas) ? [...parsedExisting.data.subtemas] : [];
            subtemas.forEach(s => {
              if (!mergedSubtemas.some(ms => ms && ms.nota_id === s.nota_id)) {
                mergedSubtemas.push(s);
              }
            });
            parsedExisting.data.subtemas = mergedSubtemas;
            if (mModulo && !parsedExisting.data.modulo) parsedExisting.data.modulo = mModulo;
            if (isCourse && parsedExisting.data.leccion === undefined) {
              parsedExisting.data.leccion = lessonNum;
              parsedExisting.data.leccion_titulo = lessonTitle;
            }
            if (firstFuenteId && !parsedExisting.data.fuente) parsedExisting.data.fuente = firstFuenteId;
            saveMarkdownFile(existingPath, parsedExisting.data, parsedExisting.content || m.descripcion || '');
            stats.mapas++;
            importedMapIds.push(mId);
            return;
          }
        }

        const mData = {
          id: mId,
          titulo: m.titulo,
          tipo: 'mapa',
          tipo_mapa: m.tipo_mapa || (mId.startsWith('mapa-curso-') ? 'curso' : 'tematico'),
          creado: m.creado || today,
          carpeta: folder,
          campo: mCampo,
          proyecto: mProyecto,
          tags,
          subtemas
        };
        if (mModulo) mData.modulo = mModulo;
        if (isCourse) {
          mData.leccion = lessonNum;
          mData.leccion_titulo = lessonTitle;
        }
        if (m.fuente || firstFuenteId) {
          mData.fuente = m.fuente || firstFuenteId;
        }

        const mContent = m.descripcion || m.contenido || m.content || '';
        const mPath = path.join(targetDir, `${mId}.md`);
        saveMarkdownFile(mPath, mData, mContent);
        stats.mapas++;
        importedMapIds.push(mId);
      });
    }

    // -----------------------------------------------------------------
    // MOTOR DE INTEGRACIÓN INCREMENTAL DE PROYECTOS Y CURSOS
    // (Mapa Maestro Acumulativo & Conexiones Bidireccionales Entre Entregas/Lecciones)
    // -----------------------------------------------------------------
    if ((cSlug || pSlug) && importedAtomicIds.length > 0) {
      const targetCampo = resolvedCampo || (cSlug ? humanizeSlug(cSlug) : 'general');
      const targetProy = resolvedProyecto || humanizeSlug(pSlug);
      const targetCSlug = slugify(targetCampo);
      const targetPSlug = slugify(targetProy);
      const courseFolder = targetPSlug ? `${targetCSlug}/${targetPSlug}` : targetCSlug;

      // 1. Mapa Maestro Acumulativo para Cursos (o si ya existe un mapa maestro del proyecto)
      const courseMapId = existingProy?.mapa_curso_id || `mapa-curso-${targetPSlug}`;
      const existingMapPath = findNoteFilePath('mapa', courseMapId);
      if (isCourse || (existingMapPath && fs.existsSync(existingMapPath))) {
        const targetMapDir = path.join(DIRS.mapa, courseFolder);
        if (!fs.existsSync(targetMapDir)) fs.mkdirSync(targetMapDir, { recursive: true });

        const batchLabel = isCourse
          ? `${importModulo ? importModulo + ' · ' : ''}Lección ${lessonNum}: ${lessonTitle}`
          : (lessonTitle || (Array.isArray(notas_fuente) && notas_fuente[0]?.titulo) || today);

        if (existingMapPath && fs.existsSync(existingMapPath)) {
          const existingMap = parseMarkdownFile(existingMapPath);
          if (existingMap) {
            existingMap.data.tipo_mapa = 'curso';
            if (!Array.isArray(existingMap.data.subtemas)) existingMap.data.subtemas = [];
            importedAtomicIds.forEach(aId => {
              if (!existingMap.data.subtemas.some(s => s && s.nota_id === aId)) {
                const matchedA = (notas_atomicas || []).find(x => {
                  let xId = x.id ? slugify(x.id) : ('atomica-' + slugify(x.titulo));
                  if (!xId.startsWith('atomica-')) xId = 'atomica-' + xId;
                  return xId === aId;
                });
                const reasonContent = matchedA ? String(matchedA.por_que_importa || matchedA.porQueImporta || matchedA.why_it_matters || matchedA.idea || matchedA.titulo || 'Concepto clave').trim() : 'Concepto introducido en el temario';
                existingMap.data.subtemas.push({
                  nota_id: aId,
                  razon: `[${batchLabel}] ${reasonContent}`
                });
              }
            });
            if (isCourse && !existingMap.content.includes(`Lección ${lessonNum}`) && !existingMap.content.includes(`Topic ${lessonNum}`)) {
              existingMap.content += `\n- **${importModulo ? `[${importModulo}] ` : ''}Lección ${lessonNum}:** ${lessonTitle}`;
            }
            saveMarkdownFile(existingMapPath, existingMap.data, existingMap.content);
            stats.mapas++;
          }
        } else if (isCourse && targetPSlug) {
          const newSubtemas = importedAtomicIds.map(aId => {
            const matchedA = (notas_atomicas || []).find(x => {
              let xId = x.id ? slugify(x.id) : ('atomica-' + slugify(x.titulo));
              if (!xId.startsWith('atomica-')) xId = 'atomica-' + xId;
              return xId === aId;
            });
            const reasonContent = matchedA ? String(matchedA.por_que_importa || matchedA.porQueImporta || matchedA.why_it_matters || matchedA.idea || matchedA.titulo || 'Concepto clave').trim() : 'Concepto introducido en el temario';
            return {
              nota_id: aId,
              razon: `[${batchLabel}] ${reasonContent}`
            };
          });
          const mapData = {
            id: courseMapId,
            titulo: `Curso: ${targetProy}`,
            tipo: 'mapa',
            tipo_mapa: 'curso',
            creado: today,
            carpeta: courseFolder,
            campo: targetCampo,
            proyecto: targetProy,
            modulo: importModulo || undefined,
            leccion: lessonNum,
            leccion_titulo: lessonTitle,
            fuente: firstFuenteId || undefined,
            tags: ['curso', 'master-map', targetPSlug],
            subtemas: newSubtemas
          };
          const mapContent = `## Mapa de Contenidos del Curso\nEstructura conceptual acumulativa del curso "${targetProy}".\n\n### Lecciones integradas:\n- **${importModulo ? `[${importModulo}] ` : ''}Lección ${lessonNum}:** ${lessonTitle}\n`;
          const newMapPath = path.join(targetMapDir, `${courseMapId}.md`);
          saveMarkdownFile(newMapPath, mapData, mapContent);
          stats.mapas++;
        }
      }

      // 2. Conexiones conceptuales inter-entrega / inter-lección (para TODOS los tipos de proyecto)
      const allAtomicNotes = getAllNotesFromDir('atomica');
      const priorProjectNotes = allAtomicNotes.filter(n => {
        const nProy = (n.data?.proyecto || '').trim();
        const nFolder = (n.data?.carpeta || '').replace(/\\/g, '/');
        const belongsToProject = targetPSlug
          ? (slugify(nProy) === targetPSlug || nFolder === `${targetCSlug}/${targetPSlug}`)
          : (slugify(n.data?.campo || '') === targetCSlug || nFolder === targetCSlug);
        return belongsToProject && !importedAtomicIds.includes(n.id);
      });

      if (priorProjectNotes.length > 0) {
        const genericTags = new Set(['curso', 'sintesis', 'general', 'test', 'importci', 'estudio', 'notas', targetPSlug, targetCSlug]);
        const isGenericTag = (t) => !t || genericTags.has(t) || /^leccion-\d+$/.test(t);
        const stopWords = new Set(['sobre', 'entre', 'desde', 'hasta', 'como', 'para', 'este', 'esta', 'estos', 'estas', 'donde', 'cuando', 'porque', 'about', 'between', 'through', 'where', 'which', 'their', 'these', 'those', 'using']);
        const extractTitleWords = (str) => String(str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter(w => w.length >= 5 && !stopWords.has(w));

        let anyInterProjectLinkCreated = false;
        const batchContextDesc = isCourse ? `la Lección ${lessonNum}` : `la entrega "${lessonTitle || targetProy}"`;

        importedAtomicIds.forEach((aId, aIdx) => {
          const aFilePath = findNoteFilePath('atomica', aId);
          if (!aFilePath) return;
          const aParsed = parseMarkdownFile(aFilePath);
          if (!aParsed) return;
          if (!Array.isArray(aParsed.data.enlaces)) aParsed.data.enlaces = [];

          let noteModified = false;
          const aTitle = (aParsed.data?.titulo || '').toLowerCase();
          const aFullText = `${aTitle} ${aParsed.content} ${(aParsed.data.tags || []).join(' ')}`.toLowerCase();
          const aSpecificTags = (aParsed.data?.tags || []).filter(t => !isGenericTag(t));
          const aTitleWords = extractTitleWords(aTitle);

          priorProjectNotes.forEach(prior => {
            const priorId = prior.id;
            const priorTitle = (prior.data?.titulo || '').toLowerCase();
            const priorFullText = `${priorTitle} ${prior.content || ''}`.toLowerCase();
            const priorSpecificTags = (prior.data?.tags || []).filter(t => !isGenericTag(t));
            const priorTitleWords = extractTitleWords(priorTitle);

            const explicitMention = aParsed.data.enlaces.includes(priorId) ||
              aFullText.includes(priorId.toLowerCase()) ||
              (priorTitle.length > 5 && aFullText.includes(priorTitle)) ||
              (aTitle.length > 5 && priorFullText.includes(aTitle));

            const sharedTag = aSpecificTags.some(t => priorSpecificTags.includes(t));
            const sharedKeywords = aTitleWords.filter(w => priorTitleWords.includes(w)).length >= 2;

            if (explicitMention || sharedTag || sharedKeywords) {
              if (!aParsed.data.enlaces.includes(priorId)) {
                aParsed.data.enlaces.push(priorId);
                if (!aParsed.content.includes(`[[${priorId}]]`)) {
                  aParsed.content += `\n- Relacionado en el proyecto con [[${priorId}]] (${prior.data?.titulo || priorId}).`;
                }
                noteModified = true;
              }
              anyInterProjectLinkCreated = true;
              stats.enlaces_inter_leccion++;

              const priorFilePath = findNoteFilePath('atomica', priorId);
              if (priorFilePath) {
                const priorParsed = parseMarkdownFile(priorFilePath);
                if (priorParsed) {
                  if (!Array.isArray(priorParsed.data.enlaces)) priorParsed.data.enlaces = [];
                  if (!priorParsed.data.enlaces.includes(aId)) {
                    priorParsed.data.enlaces.push(aId);
                    if (!priorParsed.content.includes(`[[${aId}]]`)) {
                      priorParsed.content += `\n\n- Conexión con [[${aId}]]: Concepto vinculado de ${batchContextDesc}.`;
                    }
                    saveMarkdownFile(priorFilePath, priorParsed.data, priorParsed.content);
                  }
                }
              }
            }
          });

          // Continuidad pedagógica: si ninguna nota del lote enlazó con notas previas del proyecto, enlazar con el nodo previo
          if (aIdx === 0 && !anyInterProjectLinkCreated && aParsed.data.enlaces.filter(e => priorProjectNotes.some(p => p.id === e)).length === 0) {
            const prevPrimary = priorProjectNotes[priorProjectNotes.length - 1];
            aParsed.data.enlaces.push(prevPrimary.id);
            aParsed.content += `\n\n## Continuidad del Proyecto\n- Construye sobre [[${prevPrimary.id}]]: Base conceptual previa del proyecto.`;
            noteModified = true;
            anyInterProjectLinkCreated = true;
            stats.enlaces_inter_leccion++;

            const prevFilePath = findNoteFilePath('atomica', prevPrimary.id);
            if (prevFilePath) {
              const prevParsed = parseMarkdownFile(prevFilePath);
              if (prevParsed) {
                if (!Array.isArray(prevParsed.data.enlaces)) prevParsed.data.enlaces = [];
                if (!prevParsed.data.enlaces.includes(aId)) {
                  prevParsed.data.enlaces.push(aId);
                  prevParsed.content += `\n\n- [[${aId}]]: Extensión conceptual desarrollada en ${batchContextDesc}.`;
                  saveMarkdownFile(prevFilePath, prevParsed.data, prevParsed.content);
                }
              }
            }
          }

          if (noteModified) {
            saveMarkdownFile(aFilePath, aParsed.data, aParsed.content);
          }
        });
      }
    }

    // Persistir campos y proyectos en proyectos.json
    const allImportedItems = [...(notas_fuente || []), ...(notas_atomicas || []), ...(mapas_contenido || [])];
    const detectedMeta = readProjectsMetadata();
    if (!detectedMeta.campos) detectedMeta.campos = {};
    let metaChanged = false;

    if (cSlug && pSlug) {
      if (!detectedMeta.campos[cSlug]) {
        detectedMeta.campos[cSlug] = { nombre: resolvedCampo, proyectos: {} };
        metaChanged = true;
      }
      if (!detectedMeta.campos[cSlug].proyectos) detectedMeta.campos[cSlug].proyectos = {};
      if (!detectedMeta.campos[cSlug].proyectos[pSlug]) {
        detectedMeta.campos[cSlug].proyectos[pSlug] = {
          nombre: resolvedProyecto,
          descripcion: importDesc || '',
          tipo: effectiveTipo,
          estado: 'activo',
          lecciones: [],
          mapa_curso_id: isCourse ? `mapa-curso-${pSlug}` : null
        };
        metaChanged = true;
      } else {
        const pObj = detectedMeta.campos[cSlug].proyectos[pSlug];
        if (importDesc && !pObj.descripcion) { pObj.descripcion = importDesc; metaChanged = true; }
        if (importTipo && !pObj.tipo) { pObj.tipo = importTipo; metaChanged = true; }
      }

      if (isCourse) {
        const pObj = detectedMeta.campos[cSlug].proyectos[pSlug];
        pObj.tipo = 'curso';
        if (!Array.isArray(pObj.lecciones)) pObj.lecciones = [];
        const existingIdx = pObj.lecciones.findIndex(l => l.numero === lessonNum);
        const prevLesson = existingIdx >= 0 ? pObj.lecciones[existingIdx] : null;
        const mergedMaps = Array.from(new Set([...(Array.isArray(prevLesson?.mapas_contenido) ? prevLesson.mapas_contenido : []), ...importedMapIds]));
        const lessonRec = {
          numero: lessonNum,
          modulo: importModulo || (prevLesson?.modulo || ''),
          titulo: lessonTitle,
          fecha: today,
          nota_fuente: firstFuenteId || prevLesson?.nota_fuente || null,
          notas_atomicas: importedAtomicIds,
          mapas_contenido: mergedMaps,
          total_atomicas: importedAtomicIds.length
        };
        if (existingIdx >= 0) {
          pObj.lecciones[existingIdx] = lessonRec;
        } else {
          pObj.lecciones.push(lessonRec);
        }
        pObj.lecciones.sort((a, b) => a.numero - b.numero);
        pObj.mapa_curso_id = pObj.mapa_curso_id || `mapa-curso-${pSlug}`;
        if (reqBody.cursoCompletado || payload.cursoCompletado || payload.completed) {
          pObj.estado = 'completado';
        }
        metaChanged = true;
      }
    } else {
      allImportedItems.forEach(item => {
        const c = (resolvedCampo || item.campo || item.field || '').trim();
        const p = (resolvedProyecto || item.proyecto || item.project || '').trim();
        if (c) {
          const cS = slugify(c);
          if (!detectedMeta.campos[cS]) {
            detectedMeta.campos[cS] = { nombre: c, proyectos: {} };
            metaChanged = true;
          }
          if (p) {
            const pS = slugify(p);
            if (!detectedMeta.campos[cS].proyectos) detectedMeta.campos[cS].proyectos = {};
            if (!detectedMeta.campos[cS].proyectos[pS]) {
              const rawItemTipo = (item.proyecto_tipo || item.tipo_proyecto || item.project_type || importTipo || effectiveTipo || 'curso').toLowerCase();
              const pTipo = validProjectTypes.includes(rawItemTipo) ? rawItemTipo : 'curso';
              detectedMeta.campos[cS].proyectos[pS] = {
                nombre: p,
                descripcion: (item.proyecto_descripcion || item.descripcion_proyecto || importDesc || '').trim(),
                tipo: pTipo,
                estado: 'activo',
                lecciones: [],
                mapa_curso_id: pTipo === 'curso' ? `mapa-curso-${pS}` : null
              };
              metaChanged = true;
            }
          }
        }
      });
    }
    if (metaChanged) saveProjectsMetadata(detectedMeta);

    // 5. Importar Bandeja de Entrada (01-inbox) si viene
    if (Array.isArray(bandeja)) {
      bandeja.forEach((b, idx) => {
        const text = typeof b === 'string' ? b : (b.contenido || b.texto || '');
        if (!text) return;
        const bId = `bandeja-${today}-${Date.now()}-${idx}`;
        const bData = {
          id: bId,
          tipo: 'bandeja',
          creado: b.creado || today,
          procesada: false
        };
        const bPath = path.join(DIRS.bandeja, `${bId}.md`);
        saveMarkdownFile(bPath, bData, text);
        stats.bandeja++;
      });
    }

    // Regenerar cola de repaso con interleaving
    buildInterleavedQueue();

    return res.json({
      success: true,
      message: 'Paquete de notas importado exitosamente',
      stats
    });
  } catch (error) {
    console.error('Error importando JSON:', error);
    return res.status(500).json({ error: 'Error procesando la importación: ' + error.message });
  }
});

// Plantilla de Ejemplo y Schema JSON para el Modelo de Lenguaje
app.get('/api/import/template', (req, res) => {
  const exampleTemplate = {
    version: "1.0",
    campo: "Ciencias Cognitivas",
    proyecto: "Estrategias de Aprendizaje Efectivo",
    proyecto_tipo: "curso",
    proyecto_descripcion: "Curso basado en evidencia empírica sobre técnicas de estudio de alto impacto, memoria a largo plazo y práctica de recuperación.",
    leccion_numero: 1,
    leccion_titulo: "Efecto de Generación y Práctica Activa",
    carpetas: {
      atomica: ["aprendizaje-cognitivo"],
      fuente: ["articulos-cientificos"]
    },
    notas_fuente: [
      {
        id: "fuente-dunlosky-2013",
        titulo: "Improving Students' Learning With Effective Learning Techniques",
        autor: "Dunlosky et al.",
        tipo_fuente: "articulo",
        carpeta: "articulos-cientificos",
        tags: ["metacognicion", "tecnicas-estudio"],
        puntos_clave: "Revisión exhaustiva de 10 técnicas de estudio. La autoevaluación (practice testing) y la práctica espaciada (distributed practice) obtuvieron la máxima calificación de utilidad.",
        citas_textuales: [
          "Practice testing and distributed practice received high utility assessments based on strong empirical evidence across multiple educational domains."
        ],
        ideas_disparadas: ["atomica-efecto-generacion", "atomica-repeticion-espaciada"]
      }
    ],
    notas_atomicas: [
      {
        id: "atomica-efecto-generacion",
        titulo: "El efecto de generación en la memoria",
        fuente: "fuente-dunlosky-2013",
        carpeta: "aprendizaje-cognitivo",
        tags: ["memoria", "generacion", "cognicion"],
        idea: "Recordamos mejor la información que nuestro propio cerebro produce o reformula activamente que la información que leemos o escuchamos de forma pasiva.",
        por_que_importa: "Explica por qué subrayar o releer tiene baja retención a largo plazo: no fuerza la síntesis generativa en el hipocampo.",
        como_se_conecta: "Es el mecanismo cognitivo fundamental detrás de la [[atomica-repeticion-espaciada]] y la autoevaluación continua.",
        enlaces: ["atomica-repeticion-espaciada"],
        autoevaluacion: {
          pregunta: "¿Por qué el efecto de generación produce recuerdos más duraderos que la simple relectura?",
          respuesta: "Porque exige construir rutas sinápticas propias de recuperación y formular el concepto con vocabulario propio, forzando la codificación profunda."
        }
      }
    ],
    mapas_contenido: [
      {
        id: "mapa-estrategias-efectivas",
        titulo: "Estrategias de Aprendizaje con Máxima Evidencia",
        carpeta: "",
        tags: ["estrategia", "sintesis"],
        descripcion: "Mapa conceptual de síntesis estructurado sobre estrategias de aprendizaje efectivas.",
        subtemas: [
          {
            nota_id: "atomica-efecto-generacion",
            razon: "Explica el principio biológico y cognitivo de por qué la práctica activa supera a la pasiva."
          }
        ]
      }
    ]
  };

  res.json({
    template: exampleTemplate,
    description: "Esquema JSON compatible con NotesApp para importar notas fuente, atómicas, autoevaluaciones y mapas."
  });
});

// -------------------------------------------------------------
// Iniciar Servidor
// -------------------------------------------------------------
app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(err.status || 500).json({error: err.status === 400 ? 'Invalid JSON request' : 'Request failed. Please check the input and try again.'});
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`=======================================================`);
  console.log(`🧠 NotesApp iniciado en: http://localhost:${PORT}`);
  console.log(`📁 Directorio de notas: ${ROOT_DIR}`);
  console.log(`=======================================================`);
});
