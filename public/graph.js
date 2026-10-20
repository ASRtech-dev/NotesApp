/* Knowledge graph: world coordinates remain independent from the camera. */
const graph = {nodes:[],links:[],map:new Map(),camera:{x:0,y:0,scale:1},width:1,height:1,dpr:1,
 selected:null,hover:null,gesture:null,frame:null,request:0,loaded:false,loading:false,error:false,autoFit:true};
const graphColors={mapa:'#8b5cf6',fuente:'#3b82f6',atomica:'#159877'};
const campoColors={'inteligencia-artificial':'#6366f1','ciencias-cognitivas':'#0ea5e9','psicologia-cognitiva':'#ec4899','desarrollo-software':'#10b981','general':'#64748b'};
function getCampoColor(campo){
 if(!campo)return null;
 const slug=String(campo).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
 if(campoColors[slug])return campoColors[slug];
 let hash=0;for(let i=0;i<campo.length;i++)hash=campo.charCodeAt(i)+((hash<<5)-hash);
 return `hsl(${Math.abs(hash)%360},65%,50%)`;
}
function graphType(type){return {mapa:t('grafoLegendMapas'),fuente:t('grafoLegendFuentes'),atomica:t('grafoLegendAtomicas')}[type]||type;}
function graphVisible(){
 let nodes=graph.nodes.filter(n=>GraphMath.matches(n,state?.graphSearchQuery,state?.selectedGraphTag,state?.selectedGraphType));
 if(state?.activeField) nodes=nodes.filter(n=>(n.campo||'')===state.activeField);
 if(state?.activeProject) nodes=nodes.filter(n=>(n.proyecto||'')===state.activeProject);
 return nodes;
}
function graphPoint(event){const r=document.getElementById('graph-canvas').getBoundingClientRect();return {x:(event.clientX-r.left)*graph.width/r.width,y:(event.clientY-r.top)*graph.height/r.height};}
function graphResize(){
 const canvas=document.getElementById('graph-canvas'),wrapper=canvas.parentElement;
 if(state.currentView!=='grafo'||!wrapper.clientWidth||!wrapper.clientHeight)return;
 const w=wrapper.clientWidth,h=wrapper.clientHeight,dpr=Math.min(window.devicePixelRatio||1,3);
 graph.camera.x+=(w-graph.width)/2;graph.camera.y+=(h-graph.height)/2;
 graph.width=w;graph.height=h;graph.dpr=dpr;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
 if(graph.autoFit)graph.camera=GraphMath.fit(graphVisible(),w,h);
 drawGraphFrame();
}
function graphFit(){graph.autoFit=true;graph.camera=GraphMath.fit(graphVisible(),graph.width,graph.height);drawGraphFrame();}
function zoomGraph(factor,point={x:graph.width/2,y:graph.height/2}){
 graph.autoFit=false;graph.camera=GraphMath.zoom(graph.camera,factor,point);drawGraphFrame();
}
function graphSelect(id){
 const node=graph.map.get(id);
 if(node&&!GraphMath.matches(node,state.graphSearchQuery,state.selectedGraphTag,state.selectedGraphType)){
  state.graphSearchQuery='';state.selectedGraphTag='';state.selectedGraphType=null;
  document.getElementById('graph-search-input').value='';document.getElementById('graph-tag-filter').value='';
  graphRefreshUI();graphFit();
 }
 graph.selected=id;graph.hover=null;document.getElementById('graph-tooltip').style.display='none';graphDetails();drawGraphFrame();}
