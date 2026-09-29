const http = require('http');

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- INICIANDO PRUEBAS AUTOMATIZADAS DE NOTESAPP ---');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FALLO: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Cargar todas las notas
    const notesRes = await makeRequest({
      hostname: 'localhost',
      port: 3456,
      path: '/api/notes',
      method: 'GET'
    });
    assert(notesRes.status === 200, 'GET /api/notes responde 200 OK');
    assert(Array.isArray(notesRes.body.atomica) && notesRes.body.atomica.length >= 2, 'Carga notas atómicas semilla');
    assert(Array.isArray(notesRes.body.fuente) && notesRes.body.fuente.length >= 1, 'Carga notas fuente semilla');
    assert(Array.isArray(notesRes.body.mapa) && notesRes.body.mapa.length >= 1, 'Carga mapas de contenido semilla');

    // 2. Verificar nota atómica específica con backlinks y pregunta
    const atomicaRes = await makeRequest({
      hostname: 'localhost',
      port: 3456,
      path: '/api/notes/atomica/atomica-efecto-generacion',
      method: 'GET'
    });
    assert(atomicaRes.status === 200, 'GET /api/notes/atomica/:id responde 200');
    assert(atomicaRes.body.pregunta !== null, 'Nota atómica tiene pregunta de autoevaluación asociada');
    assert(Array.isArray(atomicaRes.body.backlinks) && atomicaRes.body.backlinks.length > 0, 'Backlinks calculados correctamente');

    // 3. Regla obligatoria en mapas: Enlazar sin "razon" debe fallar (HTTP 400)
    const badMapRes = await makeRequest({
      hostname: 'localhost',
      port: 3456,
      path: '/api/notes',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      tipo: 'mapa',
      data: {
        titulo: 'Mapa sin justificacion',
        subtemas: [{ nota_id: 'atomica-efecto-generacion', razon: '' }] // Vacio!
      }
    });
    assert(badMapRes.status === 400, 'Regla estricta: Creación de mapa sin "razon" rechazada con 400');

    // 4. Captura rápida en bandeja de entrada
    const captureRes = await makeRequest({
      hostname: 'localhost',
      port: 3456,
      path: '/api/inbox/quick-capture',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      contenido: 'Captura de prueba para verificar flujo'
    });
    assert(captureRes.status === 201, 'Captura rápida en bandeja creada con 201 Created');
    const createdInboxId = captureRes.body.note.id;

    // 5. Flujo Procesar
    const processRes = await makeRequest({
      hostname: 'localhost',
      port: 3456,
      path: '/api/inbox/process',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      inboxId: createdInboxId,
      fuenteData: {
        titulo: 'Fuente de Prueba Automatizada',
        autor: 'Investigador Test',
        tipo_fuente: 'articulo',
        puntosClave: 'Punto 1 probado'
      },
      atomicasData: [{
        titulo: 'Idea Atómica de Prueba Automatizada',
        idea: 'Esta es la idea formulada en palabras propias para prueba',
        porQueImporta: 'Importa para test',
        comoSeConecta: 'Conecta con test',
        pregunta: '¿Pregunta de test?',
        respuesta: 'Respuesta de test'
      }]
    });
    assert(processRes.status === 200 && processRes.body.success, 'Flujo Procesar ejecutado exitosamente');

    // Limpieza de notas temporales creadas en prueba
    if (processRes.body.createdFuenteId) {
      await makeRequest({ hostname: 'localhost', port: 3456, path: `/api/notes/fuente/${processRes.body.createdFuenteId}`, method: 'DELETE' });
    }
    if (processRes.body.createdAtomicIds && processRes.body.createdAtomicIds[0]) {
      await makeRequest({ hostname: 'localhost', port: 3456, path: `/api/notes/atomica/${processRes.body.createdAtomicIds[0]}`, method: 'DELETE' });
    }
    await makeRequest({ hostname: 'localhost', port: 3456, path: `/api/notes/bandeja/${createdInboxId}`, method: 'DELETE' });

    // 6. Cola de repaso con interleaving
    const queueRes = await makeRequest({
      hostname: 'localhost',
      port: 3456,
      path: '/api/reviews/queue',
      method: 'GET'
    });
    assert(queueRes.status === 200, 'GET /api/reviews/queue responde 200');
    assert(Array.isArray(queueRes.body.queue), 'Cola de repaso generada con interleaving');

    // 7. Calificación SM-2
    const gradeRes = await makeRequest({
      hostname: 'localhost',
      port: 3456,
      path: '/api/reviews/grade',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      preguntaId: 'pregunta-efecto-generacion',
      q: 5
    });
    assert(gradeRes.status === 200, 'POST /api/reviews/grade califica exitosamente');
    assert(gradeRes.body.sm2.ease_factor >= 2.5, 'Cálculo SM-2: ease_factor actualizado correctamente');

    // 8. Grafo de Conocimiento
    const graphRes = await makeRequest({
      hostname: 'localhost',
      port: 3456,
      path: '/api/graph',
      method: 'GET'
    });
    assert(graphRes.status === 200, 'GET /api/graph responde 200');
    assert(graphRes.body.nodes.length > 0 && graphRes.body.links.length > 0, 'Grafo contiene nodos y aristas con relaciones');

    // 9. Estadísticas
    const statsRes = await makeRequest({
      hostname: 'localhost',
      port: 3456,
      path: '/api/stats',
      method: 'GET'
    });
    assert(statsRes.status === 200, 'GET /api/stats responde 200');
    assert(statsRes.body.atomicasTotal >= 2, 'Estadísticas reflejan conteo de atómicas');

    // 10. Analítica de Aprendizaje v2
    const analyticsRes = await makeRequest({
      hostname: 'localhost',
      port: 3456,
      path: '/api/analytics',
      method: 'GET'
    });
    assert(analyticsRes.status === 200, 'GET /api/analytics responde 200');
    assert(analyticsRes.body.retentionRate >= 0 && analyticsRes.body.retentionRate <= 100, 'Calcula tasa de retención válida');
    assert(analyticsRes.body.maturity && analyticsRes.body.forecast, 'Calcula madurez y pronóstico de tarjetas');

    // 11. Exportación a Anki (TSV)
    const ankiRes = await makeRequest({
      hostname: 'localhost',
      port: 3456,
      path: '/api/export/anki',
      method: 'GET'
    });
    assert(ankiRes.status === 200, 'GET /api/export/anki responde 200');
    assert(typeof ankiRes.body === 'string' && ankiRes.body.includes('#separator:tab'), 'Exportación a Anki en formato TSV correcto');

    // 12. Compilación de Guía de Estudio en Markdown
    const guideRes = await makeRequest({
      hostname: 'localhost',
      port: 3456,
      path: '/api/export/study-guide/mapa-tecnicas-estudio',
      method: 'GET'
    });
    assert(guideRes.status === 200, 'GET /api/export/study-guide/:mapaId responde 200');
    assert(typeof guideRes.body === 'string' && guideRes.body.includes('# Guía de Estudio:'), 'Compila guía de estudio en Markdown estructurada');

    // 13. [V3] Carpetas: Listar carpetas (GET /api/folders)
    const foldersRes = await makeRequest({
      hostname: 'localhost',
      port: 3456,
      path: '/api/folders',
      method: 'GET'
    });
    assert(foldersRes.status === 200, 'GET /api/folders responde 200');
    assert(foldersRes.body && foldersRes.body.folders && Array.isArray(foldersRes.body.folders.atomica), 'Estructura de carpetas válida');

    // 14. [V3] Carpetas: Crear una nueva carpeta (POST /api/folders)
    const createFolderRes = await makeRequest({
      hostname: 'localhost',
      port: 3456,
      path: '/api/folders',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      tipo: 'atomica',
      nombre: 'test-carpeta-ci'
    });
    assert(createFolderRes.status === 201, 'POST /api/folders crea carpeta con 201');

    // 15. [V3] Crear nota dentro de subcarpeta con hashtags y comprobar persistencia
    const createInSubfolderRes = await makeRequest({
      hostname: 'localhost',
      port: 3456,
      path: '/api/notes',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      tipo: 'atomica',
      data: {
        titulo: 'Nota en Subcarpeta de Prueba',
        tipo: 'atomica',
        carpeta: 'test-carpeta-ci',
        tags: ['automatizacion', 'testci']
      },
      content: '## Idea (con mis palabras)\nNota creada dentro de subcarpeta con #inline_hashtag de prueba.\n'
    });
    assert(createInSubfolderRes.status === 201, 'POST /api/notes crea nota dentro de subcarpeta con 201');
    const subfolderNoteId = createInSubfolderRes.body.id;

    // Verificar que GET la encuentra y extrae hashtags y carpeta
    const getSubfolderNoteRes = await makeRequest({
      hostname: 'localhost',
      port: 3456,
      path: `/api/notes/atomica/${subfolderNoteId}`,
      method: 'GET'
    });
    assert(getSubfolderNoteRes.status === 200, 'GET /api/notes/atomica/:id encuentra nota ubicada en subcarpeta');
    assert(getSubfolderNoteRes.body.data.carpeta === 'test-carpeta-ci', 'Nota conserva asignación de subcarpeta');
    assert(Array.isArray(getSubfolderNoteRes.body.data.tags) && getSubfolderNoteRes.body.data.tags.includes('testci') && getSubfolderNoteRes.body.data.tags.includes('inline_hashtag'), 'Hashtags frontmatter e inline extraídos correctamente');

    // 16. [V3] Grafo enriquecido con degree, tags y carpeta
    const graphV3Res = await makeRequest({
      hostname: 'localhost',
      port: 3456,
      path: '/api/graph',
      method: 'GET'
    });
    assert(graphV3Res.status === 200, 'GET /api/graph responde 200');
    const sampleNode = graphV3Res.body.nodes.find(n => n.id === subfolderNoteId);
    assert(sampleNode && typeof sampleNode.degree === 'number', 'Nodos del grafo incluyen métrica degree (grado de conexión)');
    assert(sampleNode && sampleNode.carpeta === 'test-carpeta-ci', 'Nodos del grafo incluyen metadata de carpeta');

    // Limpieza de nota y carpeta de test
    await makeRequest({
      hostname: 'localhost',
      port: 3456,
      path: `/api/notes/atomica/${subfolderNoteId}`,
      method: 'DELETE'
    });

    // 17. [V3] Importación JSON: Obtener plantilla y schema (GET /api/import/template)
    const templateRes = await makeRequest({
      hostname: 'localhost',
      port: 3456,
      path: '/api/import/template',
      method: 'GET'
    });
    assert(templateRes.status === 200, 'GET /api/import/template responde 200 con schema');
    assert(templateRes.body && templateRes.body.template && Array.isArray(templateRes.body.template.notas_atomicas), 'Plantilla contiene schema de notas atómicas');

    // 18. [V3] Importación JSON: Importar paquete categorizado (POST /api/import/json)
    const importPayload = {
      carpetas: { atomica: ['ci-import-folder'] },
      notas_fuente: [{
        id: 'fuente-ci-import',
        titulo: 'Fuente de Prueba CI Import',
        autor: 'Investigador CI',
        tipo_fuente: 'articulo',
        puntos_clave: 'Puntos clave parafraseados',
        ideas_disparadas: ['atomica-ci-import']
      }],
      notas_atomicas: [{
        id: 'atomica-ci-import',
        titulo: 'Idea Atómica CI Importada',
        fuente: 'fuente-ci-import',
        carpeta: 'ci-import-folder',
        tags: ['importci', 'test'],
        idea: 'Idea importada desde JSON estructurado.',
        por_que_importa: 'Valida la ingesta por copy-paste de LLM.',
        como_se_conecta: 'Se enlaza con [[atomica-efecto-generacion]].',
        enlaces: ['atomica-efecto-generacion'],
        autoevaluacion: {
          pregunta: '¿Qué valida esta prueba?',
          respuesta: 'La importación JSON estructurada.'
        }
      }],
      mapas_contenido: [{
        id: 'mapa-ci-import',
        titulo: 'Mapa CI Importado',
        subtemas: [{
          nota_id: 'atomica-ci-import',
          razon: 'Subtema de prueba de importación'
        }]
      }]
    };

    const importRes = await makeRequest({
      hostname: 'localhost',
      port: 3456,
      path: '/api/import/json',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, importPayload);

    assert(importRes.status === 200 && importRes.body.success, 'POST /api/import/json importa paquete con 200 OK');
    assert(importRes.body.stats.atomicas === 1 && importRes.body.stats.fuentes === 1 && importRes.body.stats.mapas === 1 && importRes.body.stats.preguntas === 1, 'Estadísticas de importación concuerdan exactamente');

    // Limpieza de notas importadas en prueba CI
    await makeRequest({ hostname: 'localhost', port: 3456, path: '/api/notes/mapa/mapa-ci-import', method: 'DELETE' });
    await makeRequest({ hostname: 'localhost', port: 3456, path: '/api/notes/atomica/atomica-ci-import', method: 'DELETE' });
    await makeRequest({ hostname: 'localhost', port: 3456, path: '/api/notes/fuente/fuente-ci-import', method: 'DELETE' });

    console.log(`\nRESUMEN DE PRUEBAS: ${passed} pasadas, ${failed} falladas.`);
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Error durante la ejecución de las pruebas:', err);
    process.exit(1);
  }
}

runTests();
