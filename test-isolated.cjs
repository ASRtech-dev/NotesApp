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
  const context={window:{}};vm.runInNewContext(fs.readFileSync('public/i18n.js','utf8'),context);
  assert.equal(context.window.t('appName'),'NotesApp');
  assert.equal(context.window.t('navHome'),'Home');
  for(const lang of ['ES','EN']) { const prompt=context.window['MASTER_LLM_PROMPT_'+lang];const body=JSON.parse(prompt.slice(prompt.indexOf('{'),prompt.lastIndexOf('}')+1));assert(body.notas_atomicas.length);assert(prompt.includes('NotesApp')); }
  console.log('Regression checks passed: invalid grades, missing data, traversal, nested map export, default English, bilingual prompt JSON.');
 } finally {server.kill();console.log('Isolated test data: '+root);}
})().catch(error=>{console.error(error);process.exitCode=1;});