function graphDetails(){
 const panel=document.getElementById('graph-detail'),node=graph.map.get(graph.selected);panel.replaceChildren();
 const paragraph=(text,cls)=>{const p=document.createElement('p');p.textContent=text;if(cls)p.className=cls;panel.append(p);return p;};
 if(!node){paragraph(t('graphSelectTitle'),'graph-detail-heading');paragraph(t('graphSelectHint'));return;}
 paragraph(graphType(node.type),'graph-detail-type');
 const title=document.createElement('h3');title.textContent=node.label;panel.append(title);
 if(node.clusterLabel){
  paragraph(`🧭 ${node.clusterLabel}`,'graph-detail-cluster-badge');
 }
 if(node.campo||node.proyecto||node.modulo){
  const parts=[];
  if(node.campo)parts.push(`📁 ${node.campo}`);
  if(node.proyecto)parts.push(`🎯 ${node.proyecto}`);
  if(node.modulo)parts.push(`📦 ${node.modulo}`);
  paragraph(parts.join(' · '),'graph-detail-scope');
 }
 if(node.carpeta)paragraph(node.carpeta,'graph-detail-folder');
 if(node.tags.length)paragraph(node.tags.map(tag=>'#'+tag).join(' '),'graph-detail-tags');
 const open=document.createElement('button');open.type='button';open.className='btn-primary';open.textContent=t('graphOpenNote');open.onclick=()=>openReaderModal(node.type,node.id);panel.append(open);
 const connections=graph.links.filter(l=>l.source===node.id||l.target===node.id);
 paragraph(`${connections.length} ${t('graphConnections')}`,'graph-detail-heading');
 if(!connections.length)paragraph(t('graphIsolated'));
 const list=document.createElement('ul');list.className='graph-connections';
 const typeOrder={mapa:0,fuente:1,atomica:2};
 const typeIcon={mapa:'🗺️ ',fuente:'📚 ',atomica:'⚛️ '};
 const sortedConns=[...connections].sort((a,b)=>{
  const oa=graph.map.get(a.source===node.id?a.target:a.source);
  const ob=graph.map.get(b.source===node.id?b.target:b.source);
  return (typeOrder[oa?.type]??9)-(typeOrder[ob?.type]??9);
 });
 sortedConns.forEach(l=>{const other=graph.map.get(l.source===node.id?l.target:l.source);if(!other)return;
  const li=document.createElement('li'),button=document.createElement('button');button.type='button';button.textContent=(typeIcon[other.type]||'')+other.label;button.onclick=()=>graphSelect(other.id);li.append(button);
  const reason=document.createElement('p');reason.textContent=l.type==='mapa-subtema'?(l.label||t('graphMapLink')):t(l.type==='fuente-idea'?'graphSourceLink':'graphNoteLink');li.append(reason);list.append(li);
 });panel.append(list);
}
function graphRefreshUI(){
 document.getElementById('graph-canvas').setAttribute('aria-label',t('navGrafo'));
 document.getElementById('btn-graph-fit').title=t('graphFit');
 const visible=graphVisible(),ids=new Set(visible.map(n=>n.id));
 const links=graph.links.filter(l=>ids.has(l.source)&&ids.has(l.target));
 document.getElementById('graph-status').textContent=graph.loading?t('graphLoading'):graph.error?t('graphError'):`${visible.length} / ${graph.nodes.length} ${t('graphNotes')} · ${links.length} ${t('graphConnections')}`;
 const empty=document.getElementById('graph-empty');empty.hidden=graph.loading||graph.error||visible.length>0;
 empty.textContent=graph.nodes.length?t('graphNoMatches'):t('graphNoNotes');
 document.getElementById('graph-retry').hidden=!graph.error;
 const physics=document.getElementById('btn-graph-physics');physics.textContent=t(state.isGraphPhysicsActive?'graphPause':'graphResume');physics.setAttribute('aria-pressed',String(state.isGraphPhysicsActive));
 for(const type of ['mapa','fuente','atomica']){const el=document.getElementById('legend-filter-'+type);el.classList.toggle('active',state.selectedGraphType===type);el.setAttribute('aria-pressed',String(state.selectedGraphType===type));}
 const list=document.getElementById('graph-note-list');list.replaceChildren();
 visible.forEach(n=>{const li=document.createElement('li'),button=document.createElement('button');button.type='button';button.textContent=n.label;button.onclick=()=>graphSelect(n.id);li.append(button);list.append(li);});
 graphDetails();drawGraphFrame();
}
function graphFilter(){graph.hover=null;document.getElementById('graph-tooltip').style.display='none';if(graph.selected&&!graphVisible().some(n=>n.id===graph.selected))graph.selected=null;graphFit();graphRefreshUI();}
function graphCancelGesture(){if(graph.gesture?.node){graph.gesture.node.fixed=false;graph.gesture.node.vx=graph.gesture.node.vy=0;}graph.gesture=null;}
function initGraphControls(){
 const canvas=document.getElementById('graph-canvas');
 state.isGraphPhysicsActive=!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 document.getElementById('btn-graph-zoom-in').onclick=()=>zoomGraph(1.2);
 document.getElementById('btn-graph-zoom-out').onclick=()=>zoomGraph(1/1.2);
 document.getElementById('btn-graph-fit').onclick=graphFit;
 document.getElementById('btn-graph-reset').onclick=()=>{
  graphCancelGesture();graph.selected=null;state.selectedGraphType=null;state.selectedGraphTag='';state.graphSearchQuery='';
  document.getElementById('graph-search-input').value='';document.getElementById('graph-tag-filter').value='';
  graph.loaded=false;renderGraph();
 };
 document.getElementById('graph-retry').onclick=()=>{graph.loaded=false;renderGraph();};
 document.getElementById('btn-graph-physics').onclick=()=>{state.isGraphPhysicsActive=!state.isGraphPhysicsActive;stopGraphAnimation();graphRefreshUI();if(state.isGraphPhysicsActive)startGraphAnimation();};
 document.getElementById('graph-search-input').addEventListener('input',e=>{state.graphSearchQuery=e.target.value.trim();graphFilter();});
 document.getElementById('graph-tag-filter').addEventListener('change',e=>{state.selectedGraphTag=e.target.value;graphFilter();});
 for(const type of ['mapa','fuente','atomica'])document.getElementById('legend-filter-'+type).onclick=()=>{state.selectedGraphType=state.selectedGraphType===type?null:type;graphFilter();};
 new ResizeObserver(graphResize).observe(canvas.parentElement);
 canvas.addEventListener('wheel',e=>{e.preventDefault();zoomGraph(e.deltaY<0?1.12:1/1.12,graphPoint(e));},{passive:false});
 canvas.addEventListener('keydown',e=>{
  if(['+','=','-','0','Escape'].includes(e.key)){e.preventDefault();if(e.key==='0')graphFit();else if(e.key==='Escape')graphSelect(null);else zoomGraph(e.key==='-'?1/1.2:1.2);}
 });
 canvas.addEventListener('pointerdown',e=>{
  if(e.button!==0||graph.gesture)return;
  const p=graphPoint(e),node=GraphMath.hit(graphVisible(),p,graph.camera);
  const world=GraphMath.world(p,graph.camera);
  graph.gesture={id:e.pointerId,start:p,last:p,node,moved:false,offset:node?{x:node.x-world.x,y:node.y-world.y}:null};
  if(node)node.fixed=true;
  graph.autoFit=false;graph.hover=null;document.getElementById('graph-tooltip').style.display='none';canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';
 });
 canvas.addEventListener('pointermove',e=>{
  const p=graphPoint(e),g=graph.gesture;
  if(g){if(g.id!==e.pointerId)return;g.moved ||= Math.hypot(p.x-g.start.x,p.y-g.start.y)>5;
   if(g.moved){if(g.node){const w=GraphMath.world(p,graph.camera);g.node.x=w.x+g.offset.x;g.node.y=w.y+g.offset.y;g.node.vx=g.node.vy=0;}
   else{graph.camera.x+=p.x-g.last.x;graph.camera.y+=p.y-g.last.y;}}g.last=p;drawGraphFrame();return;
  }
  const hit=GraphMath.hit(graphVisible(),p,graph.camera);graph.hover=hit?.id||null;canvas.style.cursor=hit?'pointer':'grab';
  const tip=document.getElementById('graph-tooltip');tip.style.display=hit?'block':'none';
  if(hit){let _lbl=hit.label;if(hit.proyecto)_lbl+=' · 🎯 '+hit.proyecto;else if(hit.campo)_lbl+=' · 📁 '+hit.campo;tip.textContent=_lbl;tip.style.left=Math.max(8,Math.min(p.x+14,graph.width-tip.offsetWidth-8))+'px';tip.style.top=Math.max(8,Math.min(p.y+14,graph.height-tip.offsetHeight-8))+'px';}drawGraphFrame();
 });
 const finish=e=>{const g=graph.gesture;if(!g||g.id!==e.pointerId)return;const id=!g.moved?g.node?.id:null;graphCancelGesture();if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);canvas.style.cursor='grab';if(id)graphSelect(id);};
 canvas.addEventListener('pointerup',finish);
 canvas.addEventListener('pointercancel',()=>{graphCancelGesture();drawGraphFrame();});
 canvas.addEventListener('lostpointercapture',graphCancelGesture);
 canvas.addEventListener('pointerleave',()=>{if(!graph.gesture){graph.hover=null;document.getElementById('graph-tooltip').style.display='none';drawGraphFrame();}});
}
function computeGraphClusterLayout(nodes, links, previous) {
 const byId = new Map(nodes.map(n => [n.id, n]));
 // 1. Identify center master maps vs topic/lesson clusters
 nodes.forEach(n => {
  const isCourseMap = n.type === 'mapa' && (n.tipo_mapa === 'curso' || n.id.startsWith('mapa-curso-'));
  if (isCourseMap) {
   n.clusterId = '__center__';
   n.clusterLabel = n.proyecto || n.label;
   n.r = 22;
   return;
  }
  if (n.type === 'mapa') n.r = 16;
  else if (n.type === 'fuente') n.r = 14.5;
  else n.r = 9.5 + Math.min(4.5, Math.sqrt(n.degree || 0) * 1.4);

  if (n.leccion !== null && n.leccion !== undefined && n.leccion !== '') {
   const lNum = String(n.leccion).padStart(2, '0');
   n.clusterId = `${n.proyecto || 'course'}::L${lNum}`;
   n.clusterLabel = n.leccion_titulo ? `L${n.leccion} · ${n.leccion_titulo}` : `Lesson ${n.leccion}`;
  } else if (n.carpeta) {
   const topFolder = String(n.carpeta).split('/')[0].trim();
   n.clusterId = `folder::${topFolder.toLowerCase()}`;
   n.clusterLabel = topFolder;
  } else if (n.proyecto) {
   n.clusterId = `proj::${n.proyecto}`;
   n.clusterLabel = n.proyecto;
  } else if (n.campo) {
   n.clusterId = `field::${n.campo}`;
   n.clusterLabel = n.campo;
  } else {
   n.clusterId = 'general';
   n.clusterLabel = 'General';
  }
 });

 // Inherit cluster from parent Source or Topic Map when an atomic note is in 'general'
 links.forEach(l => {
  const a = byId.get(l.source), b = byId.get(l.target);
  if (!a || !b) return;
  if ((l.type === 'fuente-idea' || l.type === 'mapa-subtema') && a.clusterId && a.clusterId !== '__center__' && (!b.clusterId || b.clusterId === 'general')) {
   b.clusterId = a.clusterId;
   b.clusterLabel = a.clusterLabel;
  }
 });

 // 2. Group nodes by clusterId
 const clusterMap = new Map();
 const centerNodes = [];
 nodes.forEach(n => {
  if (n.clusterId === '__center__') {
   centerNodes.push(n);
  } else {
   if (!clusterMap.has(n.clusterId)) clusterMap.set(n.clusterId, { id: n.clusterId, label: n.clusterLabel, nodes: [] });
   clusterMap.get(n.clusterId).nodes.push(n);
  }
 });

 // Place center nodes near (0,0)
 centerNodes.forEach((n, idx) => {
  const old = previous.get(n.id);
  const cx = idx === 0 ? 0 : Math.cos(idx * 2.1) * 70;
  const cy = idx === 0 ? 0 : Math.sin(idx * 2.1) * 70;
  n.anchorX = cx;
  n.anchorY = cy;
  n.x = old?.x ?? cx;
  n.y = old?.y ?? cy;
 });

 // Sort clusters naturally (so L01, L02, ... L10 go clockwise in curriculum order)
 const clusters = [...clusterMap.values()].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
 const K = Math.max(1, clusters.length);
 const ringRadius = K === 1 ? 0 : Math.max(360, K * 56);

 clusters.forEach((cluster, cIdx) => {
  const angle = -Math.PI / 2 + (2 * Math.PI * cIdx) / K;
  const cx = K === 1 && centerNodes.length === 0 ? 0 : Math.cos(angle) * ringRadius;
  const cy = K === 1 && centerNodes.length === 0 ? 0 : Math.sin(angle) * ringRadius;
  cluster.cx = cx;
  cluster.cy = cy;

  const hubs = cluster.nodes.filter(n => n.type === 'mapa' || n.type === 'fuente');
  const leaves = cluster.nodes.filter(n => n.type !== 'mapa' && n.type !== 'fuente');

  hubs.forEach((h, hIdx) => {
   const old = previous.get(h.id);
   const hAngle = angle + (hIdx - (hubs.length - 1) / 2) * 0.6;
   const hDist = hubs.length > 1 ? 26 : 0;
   const hx = cx + Math.cos(hAngle) * hDist;
   const hy = cy + Math.sin(hAngle) * hDist;
   h.anchorX = hx;
   h.anchorY = hy;
   h.x = old?.x ?? hx;
   h.y = old?.y ?? hy;
  });

  leaves.forEach((leaf, lIdx) => {
   const old = previous.get(leaf.id);
   const ring = Math.floor(lIdx / 10);
   const posInRing = lIdx % 10;
   const countInRing = Math.min(10, leaves.length - ring * 10);
   const lAngle = angle + (2 * Math.PI * posInRing) / Math.max(1, countInRing) + ring * 0.35;
   const lRadius = 86 + ring * 54;
   const lx = cx + Math.cos(lAngle) * lRadius;
   const ly = cy + Math.sin(lAngle) * lRadius;
   leaf.anchorX = cx + Math.cos(lAngle) * (lRadius * 0.85);
   leaf.anchorY = cy + Math.sin(lAngle) * (lRadius * 0.85);
   leaf.x = old?.x ?? lx;
   leaf.y = old?.y ?? ly;
  });
 });
}

