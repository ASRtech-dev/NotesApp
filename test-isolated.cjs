const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawn, spawnSync} = require('child_process');
const assert = require('assert/strict');
const vm = require('vm');
(async () => {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'notesapp-test-'));
 const matter=require('gray-matter');
 const seed=(folder,id,data,content='Synthetic test content')=>{
  fs.mkdirSync(path.join(root,folder),{recursive:true});
  fs.writeFileSync(path.join(root,folder,id+'.md'),matter.stringify(content,{id,...data}));
 };
 seed('02-source-notes','fuente-test',{titulo:'Test source',tipo:'fuente'});
 seed('03-atomic-notes','atomica-efecto-generacion',{titulo:'Test idea',tipo:'atomica',creado:'2020-01-01'});
 seed('03-atomic-notes','atomica-second',{titulo:'Second test idea',tipo:'atomica',enlaces:['atomica-efecto-generacion']},'[[atomica-efecto-generacion]]');
 seed('04-content-maps','mapa-tecnicas-estudio',{titulo:'Test map',tipo:'mapa',subtemas:[{nota_id:'atomica-efecto-generacion',razon:'Test connection'}]});
 seed('04-content-maps/nested','mapa-arquitectura-evaluacion-ml',{titulo:'Nested test map',tipo:'mapa',subtemas:[]});
 seed('05-self-assessment','pregunta-efecto-generacion',{nota_id:'atomica-efecto-generacion',proxima_revision:'2020-01-01',ease_factor:2.5,intervalo_dias:1,historial:[]},'- P: Test question?\n- R: Test answer');
 const port=13456;
 const server=spawn(process.execPath,['server.js'],{cwd:__dirname,env:{...process.env,PORT:String(port),NOTESAPP_DATA_DIR:root},stdio:'inherit'});
 try {
  let ready=false;
  for(let i=0;i<200;i++){try{await fetch(`http://localhost:${port}/api/notes`);ready=true;break;}catch{await new Promise(r=>setTimeout(r,100));}}
  assert(ready,'Server starts');
  const suite=fs.readFileSync('test-app.js','utf8').replaceAll('port: 3456',`port: ${port}`);
  const result=spawnSync(process.execPath,['-e',suite],{stdio:'inherit'});
  assert.equal(result.status,0,'Existing integration suite');
  const post=(route,body)=>fetch(`http://localhost:${port}${route}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  for(const q of [null,'3',1.5,{},-1,6]) assert.equal((await post('/api/reviews/grade',{preguntaId:'pregunta-efecto-generacion',q})).status,400);
  assert.equal((await post('/api/notes',{tipo:'atomica'})).status,400);
  assert.equal((await post('/api/notes',{tipo:'atomica',data:{titulo:'Unsafe',carpeta:'../../outside'}})).status,400);
  assert.equal((await fetch(`http://localhost:${port}/api/export/study-guide/mapa-arquitectura-evaluacion-ml`)).status,200);
  const selfNote = await post('/api/notes',{tipo:'atomica',data:{id:'atomica-graph-self-test',titulo:'Graph self-link test',enlaces:['atomica-graph-self-test']},content:'[[atomica-graph-self-test]]'});
  assert.equal(selfNote.status,201);
  const selfGraph=await (await fetch(`http://localhost:${port}/api/graph`)).json();
  assert(!selfGraph.links.some(l=>l.source===l.target),'Self references are not graph connections');
  assert.equal(selfGraph.nodes.find(n=>n.id==='atomica-graph-self-test').degree,0);
  await fetch(`http://localhost:${port}/api/notes/atomica/atomica-graph-self-test`,{method:'DELETE'});
  const duplicate=await post('/api/notes',{tipo:'atomica',data:{id:'atomica-efecto-generacion',titulo:'Duplicate',carpeta:'other'},content:'Overwrite'});
  assert.equal(duplicate.status,409);
  const edit=await fetch('http://localhost:'+port+'/api/notes/atomica/atomica-efecto-generacion',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:{titulo:'Updated'}})});
  assert.equal(edit.status,200);
  const preserved=await (await fetch('http://localhost:'+port+'/api/notes/atomica/atomica-efecto-generacion')).json();
  assert.equal(preserved.data.creado,'2020-01-01');
  assert(preserved.content.includes('Synthetic'));
  const invalidImport=await post('/api/import/json',{notas_atomicas:[{titulo:'Should not be written'},{titulo:'Invalid',idea:42}]});
  assert.equal(invalidImport.status,400);
  assert.equal((await fetch('http://localhost:'+port+'/api/notes/atomica/atomica-should-not-be-written')).status,404);
  const moved=await fetch('http://localhost:'+port+'/api/notes/atomica/atomica-efecto-generacion',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:{carpeta:'nested'}})});
  assert.equal(moved.status,200);
  assert.equal((await post('/api/reviews/grade',{preguntaId:'pregunta-efecto-generacion',q:4})).status,200);
  const nestedNote=await (await fetch('http://localhost:'+port+'/api/notes/atomica/atomica-efecto-generacion')).json();
  assert(nestedNote.data.ultimo_repaso);
  const due=await (await fetch('http://localhost:'+port+'/api/reviews/queue')).json();
  assert.equal(due.totalDue,0);
  assert.equal(due.queue.length,0);
  const practice=await (await fetch('http://localhost:'+port+'/api/reviews/queue?all=true')).json();
  assert(practice.queue.length>0);
  assert.equal(practice.totalDue,0);
  assert(practice.isFuturePractice);
  const captures=await Promise.all(Array.from({length:25},()=>post('/api/inbox/quick-capture',{contenido:'Synthetic capture'}).then(r=>r.json())));
  assert.equal(new Set(captures.map(r=>r.note.id)).size,25);
  assert.equal((await post('/api/import/json',{notas_atomicas:[{id:'atomica-efecto-generacion',titulo:'Duplicate'}]})).status,409);
  const foreign=await fetch('http://localhost:'+port+'/api/notes',{headers:{Origin:'https://example.com'}});
  assert.equal(foreign.status,403);
  const getProjects=await (await fetch('http://localhost:'+port+'/api/projects')).json();
  assert(Array.isArray(getProjects.proyectos)&&Array.isArray(getProjects.campos));
  const newProj=await post('/api/projects',{campo:'Inteligencia Artificial',proyecto:'AI Agents and Automations',descripcion:'Curso sobre agentes'});
  assert.equal(newProj.status,201);
  const scopedNote=await post('/api/notes',{tipo:'atomica',data:{id:'atomica-ai-agents-loop',titulo:'ReAct Agent Loop',campo:'Inteligencia Artificial',proyecto:'AI Agents and Automations'},content:'## Idea (con mis palabras)\nEl loop de ReAct razona y actua.'});
  assert.equal(scopedNote.status,201);
  const scopedQ=await post('/api/questions',{nota_id:'atomica-ai-agents-loop',pregunta:'¿Que es ReAct?',respuesta:'Reason and Act.'});
  assert.equal(scopedQ.status,200);
  const campoNotes=await (await fetch('http://localhost:'+port+'/api/notes?campo=Inteligencia%20Artificial')).json();
  assert(campoNotes.atomica.some(a=>a.id==='atomica-ai-agents-loop'));
  assert(!campoNotes.atomica.some(a=>a.id==='atomica-efecto-generacion'));
  const proyNotes=await (await fetch('http://localhost:'+port+'/api/notes?proyecto=AI%20Agents%20and%20Automations')).json();
  assert(proyNotes.atomica.some(a=>a.id==='atomica-ai-agents-loop'));
  assert(!proyNotes.atomica.some(a=>a.id==='atomica-efecto-generacion'));
  const scopedQueue=await (await fetch('http://localhost:'+port+'/api/reviews/queue?campo=Inteligencia%20Artificial&all=true')).json();
  assert(scopedQueue.queue.some(q=>q.nota_id==='atomica-ai-agents-loop'));
  assert(!scopedQueue.queue.some(q=>q.nota_id==='atomica-efecto-generacion'));

  // --- PRUEBAS DE CREACIÓN Y EDICIÓN DE PROYECTOS (TIPOS Y DESCRIPCIÓN) ---
  const proyNews = await post('/api/projects', {
    campo: 'Economia',
    proyecto: 'Noticias Macro 2026',
    tipo: 'noticias',
    descripcion: 'Seguimiento de tipos de interes e inflacion'
  });
  assert.equal(proyNews.status, 201);
  const proyNewsData = await proyNews.json();
  assert.equal(proyNewsData.tipo, 'noticias');
  assert.equal(proyNewsData.descripcion, 'Seguimiento de tipos de interes e inflacion');

  // Edición de proyecto (cambio de nombre, descripción y tipo)
  const editProjRes = await fetch(`http://localhost:${port}/api/projects/inteligencia-artificial/ai-agents-and-automations`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nuevoNombre: 'AI Agents and Automations Advanced',
      tipo: 'curso',
      descripcion: 'Descripcion detallada del temario de agentes',
      estado: 'activo'
    })
  });
  assert.equal(editProjRes.status, 200);
  const editProjData = await editProjRes.json();
  assert.equal(editProjData.proyecto, 'AI Agents and Automations Advanced');
  assert.equal(editProjData.descripcion, 'Descripcion detallada del temario de agentes');
  assert.equal(editProjData.tipo, 'curso');

  // --- PRUEBAS DE INGESTA INCREMENTAL DE CURSO (LECCIÓN 1 -> LECCIÓN 2) ---
  // Lección 1
  const lec1Res = await post('/api/import/json', {
    campo: 'Inteligencia Artificial',
    proyecto: 'Curso Deep Learning',
    proyectoTipo: 'curso',
    leccionNumero: 1,
    leccionTitulo: 'Fundamentos de Redes Neuronales',
    notas_fuente: [{
      id: 'fuente-dl-lec1',
      titulo: 'Leccion 1: Perceptron',
      puntos_clave: 'Perceptrones y activaciones no lineales'
    }],
    notas_atomicas: [{
      id: 'atomica-perceptron-multicapa',
      titulo: 'Perceptron Multicapa',
      idea: 'Red neuronal feedforward con backpropagation.',
      por_que_importa: 'Permite aproximar funciones complejas.',
      como_se_conecta: 'Base del aprendizaje profundo.'
    }]
  });
  assert.equal(lec1Res.status, 200);

  // Verificar que la nota atómica tiene los metadatos de lección
  const noteLec1 = await (await fetch(`http://localhost:${port}/api/notes/atomica/atomica-perceptron-multicapa`)).json();
  assert.equal(noteLec1.data.leccion, 1);
  assert.equal(noteLec1.data.leccion_titulo, 'Fundamentos de Redes Neuronales');

  // Verificar mapa maestro del curso creado
  const courseMap1 = await (await fetch(`http://localhost:${port}/api/notes/mapa/mapa-curso-curso-deep-learning`)).json();
  assert(courseMap1.data.subtemas.some(s => s.nota_id === 'atomica-perceptron-multicapa'));

  // Lección 2 (Importación incremental: NO debe dar conflicto 409 y debe agregar al mapa y crear enlaces)
  const lec2Res = await post('/api/import/json', {
    campo: 'Inteligencia Artificial',
    proyecto: 'Curso Deep Learning',
    proyectoTipo: 'curso',
    leccionNumero: 2,
    leccionTitulo: 'Redes Convolucionales CNN',
    notas_fuente: [{
      id: 'fuente-dl-lec2',
      titulo: 'Leccion 2: Convoluciones',
      puntos_clave: 'Filtros y feature maps'
    }],
    notas_atomicas: [{
      id: 'atomica-capas-convolucionales',
      titulo: 'Capas Convolucionales',
      idea: 'Operacion de convolucion para extraer caracteristicas espaciales de imagenes.',
      por_que_importa: 'Invarianza a traslaciones espaciales.',
      como_se_conecta: 'Se conectan a un [[atomica-perceptron-multicapa]] para la clasificacion final.'
    }]
  });
  assert.equal(lec2Res.status, 200, 'Importación incremental de Lección 2 exitosa sin conflicto 409');

  // Verificar que el mapa maestro del curso ahora contiene AMBAS lecciones y subtemas
  const courseMap2 = await (await fetch(`http://localhost:${port}/api/notes/mapa/mapa-curso-curso-deep-learning`)).json();
  assert(courseMap2.data.subtemas.some(s => s.nota_id === 'atomica-perceptron-multicapa'));
  assert(courseMap2.data.subtemas.some(s => s.nota_id === 'atomica-capas-convolucionales'));

  // Verificar que se crearon las conexiones conceptuales inter-lección
  const noteLec2 = await (await fetch(`http://localhost:${port}/api/notes/atomica/atomica-capas-convolucionales`)).json();
  assert(noteLec2.data.enlaces.includes('atomica-perceptron-multicapa'), 'Lección 2 enlazada con Lección 1');

  // Verificar enlace bidireccional en la nota de la lección 1
  const noteLec1Updated = await (await fetch(`http://localhost:${port}/api/notes/atomica/atomica-perceptron-multicapa`)).json();
  assert(noteLec1Updated.data.enlaces.includes('atomica-capas-convolucionales'), 'Enlace bidireccional reciproco creado en Lección 1');

  // Verificar seguimiento de lecciones en proyectos.json
  const allProjectsAfter = await (await fetch(`http://localhost:${port}/api/projects`)).json();
  const dlProject = allProjectsAfter.proyectos.find(p => p.proySlug === 'curso-deep-learning');
  assert(dlProject);
  assert.equal(dlProject.lecciones.length, 2);
  assert.equal(dlProject.tipo, 'curso');

  // --- PRUEBA DE AUTO-CREACIÓN DE PROYECTO DESDE JSON DE LLM (SIN CREAR PROYECTO ANTES) ---
  const llmAutoProjRes = await post('/api/import/json', {
    campo: 'Biotecnología',
    proyecto: 'Edición Genética CRISPR',
    proyecto_tipo: 'investigacion',
    proyecto_descripcion: 'Investigación sobre endonucleasas Cas9 y edición dirigida del genoma.',
    notas_fuente: [{
      id: 'fuente-crispr-paper-1',
      titulo: 'Paper Doudna & Charpentier 2012',
      puntos_clave: 'Complejo ARN guía y proteína Cas9 para corte de doble cadena.'
    }],
    notas_atomicas: [{
      id: 'atomica-endonucleasa-cas9',
      titulo: 'Endonucleasa Cas9 guiada por ARN',
      carpeta: 'carpeta-generica-llm',
      tags: ['crispr', 'genetica'],
      idea: 'La proteína Cas9 utiliza un ARN guía para cortar secuencias específicas de ADN.',
      por_que_importa: 'Permite editar genes con alta precisión.',
      como_se_conecta: 'Fundamento de la ingeniería genética moderna.'
    }]
  });
  assert.equal(llmAutoProjRes.status, 200);
  const llmAutoProjJson = await llmAutoProjRes.json();
  assert.equal(llmAutoProjJson.stats.proyecto_creado, true, 'El proyecto debe crearse automáticamente desde el JSON');
  assert.equal(llmAutoProjJson.stats.proyecto_tipo, 'investigacion');

  // Verificar que la nota quedó en la carpeta canónica campo/proyecto y no en carpeta-generica-llm
  const cas9Note = await (await fetch(`http://localhost:${port}/api/notes/atomica/atomica-endonucleasa-cas9`)).json();
  assert.equal(cas9Note.carpeta, 'biotecnologia/edicion-genetica-crispr');

  // Segunda importación JSON al mismo proyecto de investigación -> debe conectar automáticamente con la nota previa
  const llmAutoProjBatch2Res = await post('/api/import/json', {
    campo: 'Biotecnología',
    proyecto: 'Edición Genética CRISPR',
    proyecto_tipo: 'investigacion',
    notas_atomicas: [{
      id: 'atomica-reparacion-hdr-nhej',
      titulo: 'Reparación ADN por NHEJ y HDR tras corte Cas9',
      tags: ['crispr', 'reparacion-adn'],
      idea: 'Tras el corte de doble cadena realizado por la Endonucleasa Cas9 guiada por ARN, la célula repara el ADN mediante NHEJ o HDR.',
      por_que_importa: 'Determina si se inactiva un gen o se inserta una secuencia nueva.',
      como_se_conecta: 'Paso posterior inmediato a la acción de Cas9.'
    }]
  });
  assert.equal(llmAutoProjBatch2Res.status, 200);
  const llmAutoProjBatch2Json = await llmAutoProjBatch2Res.json();
  assert.equal(llmAutoProjBatch2Json.stats.proyecto_creado, false, 'El proyecto ya existía en el segundo lote');
  assert(llmAutoProjBatch2Json.stats.enlaces_inter_leccion >= 1, 'Debe crear enlaces automáticos entre lotes de cualquier proyecto');

  const cas9Updated = await (await fetch(`http://localhost:${port}/api/notes/atomica/atomica-endonucleasa-cas9`)).json();
  assert(cas9Updated.data.enlaces.includes('atomica-reparacion-hdr-nhej'), 'Enlace bidireccional creado en nota previa del proyecto de investigación');

  // Regresión: Importar desde la UI sobre un proyecto existente cuando el JSON interno trae el proyecto de ejemplo del prompt o IDs repetidos/plantilla
  const uiOverwriteProjRes = await post('/api/import/json', {
    campo: 'Biotecnología',
    proyecto: 'Edición Genética CRISPR',
    json: JSON.stringify({
      campo: 'Inteligencia Artificial',
      proyecto: 'AI Agents and Automations',
      fuentes: [{
        id: 'fuente-nombre-documento',
        titulo: 'Paper Prime Editing 2026',
        campo: 'Inteligencia Artificial',
        proyecto: 'AI Agents and Automations',
        puntos_clave: ['Edición sin corte de doble cadena'],
        ideas_disparadas: ['atomica-concepto-uno']
      }],
      notas_atomicas: [{
        id: 'atomica-concepto-uno',
        titulo: 'Prime Editing con transcriptasa inversa Cas9',
        fuente: 'fuente-nombre-documento',
        campo: 'Inteligencia Artificial',
        proyecto: 'AI Agents and Automations',
        tags: ['crispr', 'prime-editing'],
        idea: 'Prime Editing acopla una nickasa Cas9 con una transcriptasa inversa.',
        por_que_importa: 'Evita roturas de doble hebra.',
        como_se_conecta: 'Evolución directa de Cas9.'
      }]
    })
  });
  assert.equal(uiOverwriteProjRes.status, 200, 'La importación sobre proyecto existente con IDs de plantilla no debe fallar');
  const uiOverwriteProjJson = await uiOverwriteProjRes.json();
  assert.equal(uiOverwriteProjJson.stats.proyecto_creado, false, 'No debe crear un nuevo proyecto cuando se importa sobre uno existente');
  assert.equal(uiOverwriteProjJson.stats.proyecto, 'Edición Genética CRISPR', 'Debe respetar el proyecto objetivo seleccionado');

  // Regresión 2: Importar otro lote donde el LLM puso "Edición Genética CRISPR - Módulo 2: Base Editing" y repitió IDs de plantilla
  const suffixProjRes = await post('/api/import/json', {
    campo: 'General',
    proyecto: 'Edición Genética CRISPR - Módulo 2: Base Editing',
    fuentes: [{
      id: 'fuente-nombre-documento',
      titulo: 'Paper Base Editing 2026',
      puntos_clave: ['Desaminación directa de bases'],
      ideas_disparadas: ['atomica-concepto-uno']
    }],
    notas_atomicas: [{
      id: 'atomica-concepto-uno',
      titulo: 'Editores de bases citosina y adenina',
      fuente: 'fuente-nombre-documento',
      tags: ['crispr', 'base-editing'],
      idea: 'Los editores de bases convierten una base en otra sin cortar la doble hebra.',
      por_que_importa: 'Corrige mutaciones puntuales.',
      como_se_conecta: 'Complementa a Prime Editing.'
    }]
  });
  assert.equal(suffixProjRes.status, 200, 'Segundo lote con IDs de plantilla repetidos debe desambiguarse automáticamente');
  const suffixProjJson = await suffixProjRes.json();
  assert.equal(suffixProjJson.stats.proyecto_creado, false, 'No debe crear un proyecto duplicado cuando el LLM añade "- Módulo X" al nombre del proyecto');
  assert.equal(suffixProjJson.stats.proyecto, 'Edición Genética CRISPR');

  const allProjsAfterReg = await (await fetch(`http://localhost:${port}/api/projects`)).json();
  assert(!allProjsAfterReg.proyectos.some(p => (p.proyecto || p.nombre || '') === 'AI Agents and Automations'), 'No debe haberse creado el proyecto de ejemplo del prompt');
  assert(!allProjsAfterReg.proyectos.some(p => (p.proyecto || p.nombre || '').includes('Módulo 2')), 'No debe haberse creado un proyecto separado por sufijo de módulo');

  // Eliminar proyecto de noticias
  const delNews = await fetch(`http://localhost:${port}/api/projects/economia/noticias-macro-2026`, { method: 'DELETE' });
  assert.equal(delNews.status, 200);

  const context={window:{}};vm.runInNewContext(fs.readFileSync('public/i18n.js','utf8'),context);
  assert.equal(context.window.t('appName'),'NotesApp');
  assert.equal(context.window.t('navHome'),'Home');
  for(const lang of ['ES','EN']) { const prompt=context.window['MASTER_LLM_PROMPT_'+lang];const body=JSON.parse(prompt.slice(prompt.indexOf('{'),prompt.lastIndexOf('}')+1));assert(body.notas_atomicas.length);assert(prompt.includes('NotesApp')); }
  console.log('Regression checks passed: invalid grades, missing data, traversal, nested map export, default English, bilingual prompt JSON.');
 } finally {server.kill();console.log('Isolated test data: '+root);}
})().catch(error=>{console.error(error);process.exitCode=1;});

