/* Knowledge graph: world coordinates remain independent from the camera. */
const graph = {nodes:[],links:[],map:new Map(),camera:{x:0,y:0,scale:1},width:1,height:1,dpr:1,
 selected:null,hover:null,gesture:null,frame:null,request:0,loaded:false,loading:false,error:false,autoFit:true};
const graphColors={mapa:'#8b5cf6',fuente:'#3b82f6',atomica:'#159877'};
function graphType(type){return {mapa:t('grafoLegendMapas'),fuente:t('grafoLegendFuentes'),atomica:t('grafoLegendAtomicas')}[type]||type;}
function graphVisible(){return graph.nodes.filter(n=>GraphMath.matches(n,state.graphSearchQuery,state.selectedGraphTag,state.selectedGraphType));}
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
 if(node.carpeta)paragraph(node.carpeta,'graph-detail-folder');
 if(node.tags.length)paragraph(node.tags.map(tag=>'#'+tag).join(' '),'graph-detail-tags');
 const open=document.createElement('button');open.type='button';open.className='btn-primary';open.textContent=t('graphOpenNote');open.onclick=()=>openReaderModal(node.type,node.id);panel.append(open);
 const connections=graph.links.filter(l=>l.source===node.id||l.target===node.id);
 paragraph(`${connections.length} ${t('graphConnections')}`,'graph-detail-heading');
 if(!connections.length)paragraph(t('graphIsolated'));
 const list=document.createElement('ul');list.className='graph-connections';
 connections.forEach(l=>{const other=graph.map.get(l.source===node.id?l.target:l.source);if(!other)return;
  const li=document.createElement('li'),button=document.createElement('button');button.type='button';button.textContent=other.label;button.onclick=()=>graphSelect(other.id);li.append(button);
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
  if(hit){tip.textContent=hit.label;tip.style.left=Math.max(8,Math.min(p.x+14,graph.width-tip.offsetWidth-8))+'px';tip.style.top=Math.max(8,Math.min(p.y+14,graph.height-tip.offsetHeight-8))+'px';}drawGraphFrame();
 });
 const finish=e=>{const g=graph.gesture;if(!g||g.id!==e.pointerId)return;const id=!g.moved?g.node?.id:null;graphCancelGesture();if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);canvas.style.cursor='grab';if(id)graphSelect(id);};
 canvas.addEventListener('pointerup',finish);
 canvas.addEventListener('pointercancel',()=>{graphCancelGesture();drawGraphFrame();});
 canvas.addEventListener('lostpointercapture',graphCancelGesture);
 canvas.addEventListener('pointerleave',()=>{if(!graph.gesture){graph.hover=null;document.getElementById('graph-tooltip').style.display='none';drawGraphFrame();}});
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
   const old=previous.get(n.id),angle=i*2.3999632297,radius=100*Math.sqrt(i+1);
   return {...n,label:String(n.label||n.id),tags:Array.isArray(n.tags)?n.tags.map(String):[],r:12+Math.min(9,Math.sqrt(n.degree||0)*3),x:old?.x??Math.cos(angle)*radius,y:old?.y??Math.sin(angle)*radius,vx:0,vy:0};
  });
  graph.map=new Map(graph.nodes.map(n=>[n.id,n]));
  graph.links=data.links.filter(l=>l.source!==l.target&&graph.map.has(l.source)&&graph.map.has(l.target));
  // Settle the initial layout before the first frame, also respecting reduced motion.
  if(!graph.loaded&&graph.nodes.length<200)for(let i=0;i<100;i++)GraphMath.step(graph.nodes,graph.links,graph.map);
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
 const dark=state.theme==='dark',bg=dark?'#1c1c1e':'#fff',fg=dark?'#f1f1f4':'#25262b';
 graph.links.forEach(l=>{if(!ids.has(l.source)||!ids.has(l.target))return;const a=GraphMath.screen(graph.map.get(l.source),graph.camera),b=GraphMath.screen(graph.map.get(l.target),graph.camera);
  ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=focus&&(l.source===focus||l.target===focus)?'#7685ae':dark?'#444853':'#d8dce5';ctx.globalAlpha=focus&&!neighbors.has(l.source)?.2:1;ctx.lineWidth=focus&&(l.source===focus||l.target===focus)?1.8:1;ctx.setLineDash(l.type==='mapa-subtema'?[4,4]:[]);ctx.stroke();
 });ctx.setLineDash([]);ctx.globalAlpha=1;
 const obstacles=nodes.map(n=>{const p=GraphMath.screen(n,graph.camera),r=Math.max(4,n.r*graph.camera.scale);return {x:p.x-r-4,y:p.y-r-4,w:2*r+8,h:2*r+8};});
 nodes.forEach(n=>{const p=GraphMath.screen(n,graph.camera),r=Math.max(4,n.r*graph.camera.scale);ctx.globalAlpha=focus&&!neighbors.has(n.id)?.25:1;
  ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fillStyle=graphColors[n.type]||'#64748b';ctx.fill();ctx.strokeStyle=bg;ctx.lineWidth=2;ctx.stroke();
  if(n.id===focus){ctx.beginPath();ctx.arc(p.x,p.y,r+5,0,Math.PI*2);ctx.strokeStyle=fg;ctx.lineWidth=1.5;ctx.stroke();}
 });ctx.globalAlpha=1;
 // Place labels only when they do not cover another node or label. Full text stays in the inspector/list.
 const ordered=[...nodes].sort((a,b)=>(b.id===focus)-(a.id===focus)||(b.degree||0)-(a.degree||0));
 ctx.font='500 12px system-ui, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
 ordered.forEach(n=>{if(focus&&!neighbors.has(n.id))return;const p=GraphMath.screen(n,graph.camera),r=Math.max(4,n.r*graph.camera.scale);
  let text=n.label;while(ctx.measureText(text).width>155&&text.length>8)text=text.slice(0,-2);if(text!==n.label)text+='…';const w=ctx.measureText(text).width+12;
  const candidates=[{x:p.x-w/2,y:p.y+r+8,w,h:22},{x:p.x-w/2,y:p.y-r-30,w,h:22},{x:p.x+r+8,y:p.y-11,w,h:22},{x:p.x-r-w-8,y:p.y-11,w,h:22}];
  const box=candidates.find(b=>b.x>=4&&b.y>=4&&b.x+b.w<graph.width-4&&b.y+b.h<graph.height-4&&!obstacles.some(o=>GraphMath.overlaps(b,o)));
  if(!box)return;obstacles.push(box);ctx.fillStyle=bg;ctx.fillRect(box.x,box.y,box.w,box.h);ctx.fillStyle=fg;ctx.fillText(text,box.x+box.w/2,box.y+box.h/2);
 });
 const zoom=document.getElementById('graph-zoom-label');if(zoom)zoom.textContent=Math.round(graph.camera.scale*100)+'%';
}
