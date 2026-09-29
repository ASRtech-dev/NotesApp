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
 const origin=req.get('origin');
 if(!['localhost','127.0.0.1','[::1]'].includes(req.hostname)) return res.status(403).json({error:'Local access only'});
 if(origin && origin !== 'http://' + req.get('host')) return res.status(403).json({error:'Cross-origin requests are not allowed'});
 next();
});
app.use(express.json({ limit: '10mb' }));
// Reject unsafe path components before any filesystem operation.
app.use('/api', (req, res, next) => {
  const unsafe = value => typeof value === 'string' && (value.includes('\\') || value.includes(':') || value.includes('\0') || value.startsWith('/') || value.split('/').includes('..'));
  const inspect = value => value && typeof value === 'object' && Object.entries(value).some(([key, child]) =>
    (['id', 'inboxId', 'preguntaId', 'nota_id', 'carpeta', 'parentFolder'].includes(key) && unsafe(child)) || inspect(child));
  let pathname;
  try { pathname = decodeURIComponent(req.path); } catch { return res.status(400).json({ error: 'Invalid path' }); }
  if (inspect(req.body) || pathname.includes('\\') || pathname.includes('..') || pathname.includes(':')) return res.status(400).json({ error: 'Invalid path' });
  next();
});
app.use('/api', (req,res,next) => {
 const validText = (obj,key) => obj[key] === undefined || obj[key] === null || typeof obj[key] === 'string';
 const inspect = obj => {
  if(!obj || typeof obj!=='object') return true;
  for(const [key,value] of Object.entries(obj)) {
   if(['titulo','autor','idea','contenido','content','carpeta','parentFolder','folderName','nombre','fuente','tipo_fuente','puntos_clave','puntosClave','descripcion','razon'].includes(key) && !validText(obj,key)) return false;
   if(['id','inboxId','preguntaId','nota_id'].includes(key) && (typeof value!=='string'||!/^[a-zA-Z0-9_-]+$/.test(value))) return false;
   if(['subtemas','tags','enlaces','ideas_disparadas'].includes(key) && !Array.isArray(value)) return false;
   if(['tags','enlaces','ideas_disparadas'].includes(key) && value.some(v=>typeof v!=='string')) return false;
   if(!inspect(value))return false;
  } return true;
 };
 if(!inspect(req.body)) return res.status(400).json({error:'Invalid field type or identifier'});
 if(req.body?.tipo && !['bandeja','fuente','atomica','mapa'].includes(req.body.tipo))return res.status(400).json({error:'Invalid note type'});
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
  const output = matter.stringify(content.trim() + '\n', data);
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
// Lectura de todas las notas por tipo (Soporte recursivo de carpetas)
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
      list.push({
        id: parsed.data.id || parsed.fileName,
        tipo,
        fileName: parsed.fileName,
        carpeta: parsed.data.carpeta,
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
        if (trimmed.startsWith('- P:')) {
          pText = trimmed.replace(/^- P:\s*/, '').trim();
        } else if (trimmed.startsWith('- R:')) {
          rText = trimmed.replace(/^- R:\s*/, '').trim();
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

function buildInterleavedQueue(practiceAll = false) {
  const today = getTodayString();
  const questions = getAllQuestions();
  const maps = getAllNotesFromDir('mapa');

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
    const tema = noteTopicMap[q.nota_id] || 'general';
    q.tema = tema;
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

// Listar todas las notas y estado general
app.get('/api/notes', (req, res) => {
  const bandeja = getAllNotesFromDir('bandeja');
  const fuente = getAllNotesFromDir('fuente');
  const atomica = getAllNotesFromDir('atomica');
  const mapa = getAllNotesFromDir('mapa');
  const preguntas = getAllQuestions();
  const backlinks = computeBacklinks();

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

  let extra = {};
  if (tipo === 'atomica') {
    const backlinks = computeBacklinks();
    const questions = getAllQuestions();
    extra.backlinks = backlinks[id] || [];
    extra.pregunta = questions.find(q => q.nota_id === id) || null;
  } else if (tipo === 'mapa') {
    const allAtomicas = getAllNotesFromDir('atomica');
    const atomicMap = {};
    allAtomicas.forEach(a => { atomicMap[a.id] = a; });
    extra.subtemasDetalle = (parsed.data.subtemas || []).map(s => {
      const a = atomicMap[s.nota_id];
      let idea = '';
      if (a) {
        const m = a.content.match(/## Idea \(con mis palabras\)([\s\S]*?)(##|$)/);
        idea = m ? m[1].trim() : a.content.substring(0, 140);
      }
      return {
        nota_id: s.nota_id,
        razon: s.razon || '',
        titulo: a ? (a.data.titulo || s.nota_id) : s.nota_id,
        idea,
        carpeta: a ? (a.data.carpeta || '') : ''
      };
    });
  }

  res.json({
    id: parsed.data.id || id,
    tipo,
    carpeta: parsed.data.carpeta || '',
    tags,
    data: parsed.data,
    content: parsed.content,
    raw: parsed.raw,
    filePath,
    ...extra
  });
});

// Crear nueva nota (soporta subcarpetas y tags)
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
          error: 'Regla de negocio: Enlazar notas atómicas a un mapa exige rellenar el campo "razon" para justificar la relación (Kiewra et al. 1991).'
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

  // Subcarpeta
  const folder = data.carpeta ? String(data.carpeta).trim() : '';
  data.carpeta = folder;
  const targetDir = folder ? path.join(dir, folder) : dir;
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const filePath = path.join(targetDir, `${id}.md`);
  if (findNoteFilePath(tipo, id)) {
    return res.status(409).json({ error: `Ya existe una nota con el id '${id}'` });
  }

  saveMarkdownFile(filePath, data, content || '');
  res.status(201).json({ success: true, id, tipo, data, carpeta: folder, tags: data.tags });
});

// Actualizar nota (permite mover a otra subcarpeta)
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
          error: 'Regla de negocio: Enlazar notas atómicas a un mapa exige rellenar el campo "razon" para justificar la relación (Kiewra et al. 1991).'
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

  // Comprobar si cambió la carpeta destino
  const targetFolder = data.carpeta != null ? String(data.carpeta).trim() : '';
  data.carpeta = targetFolder;
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
  res.json({ success: true, id, data, carpeta: targetFolder, tags: data.tags });
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
    tags: Array.from(allTags).sort()
  });
});

app.post('/api/folders', (req, res) => {
  const { tipo, folderName, nombre, parentFolder } = req.body;
  const nameToUse = (nombre || folderName || '').trim();
  const baseDir = DIRS[tipo];
  if (!baseDir) return res.status(400).json({ error: 'Tipo inválido' });
  if (!nameToUse) return res.status(400).json({ error: 'Nombre de carpeta requerido' });

  const cleanName = slugify(nameToUse);
  const targetDir = parentFolder ? path.join(baseDir, parentFolder, cleanName) : path.join(baseDir, cleanName);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  res.status(201).json({ success: true, folder: parentFolder ? `${parentFolder}/${cleanName}` : cleanName });
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

  // 1. Crear nota fuente si fue enviada
  if (fuenteData && fuenteData.titulo) {
    const fId = fuenteData.id ? slugify(fuenteData.id) : ('fuente-' + slugify(fuenteData.titulo));
    createdFuenteId = fId;
    const fData = {
      id: fId,
      titulo: fuenteData.titulo,
      autor: fuenteData.autor || 'Autor desconocido',
      tipo: 'fuente',
      tipo_fuente: fuenteData.tipo_fuente || 'articulo',
      creado: today,
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

    const fPath = path.join(DIRS.fuente, `${fId}.md`);
    saveMarkdownFile(fPath, fData, fContent);
  }

  // 2. Crear notas atómicas si fueron enviadas
  if (Array.isArray(atomicasData)) {
    atomicasData.forEach(a => {
      if (!a.titulo) return;
      const aId = a.id ? slugify(a.id) : ('atomica-' + slugify(a.titulo));
      createdAtomicIds.push(aId);

      const aData = {
        id: aId,
        titulo: a.titulo,
        tipo: 'atomica',
        fuente: createdFuenteId || a.fuente || null,
        enlaces: Array.isArray(a.enlaces) ? a.enlaces : [],
        creado: today,
        ultimo_repaso: null
      };

      const aContent = `## Idea (con mis palabras)\n${a.idea || ''}\n\n## ¿Por qué importa?\n${a.porQueImporta || ''}\n\n## ¿Cómo se conecta con lo que ya sé?\n${a.comoSeConecta || ''}\n`;
      const aPath = path.join(DIRS.atomica, `${aId}.md`);
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
  const result = buildInterleavedQueue(req.query.all === 'true');
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
  const mapaPath = findNoteFilePath('mapa', mapaId);
  if (!mapaPath || !fs.existsSync(mapaPath)) {
    return res.status(404).send('Mapa no encontrado');
  }

  const mapa = parseMarkdownFile(mapaPath);
  const subtemas = Array.isArray(mapa.data.subtemas) ? mapa.data.subtemas : [];
  const atomicNotes = getAllNotesFromDir('atomica');
  const atomicMap = {};
  atomicNotes.forEach(a => { atomicMap[a.id] = a; });
  const questions = getAllQuestions();
  const questionMap = {};
  questions.forEach(q => { questionMap[q.nota_id] = q; });

  let doc = `# Guía de Estudio: ${mapa.data.titulo || mapaId}\n\n`;
  doc += `> Compilado automáticamente desde NotesApp. Generado el ${getTodayString()}.\n\n`;
  doc += `## Estructura y Relaciones del Mapa\n\n`;

  subtemas.forEach((s, idx) => {
    const a = atomicMap[s.nota_id];
    const title = a ? (a.data.titulo || s.nota_id) : s.nota_id;
    doc += `${idx + 1}. **${title}**\n   - *Razón de conexión:* ${s.razon}\n\n`;
  });

  doc += `---\n\n## Desarrollo Detallado de Conceptos\n\n`;

  subtemas.forEach((s, idx) => {
    const a = atomicMap[s.nota_id];
    if (a) {
      doc += `### ${idx + 1}. ${a.data.titulo || s.nota_id}\n\n`;
      doc += `*Razón en este mapa:* ${s.razon}\n\n`;
      doc += `${a.content}\n\n`;
    }
  });

  doc += `---\n\n## Preguntas de Autoevaluación (Recuperación Activa)\n\n`;
  subtemas.forEach((s, idx) => {
    const q = questionMap[s.nota_id];
    if (q) {
      doc += `### Pregunta ${idx + 1}\n`;
      doc += `**P:** ${q.pregunta}\n\n`;
      doc += `<details><summary>Mostrar Respuesta</summary>\n\n**R:** ${q.respuesta}\n\n</details>\n\n`;
    }
  });

  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="guia-${mapaId}.md"`);
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

    const {
      carpetas,
      notas_fuente,
      notas_atomicas,
      mapas_contenido,
      bandeja
    } = payload;

    const hasAnyContent = (Array.isArray(notas_fuente) && notas_fuente.length > 0) ||
      (Array.isArray(notas_atomicas) && notas_atomicas.length > 0) ||
      (Array.isArray(mapas_contenido) && mapas_contenido.length > 0) ||
      (Array.isArray(bandeja) && bandeja.length > 0) ||
      (carpetas && typeof carpetas === 'object' && Object.keys(carpetas).length > 0);

    if (!hasAnyContent) {
      return res.status(400).json({ error: 'El archivo JSON no contiene elementos válidos para importar (notas_fuente, notas_atomicas, mapas_contenido, bandeja o carpetas).' });
    }

    const planned=new Set();
    for(const [key,type,prefix] of [['notas_fuente','fuente','fuente-'],['notas_atomicas','atomica','atomica-'],['mapas_contenido','mapa','mapa-']]) {
      if(payload[key] !== undefined && !Array.isArray(payload[key])) return res.status(400).json({error:'Import collections must be arrays'});
      for(const note of payload[key]||[]) {
        if(!note || typeof note.titulo!=='string' || !note.titulo.trim()) return res.status(400).json({error:'Every imported note needs a title'});
        for(const field of ['content','contenido','descripcion','idea','puntos_clave','puntosClave']) if(note[field]!==undefined && typeof note[field]!=='string')return res.status(400).json({error:'Import text fields must be strings'});
        let id=note.id?slugify(note.id):prefix+slugify(note.titulo);if(!id.startsWith(prefix))id=prefix+id;
        if(planned.has(type+id)||findNoteFilePath(type,id)) return res.status(409).json({error:'Import would overwrite an existing or duplicate note: '+id});
        planned.add(type+id);
        if(type==='mapa' && (note.subtemas!==undefined && !Array.isArray(note.subtemas) || (note.subtemas||[]).some(sub=>!sub||typeof sub.nota_id!=='string'||typeof sub.razon!=='string'||!sub.razon.trim())))return res.status(400).json({error:'Every map connection needs an explicit reason'});
      }
    }
    if(bandeja!==undefined && (!Array.isArray(bandeja)||bandeja.some(b=>typeof b!=='string'&&(!b||typeof(b.contenido||b.texto)!=='string'))))return res.status(400).json({error:'Invalid inbox import'});
    const stats = {
      carpetas: 0,
      fuentes: 0,
      atomicas: 0,
      preguntas: 0,
      mapas: 0,
      bandeja: 0
    };

    const today = getTodayString();

    // 1. Crear carpetas explícitas si vienen en el payload
    if (carpetas && typeof carpetas === 'object') {
      Object.keys(carpetas).forEach(tipo => {
        if (DIRS[tipo] && Array.isArray(carpetas[tipo])) {
          carpetas[tipo].forEach(folderName => {
            const cleanFolder = slugify(folderName);
            if (cleanFolder) {
              const fullFolderPath = path.join(DIRS[tipo], cleanFolder);
              if (!fs.existsSync(fullFolderPath)) {
                fs.mkdirSync(fullFolderPath, { recursive: true });
                stats.carpetas++;
              }
            }
          });
        }
      });
    }

    // 2. Importar Notas Fuente (02-source-notes)
    if (Array.isArray(notas_fuente)) {
      notas_fuente.forEach(f => {
        if (!f || !f.titulo) return;
        let fId = f.id ? slugify(f.id) : ('fuente-' + slugify(f.titulo));
        if (!fId.startsWith('fuente-')) fId = 'fuente-' + fId;

        const folder = f.carpeta ? slugify(f.carpeta) : '';
        const targetDir = folder ? path.join(DIRS.fuente, folder) : DIRS.fuente;
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
          stats.carpetas++;
        }

        const ideasDisparadas = Array.isArray(f.ideas_disparadas)
          ? f.ideas_disparadas.map(id => slugify(id).startsWith('atomica-') ? slugify(id) : 'atomica-' + slugify(id))
          : [];

        const tags = Array.isArray(f.tags) ? f.tags.map(t => slugify(t)) : [];

        const fData = {
          id: fId,
          titulo: f.titulo,
          autor: f.autor || 'Autor desconocido',
          tipo: 'fuente',
          tipo_fuente: f.tipo_fuente || 'articulo',
          creado: f.creado || today,
          carpeta: folder,
          tags,
          ideas_disparadas: ideasDisparadas
        };

        let fContent = `## Puntos clave (parafraseados, no copiados)\n${f.puntos_clave || f.puntosClave || ''}\n\n`;
        if (Array.isArray(f.citas_textuales) && f.citas_textuales.length > 0) {
          fContent += `## Citas textuales relevantes\n${f.citas_textuales.map(c => `> ${c}`).join('\n\n')}\n\n`;
        }
        fContent += `## Ideas propias que dispara\n`;
        ideasDisparadas.forEach(iId => {
          fContent += `- [[${iId}]]\n`;
        });

        const fPath = path.join(targetDir, `${fId}.md`);
        saveMarkdownFile(fPath, fData, fContent);
        stats.fuentes++;
      });
    }

    // 3. Importar Notas Atómicas (03-atomic-notes) y Autoevaluación (05-self-assessment)
    if (Array.isArray(notas_atomicas)) {
      notas_atomicas.forEach(a => {
        if (!a || !a.titulo) return;
        let aId = a.id ? slugify(a.id) : ('atomica-' + slugify(a.titulo));
        if (!aId.startsWith('atomica-')) aId = 'atomica-' + aId;

        const folder = a.carpeta ? slugify(a.carpeta) : '';
        const targetDir = folder ? path.join(DIRS.atomica, folder) : DIRS.atomica;
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
          stats.carpetas++;
        }

        // Sanitizar fuente
        let fuenteId = null;
        if (a.fuente) {
          fuenteId = slugify(a.fuente);
          if (!fuenteId.startsWith('fuente-')) fuenteId = 'fuente-' + fuenteId;
        }

        // Enlaces wikilink
        const explicitLinks = Array.isArray(a.enlaces) ? a.enlaces.map(l => slugify(l)) : [];
        const tags = Array.isArray(a.tags) ? a.tags.map(t => slugify(t)) : [];

        const aData = {
          id: aId,
          titulo: a.titulo,
          tipo: 'atomica',
          fuente: fuenteId,
          carpeta: folder,
          tags,
          enlaces: explicitLinks,
          creado: a.creado || today,
          ultimo_repaso: a.ultimo_repaso || null
        };

        const aContent = `## Idea (con mis palabras)\n${a.idea || ''}\n\n## ¿Por qué importa?\n${a.por_que_importa || a.porQueImporta || ''}\n\n## ¿Cómo se conecta con lo que ya sé?\n${a.como_se_conecta || a.comoSeConecta || ''}\n`;
        const aPath = path.join(targetDir, `${aId}.md`);
        saveMarkdownFile(aPath, aData, aContent);
        stats.atomicas++;

        // Crear flashcard de autoevaluación asociada (recuperación activa)
        const qObj = a.autoevaluacion || a.pregunta_autoevaluacion || (a.pregunta && a.respuesta ? { pregunta: a.pregunta, respuesta: a.respuesta } : null);
        if (qObj && qObj.pregunta && qObj.respuesta) {
          const qId = `pregunta-${aId.replace(/^atomica-/, '')}`;
          const qData = {
            nota_id: aId,
            ease_factor: Number(qObj.ease_factor) || 2.5,
            intervalo_dias: Number(qObj.intervalo_dias) || 1,
            proxima_revision: qObj.proxima_revision || today,
            historial: Array.isArray(qObj.historial) ? qObj.historial : [],
            repeticiones: Number(qObj.repeticiones) || 0
          };
          const qContent = `- P: ${String(qObj.pregunta).trim()}\n- R: ${String(qObj.respuesta).trim()}\n`;
          const qPath = path.join(DIRS.pregunta, `${qId}.md`);
          saveMarkdownFile(qPath, qData, qContent);
          stats.preguntas++;
        }
      });
    }

    // 4. Importar Mapas de Contenido (04-content-maps)
    if (Array.isArray(mapas_contenido)) {
      mapas_contenido.forEach(m => {
        if (!m || !m.titulo) return;
        let mId = m.id ? slugify(m.id) : ('mapa-' + slugify(m.titulo));
        if (!mId.startsWith('mapa-')) mId = 'mapa-' + mId;

        const folder = m.carpeta ? slugify(m.carpeta) : '';
        const targetDir = folder ? path.join(DIRS.mapa, folder) : DIRS.mapa;
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
          stats.carpetas++;
        }

        // Subtemas con razón obligatoria según Kiewra et al. (1991)
        const subtemas = [];
        if (Array.isArray(m.subtemas)) {
          m.subtemas.forEach(s => {
            if (!s || !s.nota_id) return;
            let subId = slugify(s.nota_id);
            if (!subId.startsWith('atomica-')) subId = 'atomica-' + subId;
            const razon = (s.razon && String(s.razon).trim()) ? String(s.razon).trim() : 'Subtema estructurado dentro de la jerarquía conceptual';
            subtemas.push({
              nota_id: subId,
              razon
            });
          });
        }

        const tags = Array.isArray(m.tags) ? m.tags.map(t => slugify(t)) : [];

        const mData = {
          id: mId,
          titulo: m.titulo,
          tipo: 'mapa',
          creado: m.creado || today,
          carpeta: folder,
          tags,
          subtemas
        };

        const mContent = m.descripcion || m.contenido || m.content || '';
        const mPath = path.join(targetDir, `${mId}.md`);
        saveMarkdownFile(mPath, mData, mContent);
        stats.mapas++;
      });
    }

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
        descripcion: "Mapa conceptual de síntesis estructurado según el meta-análisis de Dunlosky et al. (1991/2013).",
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
