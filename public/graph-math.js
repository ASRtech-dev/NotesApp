/* Pure graph geometry shared by the canvas and regression tests. */
(function(root) {
 const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
 const api = {
  matches(node, query, tag, type) {
   return (!type || node.type === type) && (!tag || (node.tags || []).includes(tag)) &&
    (!query || normalize([node.label,node.id,node.carpeta,...(node.tags || [])].join(' ')).includes(normalize(query)));
  },
  screen(node, camera) { return {x:node.x*camera.scale+camera.x,y:node.y*camera.scale+camera.y}; },
  world(point, camera) { return {x:(point.x-camera.x)/camera.scale,y:(point.y-camera.y)/camera.scale}; },
  zoom(camera, factor, point) {
   const world=api.world(point,camera), scale=Math.max(.03,Math.min(4,camera.scale*factor));
   return {scale,x:point.x-world.x*scale,y:point.y-world.y*scale};
  },
  fit(nodes,width,height) {
   if(!nodes.length) return {scale:1,x:width/2,y:height/2};
   const minX=Math.min(...nodes.map(n=>n.x-n.r-75)),maxX=Math.max(...nodes.map(n=>n.x+n.r+75));
   const minY=Math.min(...nodes.map(n=>n.y-n.r-35)),maxY=Math.max(...nodes.map(n=>n.y+n.r+50));
   const scale=Math.max(.03,Math.min(1.4,(width-40)/Math.max(1,maxX-minX),(height-40)/Math.max(1,maxY-minY)));
   return {scale,x:width/2-(minX+maxX)/2*scale,y:height/2-(minY+maxY)/2*scale};
  },
  hit(nodes,point,camera) {
   return [...nodes].reverse().find(n=>{const p=api.screen(n,camera);return Math.hypot(p.x-point.x,p.y-point.y)<=Math.max(10,n.r*camera.scale+5);}) || null;
  },
  overlaps(a,b) {return a.x<b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y;},
  step(nodes,links,map) {
   for(let i=0;i<nodes.length;i++) for(let j=i+1;j<nodes.length;j++) {
    const a=nodes[i],b=nodes[j];let dx=b.x-a.x,dy=b.y-a.y;
    if(Math.hypot(dx,dy)<.01){dx=1;dy=.5;}
    const d=Math.max(1,Math.hypot(dx,dy));
    const force=Math.min(7,2300/(d*d)) + Math.max(0,(a.r+b.r+70-d))*.035;
    const fx=dx/d*force,fy=dy/d*force;
    if(!a.fixed){a.vx-=fx;a.vy-=fy;} if(!b.fixed){b.vx+=fx;b.vy+=fy;}
   }
   links.forEach(l=>{const a=map.get(l.source),b=map.get(l.target);if(!a||!b||a===b)return;
    const dx=b.x-a.x,dy=b.y-a.y,d=Math.max(1,Math.hypot(dx,dy)),f=(d-220)*.004;
    if(!a.fixed){a.vx+=dx/d*f;a.vy+=dy/d*f;}if(!b.fixed){b.vx-=dx/d*f;b.vy-=dy/d*f;}
   });
   nodes.forEach(n=>{if(n.fixed)return;n.vx=(n.vx-n.x*.0001)*.8;n.vy=(n.vy-n.y*.0001)*.8;n.x+=Math.max(-8,Math.min(8,n.vx));n.y+=Math.max(-8,Math.min(8,n.vy));});
  }
 };
 if(typeof module!=='undefined') module.exports=api; else root.GraphMath=api;
})(typeof window!=='undefined'?window:globalThis);