async function renderGraph(){
 if(state.currentView!=='grafo')return;
 graphResize();stopGraphAnimation();const request=++graph.request;graph.loading=true;graph.error=false;graphRefreshUI();
 try{
  const res=await fetch('/api/graph');if(!res.ok)throw new Error('Graph request failed');const data=await res.json();
  if(request!==graph.request)return;
  if(!Array.isArray(data.nodes)||!Array.isArray(data.links))throw new Error('Invalid graph');
  const previous=graph.loaded?graph.map:new Map();
  graph.nodes=data.nodes.filter(n=>n&&typeof n.id==='string').map((n,i)=>{
   const angle=i*2.3999632297,radius=100*Math.sqrt(i+1);
   return {...n,label:String(n.label||n.id),tags:Array.isArray(n.tags)?n.tags.map(String):[],r:12,x:Math.cos(angle)*radius,y:Math.sin(angle)*radius,vx:0,vy:0};
  });
  graph.map=new Map(graph.nodes.map(n=>[n.id,n]));
  graph.links=data.links.filter(l=>l.source!==l.target&&graph.map.has(l.source)&&graph.map.has(l.target));
  computeGraphClusterLayout(graph.nodes, graph.links, previous);
  // Settle the initial layout before the first frame, also respecting reduced motion.
  if(!graph.loaded&&graph.nodes.length<250)for(let i=0;i<75;i++)GraphMath.step(graph.nodes,graph.links,graph.map);
  if(!graph.loaded){graph.autoFit=true;graphFit();}
  graph.loaded=true;graph.loading=false;if(!graph.map.has(graph.selected))graph.selected=null;
  graphRefreshUI();if(state.isGraphPhysicsActive)startGraphAnimation();
 }catch(error){if(request!==graph.request)return;graph.loading=false;graph.error=true;graphRefreshUI();}
}
function stopGraphAnimation(){if(graph.frame)cancelAnimationFrame(graph.frame);graph.frame=null;}
function startGraphAnimation(){
 stopGraphAnimation();let frames=0;
 function loop(){graph.frame=null;if(state.currentView!=='grafo'||!state.isGraphPhysicsActive)return;
  GraphMath.step(graph.nodes,graph.links,graph.map);if(graph.autoFit)graph.camera=GraphMath.fit(graphVisible(),graph.width,graph.height);drawGraphFrame();
  if(++frames<180)graph.frame=requestAnimationFrame(loop);
 }graph.frame=requestAnimationFrame(loop);
}
function drawGraphFrame(){
 if(state.currentView!=='grafo')return;
 const canvas=document.getElementById('graph-canvas'),ctx=canvas.getContext('2d');if(!ctx)return;
 ctx.setTransform(graph.dpr,0,0,graph.dpr,0,0);ctx.clearRect(0,0,graph.width,graph.height);
 const nodes=graphVisible(),ids=new Set(nodes.map(n=>n.id)),focus=graph.hover||graph.selected,neighbors=new Set([focus]);
 graph.links.forEach(l=>{if(l.source===focus)neighbors.add(l.target);if(l.target===focus)neighbors.add(l.source);});
 const dark=state.theme==='dark',pastel=state.theme==='pastel',bg=dark?'#171c26':(pastel?'#f7f4ed':'#fff'),fg=dark?'#e6edf5':(pastel?'#242132':'#25262b');

 // 1. Draw subtle cluster constellation halos in background
 const clusterGroups=new Map();
 nodes.forEach(n=>{
  if(!n.clusterId||n.clusterId==='__center__')return;
  if(!clusterGroups.has(n.clusterId))clusterGroups.set(n.clusterId,{label:n.clusterLabel||n.clusterId,pts:[]});
  clusterGroups.get(n.clusterId).pts.push(GraphMath.screen(n,graph.camera));
 });
 clusterGroups.forEach(cg=>{
  if(cg.pts.length<2)return;
  const cx=cg.pts.reduce((s,p)=>s+p.x,0)/cg.pts.length;
  const cy=cg.pts.reduce((s,p)=>s+p.y,0)/cg.pts.length;
  const maxD=Math.max(36*graph.camera.scale,...cg.pts.map(p=>Math.hypot(p.x-cx,p.y-cy)+24*graph.camera.scale));
  ctx.save();
  ctx.beginPath();ctx.arc(cx,cy,maxD,0,Math.PI*2);
  ctx.fillStyle=dark?'rgba(59,130,246,0.035)':'rgba(59,130,246,0.03)';
  ctx.fill();
  ctx.strokeStyle=dark?'rgba(148,163,184,0.10)':'rgba(100,116,139,0.12)';
  ctx.lineWidth=1;
  ctx.setLineDash([5,5]);
  ctx.stroke();
  ctx.restore();
 });

 // 2. Draw edges with hierarchy-aware styling
 graph.links.forEach(l=>{
  if(!ids.has(l.source)||!ids.has(l.target))return;
  const na=graph.map.get(l.source),nb=graph.map.get(l.target);
  const a=GraphMath.screen(na,graph.camera),b=GraphMath.screen(nb,graph.camera);
  const isActive=focus&&(l.source===focus||l.target===focus);
  const isCourseSpoke=(na?.tipo_mapa==='curso'||nb?.tipo_mapa==='curso');
  ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
  if(isActive){
   ctx.strokeStyle=l.type==='mapa-subtema'?'#a78bfa':l.type==='fuente-idea'?'#60a5fa':(dark?'#34d399':'#10b981');
   ctx.lineWidth=2.2;
   ctx.globalAlpha=0.95;
  }else{
   ctx.strokeStyle=isCourseSpoke?(dark?'rgba(139,92,246,0.42)':'rgba(139,92,246,0.35)'):l.type==='mapa-subtema'?(dark?'rgba(139,92,246,0.30)':'rgba(139,92,246,0.25)'):l.type==='fuente-idea'?(dark?'rgba(59,130,246,0.34)':'rgba(59,130,246,0.28)'):(dark?'rgba(148,163,184,0.22)':'rgba(100,116,139,0.22)');
   ctx.lineWidth=isCourseSpoke?1.6:1.1;
   ctx.globalAlpha=focus&&(!neighbors.has(l.source)||!neighbors.has(l.target))?0.12:1;
  }
  ctx.setLineDash(isCourseSpoke?[6,4]:l.type==='mapa-subtema'?[3,3]:[]);
  ctx.stroke();
 });
 ctx.setLineDash([]);ctx.globalAlpha=1;

 // 3. Draw nodes (Atomics first, then Sources & Maps on top)
 const obstacles=nodes.map(n=>{const p=GraphMath.screen(n,graph.camera),r=Math.max(4,n.r*graph.camera.scale);return {x:p.x-r-4,y:p.y-r-4,w:2*r+8,h:2*r+8};});
 const drawOrder=[...nodes].sort((a,b)=>{
  const rank={atomica:0,fuente:1,mapa:2};
  return (rank[a.type]??0)-(rank[b.type]??0);
 });
 drawOrder.forEach(n=>{
  const p=GraphMath.screen(n,graph.camera),r=Math.max(4,n.r*graph.camera.scale);
  const isCourseMap=n.type==='mapa'&&(n.tipo_mapa==='curso'||n.id.startsWith('mapa-curso-'));
  ctx.globalAlpha=focus&&!neighbors.has(n.id)?0.22:1;
  if(isCourseMap||n.type==='mapa'||n.type==='fuente'){
   ctx.beginPath();ctx.arc(p.x,p.y,r+3.5,0,Math.PI*2);
   ctx.fillStyle=n.type==='mapa'?'rgba(139,92,246,0.20)':'rgba(59,130,246,0.18)';
   ctx.fill();
  }
  ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);
  ctx.fillStyle=graphColors[n.type]||'#64748b';
  ctx.fill();
  const _cCol=n.campo?getCampoColor(n.campo):null;
  ctx.strokeStyle=isCourseMap?'#c4b5fd':(_cCol||bg);
  ctx.lineWidth=isCourseMap?3:(_cCol?2.5:1.8);
  ctx.stroke();
  if(n.id===focus){
   ctx.beginPath();ctx.arc(p.x,p.y,r+6,0,Math.PI*2);
   ctx.strokeStyle=fg;ctx.lineWidth=2;ctx.stroke();
  }
 });
 ctx.globalAlpha=1;

 // 4. Place labels prioritizing Focus, Maps, Sources, then highest-degree Atomics
 const typePriority={mapa:3,fuente:2,atomica:1};
 const ordered=[...nodes].sort((a,b)=>(b.id===focus)-(a.id===focus)||(typePriority[b.type]||0)-(typePriority[a.type]||0)||(b.degree||0)-(a.degree||0));
 ctx.font='600 11.5px system-ui, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
 ordered.forEach(n=>{
  if(focus&&!neighbors.has(n.id))return;
  const p=GraphMath.screen(n,graph.camera),r=Math.max(4,n.r*graph.camera.scale);
  let text=n.label;
  while(ctx.measureText(text).width>165&&text.length>8)text=text.slice(0,-2);
  if(text!==n.label)text+='…';
  const w=ctx.measureText(text).width+14;
  const candidates=[{x:p.x-w/2,y:p.y+r+7,w,h:21},{x:p.x-w/2,y:p.y-r-28,w,h:21},{x:p.x+r+8,y:p.y-10.5,w,h:21},{x:p.x-r-w-8,y:p.y-10.5,w,h:21}];
  const box=candidates.find(b=>b.x>=4&&b.y>=4&&b.x+b.w<graph.width-4&&b.y+b.h<graph.height-4&&!obstacles.some(o=>GraphMath.overlaps(b,o)));
  if(!box)return;
  obstacles.push(box);
  ctx.fillStyle=dark?'rgba(23,28,38,0.92)':bg;
  ctx.fillRect(box.x,box.y,box.w,box.h);
  ctx.strokeStyle=n.type==='mapa'?'rgba(139,92,246,0.45)':n.type==='fuente'?'rgba(59,130,246,0.40)':(dark?'rgba(148,163,184,0.22)':'rgba(100,116,139,0.20)');
  ctx.lineWidth=1;
  ctx.strokeRect(box.x,box.y,box.w,box.h);
  ctx.fillStyle=fg;
  ctx.fillText(text,box.x+box.w/2,box.y+box.h/2);
 });
 const zoom=document.getElementById('graph-zoom-label');if(zoom)zoom.textContent=Math.round(graph.camera.scale*100)+'%';
}
