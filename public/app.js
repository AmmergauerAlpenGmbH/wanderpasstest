const state={targets:[],user:null,stamps:[],map:null,markers:[],syncing:false,tourMap:null,tourUserMarker:null,tourProfileMarker:null,tourProfileData:null,overviewTrackLayers:[],overviewTrackTarget:null,overviewTrackPinned:false,pendingMilestone:null,isTestMode:false};
const $=s=>document.querySelector(s);
async function api(path,opt={}){const headers={"Content-Type":"application/json",...(opt.headers||{})};const r=await fetch(path,{...opt,headers,credentials:"same-origin"});const d=await r.json();if(!r.ok){const e=Error(d.error||"Fehler");e.status=r.status;throw e;}return d}
function toast(s){const t=$("#toast");t.textContent=s;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),3000)}
function milestone(collected){
  const milestones={
    3:{title:"Wanderwarzi-Abzeichen",text:"Geschafft! Du hast Dir als fleißiger Wanderer das Wanderwarzi-Abzeichen verdient! Zeig den Wanderpass vor und hol Dir das Abzeichen in den Tourist Informationen im Ammertal ab! (Nur für Kids!)",warzi:true},
    5:{title:"5 Wanderziele erreicht!",text:"Glückwunsch! Du hast die Bronze-Stufe erreicht. Deine bronzene Wandernadel kannst Du Dir in einer der Tourist Informationen abholen. Einfach Wanderpass vorzeigen."},
    10:{title:"10 Wanderziele erreicht!",text:"Glückwunsch! Du hast die Silber-Stufe erreicht. Deine silberne Wandernadel kannst Du Dir in einer der Tourist Informationen abholen. Einfach Wanderpass vorzeigen."},
    12:{title:"Alle 12 Wanderziele geschafft!",text:"Glückwunsch! Du hast die Gold-Stufe erreicht. Deine goldene Wandernadel kannst Du Dir in einer der Tourist Informationen abholen. Einfach Wanderpass vorzeigen."}
  };
  const eligible=[3,5,10,12];
  const userKey=state.user?.id||state.user?.nickname||"anonymous";
  const keyPrefix=state.isTestMode?"gp.milestone.test.v66":"gp.milestone";
  const hit=eligible.find(n=>collected===n && !localStorage.getItem(`${keyPrefix}.${userKey}.${n}`));
  if(!hit)return false;
  const m=milestones[hit];
  const box=$("#milestoneModal");
  if(!box)return false;
  $("#milestoneTitle").textContent=m.title;
  $("#milestoneText").textContent=m.text;
  const warzi=$("#milestoneWarzi");
  if(warzi){warzi.classList.toggle("hidden",!m.warzi);warzi.alt=m.warzi?"Wanderwarzi beim Wandern":"";}
  box.classList.remove("hidden");
  localStorage.setItem(`${keyPrefix}.${userKey}.${hit}`,"1");
  return true;
}
function showMilestoneAfterCheckin(){
  const collected=new Set(state.stamps.map(x=>x.target_id));
  const count=Math.min(state.targets.length,[...collected].filter(id=>state.targets.some(t=>t.id===id)).length);
  if(!milestone(count))return false;
  return true;
}
function loadUser(){try{state.user=JSON.parse(localStorage.getItem("gp.user"))}catch{state.user=null}}
function saveUser(){const u={id:state.user?.id,nickname:state.user?.nickname};localStorage.setItem("gp.user",JSON.stringify(u))}
function tierForCount(collected){if(collected>=12)return "Gold";if(collected>=10)return "Silber";if(collected>=5)return "Bronze";return "";}
function renderTierBadge(collected){const el=$("#titleBadge");if(!el)return;const tiers=[{n:3,label:"Wanderwarzi",kids:true},{n:5,label:"Bronze",medal:"bronze"},{n:10,label:"Silber",medal:"silver"},{n:12,label:"Gold",medal:"gold"}]; el.innerHTML=tiers.map(t=>`<div class="tier-medal ${collected>=t.n?"reached":"locked"}${t.kids?" tier-kids":""}"><span class="tier-medal-icon">${t.kids?`<img class="kids-star" src="/assets/warzi-star-badge.png?v=66" alt="Wanderwarzi-Abzeichen">`:`<span class="medal-icon ${t.medal||""}" aria-hidden="true"></span>`}</span><span class="tier-medal-label">${t.label}</span><small>ab ${t.n}</small></div>`).join("");}
function renderPass(){const passTargets=state.targets;const set=new Set(state.stamps.map(x=>x.target_id));const collected=Math.min(passTargets.length,[...set].filter(id=>passTargets.some(t=>t.id===id)).length);const displayCount=collected;$("#count").textContent=displayCount;$("#passTotal").textContent=passTargets.length;$("#targetTotal").textContent=passTargets.length;$("#targetTotalHero").textContent=passTargets.length;$("#targetTotalMap").textContent=passTargets.length;$("#bar").style.width=(passTargets.length?Math.min(100,collected/passTargets.length*100):0)+"%";renderTierBadge(collected);renderSyncStatus();$("#targets").innerHTML=state.targets.map((t,i)=>`<article class="card ${set.has(t.id)?"done":""}"><div class="top"><b>${String(i+1).padStart(2,"0")}</b><span class="pill ${t.level}">${t.levelLabel}</span></div><button class="target-title-button" data-tour="${t.id}">${t.name}</button><small>${t.height}</small><p>${t.description}</p><div class="tour-mini"><span>🥾 ${t.tour.distance}</span><span>⛰️ ${t.tour.ascent} hm</span><span>⏱️ ${t.tour.duration}</span></div><div class="stamp">${set.has(t.id)?`<button class="stamp-collected" data-book="${t.id}"><img src="/assets/naturpark-berg-symbol.png" alt=""><b>Geschafft! Schreibe jetzt ins Gipfelbuch!</b><span class="stamp-check">✓</span></button>`:`Noch nicht gesammelt`}</div>${set.has(t.id)?"":`<button class="gps" data-id="${t.id}">⌖ Stempel holen</button>`}<button class="tour-link" data-tour="${t.id}">🥾 Tour ansehen</button><button class="book-link" data-target="${t.id}">Gipfelbuch ansehen</button></article>`).join("");
if(state.map)refreshMapMarkers();document.querySelectorAll(".gps").forEach(b=>b.onclick=()=>gps(b.dataset.id));document.querySelectorAll("[data-tour]").forEach(b=>b.onclick=()=>openTour(b.dataset.tour));document.querySelectorAll(".book-link").forEach(b=>b.onclick=()=>openBook(b.dataset.target));document.querySelectorAll(".stamp-collected").forEach(b=>b.onclick=()=>openEntry(b.dataset.book))}

function getQueue(){try{return JSON.parse(localStorage.getItem("gp.queue.v33")||"[]")}catch{return[]}}
function saveQueue(q){localStorage.setItem("gp.queue.v33",JSON.stringify(q));renderSyncStatus()}
function renderSyncStatus(){
  const el=$("#syncStatus"); if(!el)return;
  const n=getQueue().filter(x=>!state.user||x.userId===state.user.id).length;
  if(!navigator.onLine){el.className="sync-status offline";el.innerHTML=`<b>Offline gespeichert</b><span>${n?n+" Stempel warten auf Synchronisation.":"GPS-Stempel funktionieren auch ohne Empfang."}</span>`;return}
  if(n){el.className="sync-status pending";const label=n===1?"1 Stempel wartet auf Synchronisation":`${n} Stempel warten auf Synchronisation`;el.innerHTML=`<b>☁ ${label}</b><span>Die Übertragung erfolgt automatisch, sobald eine Verbindung verfügbar ist.</span>`;return}
  el.className="sync-status synced";el.innerHTML=`<b>✓ Alles synchronisiert</b><span>Dein Wanderpass ist aktuell.</span>`;
}
function addOfflineStamp(event){const q=getQueue();if(!q.some(x=>x.targetId===event.targetId && x.userId===event.userId)){q.push(event);saveQueue(q)}}
async function syncQueue(){if(state.syncing||!state.user||!navigator.onLine)return;state.syncing=true;try{const q=getQueue();const rest=[];for(const e of q){if(e.userId!==state.user.id){rest.push(e);continue}try{await api("/api/stamps",{method:"POST",body:JSON.stringify(e)});}catch{rest.push(e)}}saveQueue(rest);renderSyncStatus();if(q.length!==rest.length){await refresh();toast("✓ Offline-Stempel synchronisiert.")}}finally{state.syncing=false}}
const STAMP_RADIUS_METERS=200;
const GPS_ACQUISITION_MS=12000;
const GPS_GOOD_ACCURACY_METERS=50;
function getGpsPosition(){return new Promise((resolve,reject)=>{let best=null,done=false,timer=null,watchId=null;const finish=(value,error)=>{if(done)return;done=true;if(timer)clearTimeout(timer);if(watchId!==null)navigator.geolocation.clearWatch(watchId);if(value)resolve(value);else reject(error||new Error("Standortzugriff nicht möglich."))};watchId=navigator.geolocation.watchPosition(p=>{if(!best||p.coords.accuracy<best.coords.accuracy)best=p;if(p.coords.accuracy<=GPS_GOOD_ACCURACY_METERS)finish(p)},e=>{if(!best)finish(null,e)}, {enableHighAccuracy:true,maximumAge:0,timeout:GPS_ACQUISITION_MS});timer=setTimeout(()=>finish(best),GPS_ACQUISITION_MS);})}
async function gps(id){
  const t=state.targets.find(x=>x.id===id);
  if(!state.user)return toast("Bitte zuerst ein Profil anlegen.");
  const already=state.stamps.some(x=>x.target_id===id);
  if(already)return toast(`✓ ${t.name} ist bereits gesammelt.`);
  try{
    const beforeCount=new Set(state.stamps.map(x=>x.target_id)).size;
    if(!navigator.geolocation)return toast("GPS wird auf diesem Gerät nicht unterstützt.");
    toast("⌖ Standort wird geprüft …");
    const pos=await getGpsPosition();
    const accuracy=Number(pos.coords.accuracy);
    if(!Number.isFinite(accuracy))throw new Error("Standortgenauigkeit konnte nicht ermittelt werden.");
    await api("/api/stamps",{method:"POST",body:JSON.stringify({targetId:id,latitude:pos.coords.latitude,longitude:pos.coords.longitude,accuracy})});
    await refresh();
    const afterCount=Math.min(state.targets.length,new Set(state.stamps.map(x=>x.target_id)).size);
    const reached=[3,5,10,12].find(n=>beforeCount<n && afterCount>=n);
    if(reached)state.pendingMilestone={count:reached,target:t};
    toast(`✓ ${t.name}: Stempel gesammelt.`);
    setTimeout(()=>{showCheckin(t);},350);
  }catch(e){toast(e.message||"Stempel konnte nicht gebucht werden.")}
}

function dist(a,b,c,d){const R=6371000,r=Math.PI/180,x=(c-a)*r,y=(d-b)*r,z=Math.sin(x/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin(y/2)**2;return 2*R*Math.asin(Math.sqrt(z))}
function destroyTourMap(){
  if(state.tourMap){try{state.tourMap.remove()}catch{} state.tourMap=null} state.tourUserMarker=null; state.tourProfileMarker=null; state.tourProfileData=null
}
function parseGpx(xml){
  const doc=new DOMParser().parseFromString(xml,"application/xml");
  if(doc.querySelector("parsererror"))throw new Error("GPX konnte nicht gelesen werden.");
  const pts=[...doc.querySelectorAll("trkpt, rtept")].map(p=>({
    lat:Number(p.getAttribute("lat")),
    lon:Number(p.getAttribute("lon")),
    ele:Number(p.querySelector("ele")?.textContent)
  })).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon));
  if(!pts.length)throw new Error("Keine Trackpunkte im GPX gefunden.");
  return pts;
}
function nearestGpxIndex(pts,lat,lon){
  let best=0,bestDist=Infinity;
  pts.forEach((p,i)=>{const d=dist(p.lat,p.lon,lat,lon);if(d<bestDist){bestDist=d;best=i}});
  return best;
}
function slopeColor(percent){
  const a=Math.abs(percent);
  if(a<=5)return "#4f6d53";
  if(a<=12)return "#c7a33a";
  if(a<=20)return "#d47a2f";
  return "#a52d27";
}
function buildTourProfile(pts){
  let total=0;
  const data=pts.map((p,i)=>{
    if(i>0)total+=dist(pts[i-1].lat,pts[i-1].lon,p.lat,p.lon);
    return { ...p, x:total };
  });
  for(let i=0;i<data.length;i++){
    const prev=data[Math.max(0,i-1)], next=data[Math.min(data.length-1,i+1)];
    const dx=Math.max(1,next.x-prev.x), dy=(Number.isFinite(next.ele)&&Number.isFinite(prev.ele))?next.ele-prev.ele:0;
    data[i].grade=Number.isFinite(data[i].ele)&&dx>1?dy/dx*100:0;
  }
  return {points:data,total};
}
function profilePointAtDistance(data,distance){
  const pts=data.points;
  if(!pts.length)return null;
  if(distance<=0)return pts[0];
  if(distance>=data.total)return pts[pts.length-1];
  let lo=0,hi=pts.length-1;
  while(lo<hi){const mid=(lo+hi)>>1;if(pts[mid].x<distance)lo=mid+1;else hi=mid;}
  const b=pts[lo],a=pts[Math.max(0,lo-1)],span=Math.max(1,b.x-a.x),t=(distance-a.x)/span;
  return {lat:a.lat+(b.lat-a.lat)*t,lon:a.lon+(b.lon-a.lon)*t,ele:a.ele+(b.ele-a.ele)*t,x:distance,grade:a.grade+(b.grade-a.grade)*t};
}
function updateProfileMapMarker(point){
  if(!state.tourMap||!point)return;
  if(!state.tourProfileMarker){
    state.tourProfileMarker=L.circleMarker([point.lat,point.lon],{radius:7,color:"#fff",weight:3,fillColor:"#a52d27",fillOpacity:1}).addTo(state.tourMap);
    state.tourProfileMarker.bindTooltip("Tourverlauf");
  }else state.tourProfileMarker.setLatLng([point.lat,point.lon]);
}
function renderElevationProfile(pts){
  const box=$("#elevationProfile"); if(!box)return;
  const valid=pts.filter(p=>Number.isFinite(p.ele));
  if(valid.length<2){box.innerHTML='<div class="elevation-empty">Für diesen GPX-Track liegt kein verwertbares Höhenprofil vor.</div>';return;}
  const data=buildTourProfile(pts); state.tourProfileData=data;
  const values=data.points.filter(p=>Number.isFinite(p.ele));
  const min=Math.min(...values.map(v=>v.ele)),max=Math.max(...values.map(v=>v.ele)),range=Math.max(1,max-min);
  const W=800,H=230,padL=58,padR=14,padT=18,padB=34;
  const xFor=v=>padL+(v.x/Math.max(data.total,1))*(W-padL-padR);
  const yFor=v=>padT+(1-(v.ele-min)/range)*(H-padT-padB);
  const points=values.map(v=>`${xFor(v)},${yFor(v)}`).join(" ");
  const fill=`${padL},${H-padB} ${points} ${W-padR},${H-padB}`;
  const bandHeight=14;
  const slopeBands=[];
  for(let i=1;i<values.length;i++){
    const a=values[i-1],b=values[i];
    const x1=xFor(a),x2=xFor(b),y1=yFor(a),y2=yFor(b);
    const color=slopeColor((a.grade+b.grade)/2);
    slopeBands.push(`<polygon points="${x1},${y1} ${x2},${y2} ${x2},${H-padB} ${x1},${H-padB}" fill="${color}" opacity=".62"/>`);
  }
  box.innerHTML=`<div class="elevation-head"><div><small>HÖHENPROFIL</small><b>Höhenverlauf &amp; Steigung</b></div><span>${Math.round(min)}–${Math.round(max)} m</span></div><div class="elevation-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Höhenprofil von ${Math.round(min)} bis ${Math.round(max)} Meter"><line x1="${padL}" y1="${padT}" x2="${padL}" y2="${H-padB}" class="elev-axis"/><line x1="${padL}" y1="${H-padB}" x2="${W-padR}" y2="${H-padB}" class="elev-axis"/><polygon points="${fill}" class="elev-fill"/><g class="elev-slope-bands">${slopeBands.join("")}</g><polyline points="${points}" class="elev-line" fill="none"/><circle id="elevationCursor" cx="${padL}" cy="${yFor(values[0])}" r="6" class="elev-cursor"/><text x="4" y="${padT+5}" class="elev-label">${Math.round(max)} m</text><text x="4" y="${H-padB+4}" class="elev-label">${Math.round(min)} m</text><text x="${padL}" y="${H-7}" class="elev-label">Start</text><text x="${W-padR}" y="${H-7}" text-anchor="end" class="elev-label">Ziel</text><rect x="${padL}" y="${padT}" width="${W-padL-padR}" height="${H-padT-padB}" class="elev-hit"/></svg></div><div class="elevation-readout" id="elevationReadout">Bewege den Finger oder Mauszeiger über das Profil.</div><div class="slope-legend"><span><i style="background:#4f6d53"></i> bis 5 %</span><span><i style="background:#c7a33a"></i> 5–12 %</span><span><i style="background:#d47a2f"></i> 12–20 %</span><span><i style="background:#a52d27"></i> über 20 %</span></div>`;
  const svg=box.querySelector("svg"), hit=box.querySelector(".elev-hit"), cursor=box.querySelector("#elevationCursor"), readout=box.querySelector("#elevationReadout");
  const update=e=>{
    const rect=svg.getBoundingClientRect();
    const localX=Math.max(padL,Math.min(W-padR,(e.clientX-rect.left)*(W/rect.width)));
    const distance=(localX-padL)/(W-padL-padR)*data.total;
    const point=profilePointAtDistance(data,distance); if(!point)return;
    cursor.setAttribute("cx",xFor(point));cursor.setAttribute("cy",yFor(point));
    const grade=point.grade||0;
    readout.textContent=`${(distance/1000).toFixed(1)} km · ${Math.round(point.ele)} m · ${grade>=0?"↑":"↓"} ${Math.abs(grade).toFixed(0)} %`;
    updateProfileMapMarker(point);
  };
  ["pointermove","pointerdown"].forEach(type=>hit.addEventListener(type,update,{passive:true}));
}
function renderSlopeTrack(pts){
  const data=state.tourProfileData||buildTourProfile(pts); state.tourProfileData=data;
  const segments=[];
  for(let i=1;i<data.points.length;i++){
    const a=data.points[i-1],b=data.points[i];
    if(!Number.isFinite(a.lat)||!Number.isFinite(b.lat))continue;
    segments.push(L.polyline([[a.lat,a.lon],[b.lat,b.lon]],{weight:6,opacity:.9,color:slopeColor((a.grade+b.grade)/2),lineCap:"round",lineJoin:"round",interactive:false}).addTo(state.tourMap));
  }
  return segments;
}
function locateTourMe(){
  if(!state.tourMap||!navigator.geolocation)return toast("GPS wird auf diesem Gerät nicht unterstützt.");
  toast("⌖ Standort wird ermittelt …");
  navigator.geolocation.getCurrentPosition(p=>{
    const lat=p.coords.latitude,lon=p.coords.longitude;
    if(state.tourUserMarker)state.tourUserMarker.setLatLng([lat,lon]);
    else state.tourUserMarker=L.circleMarker([lat,lon],{radius:8,color:"#2f6f9f",weight:3,fillColor:"#2f6f9f",fillOpacity:.95}).addTo(state.tourMap).bindTooltip("Du bist hier");
    state.tourMap.setView([lat,lon],Math.max(state.tourMap.getZoom(),14));
  },()=>toast("Standortzugriff nicht möglich."),{enableHighAccuracy:true,timeout:15000,maximumAge:10000});
}
async function initTourMap(t){
  const box=$("#tourMap");
  if(!box||!window.L)return;
  state.tourMap=L.map(box,{zoomControl:true,scrollWheelZoom:true});
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'© OpenStreetMap-Mitwirkende'}).addTo(state.tourMap);
  try{
    const r=await fetch(`/api/tours/${encodeURIComponent(t.id)}/gpx`,{cache:"force-cache"});
    if(!r.ok)throw new Error("GPX nicht verfügbar");
    const xml=await r.text();
    let pts=parseGpx(xml);
    // Beim Laber beschreibt die Tour den Aufstieg; zurück geht es mit der Laber-Bahn.
    // Der offizielle GPX-Track enthält dagegen Auf- und Abstieg. Deshalb schneiden wir
    // den Track am Zielpunkt ab und zeigen nur den tatsächlich bewanderten Abschnitt.
    if(t.id==="laber"){
      const endIndex=nearestGpxIndex(pts,t.lat,t.lon);
      pts=pts.slice(0,endIndex+1);
      if(pts.length<2)throw new Error("Laber-GPX konnte nicht auf den Aufstieg gekürzt werden.");
    }
    const linePoints=pts.map(p=>[p.lat,p.lon]);
    renderElevationProfile(pts);
    const slopeSegments=renderSlopeTrack(pts);
    const line=L.polyline(linePoints,{weight:1,opacity:0,interactive:false}).addTo(state.tourMap);
    // Auf der Tourkarte markieren wir bewusst nur den Ausgangspunkt.
    // Das eigentliche Ziel ist der Gipfel; ein zweiter Marker am Trackende
    // würde bei Hin-und-zurück-Touren unnötig verwirren.
    L.circleMarker(linePoints[0],{radius:7,color:"#2f6f9f",weight:3,fillColor:"#2f6f9f",fillOpacity:1}).addTo(state.tourMap).bindTooltip("Start");
    state.tourMap.fitBounds(line.getBounds(),{padding:[24,24]});
    $("#tourLocate")?.addEventListener("click",locateTourMe);
    setTimeout(()=>state.tourMap?.invalidateSize(),100);
  }catch(e){
    box.innerHTML='<div class="tour-map-fallback"><b>Tourverlauf aktuell nicht verfügbar</b><span>Die Wegbeschreibung und Tourdaten sind weiterhin verfügbar. Bitte stelle eine Internetverbindung her und öffne die Tour erneut.</span></div>';
    console.warn("Tour-GPX konnte nicht geladen werden",e);
  }
}
function openTour(id){
  const t=state.targets.find(x=>x.id===id);if(!t)return;
  destroyTourMap();
  document.querySelectorAll(".view").forEach(v=>v.classList.add("hidden"));
  $("#view-tour").classList.remove("hidden");
  window.scrollTo({top:0,left:0,behavior:"auto"});
  requestAnimationFrame(()=>window.scrollTo({top:0,left:0,behavior:"auto"}));
  $("#tourTitle").textContent=t.name;
  const collected=state.stamps.some(x=>x.target_id===t.id);
  $("#tourDetail").innerHTML=`<article class="tour-page">
    <div class="tour-hero"><div><span class="pill ${t.level}">${t.levelLabel}</span><h3>${escape(t.name)}</h3><p>${escape(t.height)}</p></div><div class="tour-number">${String(state.targets.indexOf(t)+1).padStart(2,"0")}</div></div>
    <p class="tour-description">${escape(t.description)}</p>
    <div class="tour-stats"><div><b>${escape(t.tour.distance)}</b><span>Distanz</span></div><div><b>${escape(String(t.tour.ascent))} hm</b><span>Aufstieg</span></div><div><b>${escape(t.tour.duration)}</b><span>Gehzeit</span></div></div>
    <div class="tour-map-head"><div><small>TOURVERLAUF</small><b>GPX-Track der offiziellen Tour</b></div><button id="tourLocate" class="tour-locate">⌖ Mein Standort</button></div>
    <div id="tourMap" class="tour-map"><div class="tour-map-loading">Tourverlauf wird geladen …</div></div>
    <div class="tour-map-legend"><span><i class="legend-start"></i> Startpunkt</span><span><i class="legend-track"></i> Tourverlauf · farbig nach Steigung</span><span>⛰️ <b>Stempelziel:</b> ${escape(t.name)}</span></div>
    <div id="elevationProfile" class="elevation-profile"><div class="elevation-empty">Höhenprofil wird geladen …</div></div>
    <div class="tour-info"><small>STARTPUNKT</small><b>${escape(t.tour.start)}</b><p>${escape(t.tour.summary)}</p></div>
    ${t.level==="hard"?`<div class="tour-warning"><b>⚠️ Anspruchsvolle Tour</b><span>Bitte beachte die Hinweise zur erforderlichen Trittsicherheit, Schwindelfreiheit und alpinen Erfahrung in der Tourbeschreibung.</span></div>`:""}
    <details class="way-description" open><summary>🥾 Wegbeschreibung</summary><div>${escape(t.tour.wayDescription||"Für diese Tour liegt derzeit keine separate Wegbeschreibung vor.")}</div></details>
    <div class="tour-actions"><button class="gps" type="button" data-tour-action="book">📖 Gipfelbuch ansehen</button>${collected?`<button class="entry-cta" type="button" data-tour-action="entry">✎ Eintrag schreiben</button>`:""}</div>
    <p class="tour-source">Tourendaten, Wegverlauf und Tourenvorschlag basieren auf der ausgewählten offiziellen Tour der Ammergauer Alpen.</p>
  </article>`;
  const tourActions=document.querySelector("#tourDetail");
  tourActions.querySelector('[data-tour-action="book"]')?.addEventListener("click",()=>openBook(t.id));
  tourActions.querySelector('[data-tour-action="entry"]')?.addEventListener("click",()=>openEntry(t.id));
  initTourMap(t);
}
function openEntry(targetId=""){if(!state.user)return toast("Bitte zuerst ein Profil anlegen.");const collected=new Set(state.stamps.map(x=>x.target_id));if(targetId&&!collected.has(targetId))return toast("Für dieses Ziel kannst Du erst nach dem Stempel einen Eintrag schreiben.");const ids=state.targets.filter(t=>collected.has(t.id));if(!ids.length)return toast("Sammle zuerst einen Stempel, bevor Du einen Eintrag schreibst.");$("#entryTarget").innerHTML=ids.map(t=>`<option value="${t.id}" ${t.id===targetId?"selected":""}>${escape(t.name)}</option>`).join("");$("#entryText").value="";$("#modal").classList.remove("hidden")}
function showCheckin(t){if(!$("#checkinModal"))return;$("#checkinTitle").textContent=`${t.name} erreicht!`;$("#checkinModal").dataset.target=t.id;$("#checkinModal").classList.remove("hidden")}
function showPendingMilestone(){
  if(!state.pendingMilestone)return;
  const pending=state.pendingMilestone;
  const open=()=>{
    if(!document.querySelector("#checkinModal")?.classList.contains("hidden"))return;
    if(milestone(pending.count)) state.pendingMilestone=null;
  };
  setTimeout(open,260);
}
function closeCheckin(showNext=true){
  $("#checkinModal")?.classList.add("hidden");
  if(showNext)showPendingMilestone();
}
function openBook(target=""){document.querySelector('[data-tab="book"]').click();$("#bookFilter").value=target;loadBook(target)}
async function loadBook(target=""){try{const rows=await api("/api/guestbook"+(target?`?targetId=${encodeURIComponent(target)}`:""));$("#entries").innerHTML=rows.length?rows.map(e=>{const t=state.targets.find(x=>x.id===e.target_id);return `<article class="entry"><div><b>${escape(e.nickname)}</b><span>${t?.name||e.target_id}</span></div><p>${escape(e.text)}</p><small>${new Date(e.created_at).toLocaleString("de-DE")}</small></article>`}).join(""):"<div class='empty'>Noch keine Einträge. Sei der Erste!</div>"}catch{$("#entries").innerHTML="<div class='empty'>Gipfelbuch ist offline. Bereits geladene Inhalte bleiben verfügbar.</div>"}}
function escape(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function targetNumber(t){return String(state.targets.indexOf(t)+1).padStart(2,"0")}
function leafletTargetMarker(t){
  const collected=state.stamps.some(x=>x.target_id===t.id);
  const icon=L.divIcon({
    className:"gp-map-marker-wrap",
    html:`<div class="gp-map-marker${collected?" gp-map-marker-collected":""}" title="${escape(t.name)}">${collected?`<img src="/assets/naturpark-berg-symbol.png" alt=""><span class="gp-map-marker-number">${targetNumber(t)}</span>`:`<span>${targetNumber(t)}</span>`}</div>`,
    iconSize:[44,44],
    iconAnchor:[22,22],
    popupAnchor:[0,-26]
  });
  return L.marker([t.lat,t.lon],{icon,title:t.name});
}
function mapLibreTargetElement(t){
  const collected=state.stamps.some(x=>x.target_id===t.id);
  const el=document.createElement("div");
  el.className=`gp-map-marker${collected?" gp-map-marker-collected":""}`;
  el.style.cssText="width:44px;height:44px;min-width:44px;min-height:44px;border-radius:50%;background:"+(collected?"#4f6d53":"#a52d27")+";border:3px solid #fff;box-shadow:0 2px 8px #0006;color:#fff;display:grid;place-items:center;font:900 15px/1 system-ui,sans-serif;cursor:pointer;text-align:center;position:relative;";
  el.innerHTML=collected?`<img class="gp-map-marker-mountain" src="/assets/naturpark-berg-symbol.png" alt=""><span class="gp-map-marker-number">${targetNumber(t)}</span>`:`<span>${targetNumber(t)}</span>`;
  el.setAttribute("aria-label",t.name+(collected?" – Stempel gesammelt":""));
  el.title=t.name+(collected?" – Stempel gesammelt":"");
  return el;
}
function clearOverviewTrack(){
  if(state.maplibre && state.map){
    try{if(state.map.getLayer("overview-gpx-track"))state.map.removeLayer("overview-gpx-track");}catch{}
    try{if(state.map.getSource("overview-gpx-track"))state.map.removeSource("overview-gpx-track");}catch{}
  }else if(state.map && window.L){
    state.overviewTrackLayers.forEach(layer=>{try{state.map.removeLayer(layer)}catch{}});
  }
  state.overviewTrackLayers=[];
  state.overviewTrackTarget=null;
}
function setOverviewTrack(target,opts={}){
  if(!state.map||!target||target.lat===null||target.lon===null)return;
  const pinned=opts.pinned===true;
  if(state.overviewTrackTarget===target.id && state.overviewTrackLayers.length){
    state.overviewTrackPinned=state.overviewTrackPinned||pinned;
    return;
  }
  clearOverviewTrack();
  state.overviewTrackPinned=pinned;
  state.overviewTrackTarget=target.id;
  fetchTourGpx(target.id).then(xml=>{
    if(state.overviewTrackTarget!==target.id || !state.map)return;
    const pts=parseGpx(xml);
    if(state.maplibre){
      const coordinates=pts.map(p=>[p.lon,p.lat]);
      state.map.addSource("overview-gpx-track",{type:"geojson",data:{type:"Feature",geometry:{type:"LineString",coordinates}}});
      state.map.addLayer({id:"overview-gpx-track",type:"line",source:"overview-gpx-track",layout:{"line-join":"round","line-cap":"round"},paint:{"line-color":"#4f6d53","line-width":5,"line-opacity":.82}});
      state.overviewTrackLayers=["overview-gpx-track"];
    }else{
      const line=L.polyline(pts.map(p=>[p.lat,p.lon]),{color:"#4f6d53",weight:5,opacity:.82,lineCap:"round",lineJoin:"round",interactive:false}).addTo(state.map);
      state.overviewTrackLayers=[line];
    }
  }).catch(()=>{
    if(state.overviewTrackTarget===target.id)state.overviewTrackTarget=null;
  });
}
function bindOverviewMarkerInteractions(marker,t){
  if(!marker)return marker;
  if(state.maplibre){
    const el=marker.getElement();
    if(el){
      el.addEventListener("mouseenter",()=>setOverviewTrack(t));
      el.addEventListener("mouseleave",()=>{if(!state.overviewTrackPinned && state.overviewTrackTarget===t.id)clearOverviewTrack()});
      el.addEventListener("click",()=>{state.overviewTrackPinned=true;setOverviewTrack(t,{pinned:true})});
    }
  }else if(window.L){
    marker.on("mouseover",()=>setOverviewTrack(t));
    marker.on("mouseout",()=>{if(!state.overviewTrackPinned && state.overviewTrackTarget===t.id)clearOverviewTrack()});
    marker.on("click",()=>{state.overviewTrackPinned=true;setOverviewTrack(t,{pinned:true})});
  }
  return marker;
}
function refreshMapMarkers(){
  if(!state.map)return;
  clearOverviewTrack();
  state.overviewTrackPinned=false;
  if(state.maplibre){
    state.markers.forEach(m=>m.remove());
    state.markers=state.targets.map(t=>{const m=new maplibregl.Marker({element:mapLibreTargetElement(t),anchor:"bottom"}).setLngLat([t.lon,t.lat]).setPopup(new maplibregl.Popup({offset:32}).setHTML(targetPopup(t))).addTo(state.map);bindTargetPopupActions(m,t);return bindOverviewMarkerInteractions(m,t)});
  }else if(window.L){
    state.markers.forEach(m=>state.map.removeLayer(m));
    state.markers=state.targets.map(t=>{const m=leafletTargetMarker(t).addTo(state.map).bindPopup(targetPopup(t));bindTargetPopupActions(m,t);return bindOverviewMarkerInteractions(m,t)});
  }
}
async function fetchTourGpx(id){
  const req=new Request(`/api/tours/${encodeURIComponent(id)}/gpx`);
  try{
    const cache=await caches.open("gp-cache-v63");
    const cached=await cache.match(req);
    if(cached){const xml=await cached.text();if(xml.includes("<gpx")||xml.includes(":gpx"))return xml;}
  }catch{}
  const r=await fetch(req,{cache:"force-cache"});
  if(!r.ok)throw new Error("GPX nicht verfügbar");
  const xml=await r.text();
  try{const cache=await caches.open("gp-cache-v63");await cache.put(req,new Response(xml,{headers:{"Content-Type":"application/gpx+xml"}}))}catch{}
  return xml;
}
function targetPopup(t){
  return `<div class="map-popup"><b>${escape(t.name)}</b><span>${escape(t.height)} · ${escape(t.levelLabel)}</span><button type="button" class="map-popup-button" data-map-action="tour" data-target-id="${escape(t.id)}">🥾 Tour ansehen</button><button type="button" class="map-popup-button map-popup-secondary" data-map-action="book" data-target-id="${escape(t.id)}">📖 Gipfelbuch ansehen</button></div>`;
}
function bindTargetPopupActions(marker,t){
  const bindRoot=root=>{
    if(!root)return;
    root.querySelector('[data-map-action="tour"]')?.addEventListener('click',()=>openTour(t.id));
    root.querySelector('[data-map-action="book"]')?.addEventListener('click',()=>openBook(t.id));
  };
  if(state.maplibre){
    const popup=marker?.getPopup?.();
    popup?.on('open',()=>bindRoot(popup.getElement()));
  }else if(marker&&window.L){
    marker.on('popupopen',e=>bindRoot(e.popup.getElement()));
  }
  return marker;
}
async function initMap(){
  if(state.map||!window.L)return;
  const mapUrl="/maps/ammergauer-alpen.pmtiles";
  let hasOffline=false;
  try{hasOffline=(await fetch(mapUrl,{method:"HEAD",cache:"no-store"})).ok}catch{}
  if(hasOffline && window.maplibregl && window.pmtiles && window.basemaps){
    try{
      const protocol=new pmtiles.Protocol();
      maplibregl.addProtocol("pmtiles",protocol.tile);
      const map=new maplibregl.Map({
        container:"map",center:[11.00,47.58],zoom:11.8,
        style:{version:8,glyphs:"https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",sprite:"https://protomaps.github.io/basemaps-assets/sprites/v4/light",sources:{protomaps:{type:"vector",url:"pmtiles://"+location.origin+mapUrl,attribution:'© OpenStreetMap-Mitwirkende'}},layers:basemaps.layers("protomaps",basemaps.namedFlavor("light"),{lang:"de"})}
      });
      state.map=map;state.maplibre=true;
      map.addControl(new maplibregl.NavigationControl(),"top-left");
      state.markers=state.targets.map(t=>{const m=new maplibregl.Marker({element:mapLibreTargetElement(t),anchor:"bottom"}).setLngLat([t.lon,t.lat]).setPopup(new maplibregl.Popup({offset:32}).setHTML(targetPopup(t))).addTo(map);bindTargetPopupActions(m,t);return bindOverviewMarkerInteractions(m,t)});
      map.fitBounds([[Math.min(...state.targets.map(t=>t.lon)),Math.min(...state.targets.map(t=>t.lat))],[Math.max(...state.targets.map(t=>t.lon)),Math.max(...state.targets.map(t=>t.lat))]],{padding:35});
      $(".map-actions .muted").textContent="Offline-Karte bereit";
      renderMapList();
      $("#locateMe").onclick=locateMe;
      return;
    }catch(e){console.warn("Offline-Map konnte nicht geladen werden",e)}
  }
  state.map=L.map("map",{zoomControl:true}).setView([47.58,11.00],12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'© OpenStreetMap-Mitwirkende'}).addTo(state.map);
  state.targets.forEach(t=>{const m=leafletTargetMarker(t).addTo(state.map).bindPopup(targetPopup(t));bindTargetPopupActions(m,t);state.markers.push(bindOverviewMarkerInteractions(m,t))});
  const bounds=L.latLngBounds(state.targets.map(t=>[t.lat,t.lon]));state.map.fitBounds(bounds.pad(.08));
  updateMapStatus();
  renderMapList();
  $("#locateMe").onclick=locateMe;
}
function renderMapList(){
  const list=$("#mapList");
  if(!list)return;
  list.innerHTML=state.targets.map(t=>`<button type="button" class="map-item" data-focus-target="${escape(t.id)}" aria-label="Stempelziel ${targetNumber(t)}: ${escape(t.name)}"><span class="map-item-number">${targetNumber(t)}</span><span class="map-item-name"><b>${escape(t.name)}</b><small>${escape(t.height)}</small></span><span class="map-item-arrow">›</span></button>`).join("");
  list.querySelectorAll("[data-focus-target]").forEach(btn=>btn.addEventListener("click",()=>focusTarget(btn.dataset.focusTarget)));
}
function updateMapStatus(){
  const status=$(".map-actions .muted");
  const mapBox=$("#map");
  let note=mapBox.querySelector(".map-offline-note");
  if(!navigator.onLine){
    if(status)status.textContent="";
    if(!note){note=document.createElement("div");note.className="map-offline-note";mapBox.appendChild(note);}
    note.innerHTML="<b>Karte aktuell nicht verfügbar</b><span>Es besteht keine Internetverbindung. Deine GPS-Stempel funktionieren trotzdem.</span>";
    note.classList.add("show");
  }else{
    if(status)status.textContent="";
    if(note)note.classList.remove("show");
  }
}
function locateMe(){if(!navigator.geolocation)return toast("GPS wird auf diesem Gerät nicht unterstützt.");navigator.geolocation.getCurrentPosition(p=>{const lat=p.coords.latitude,lon=p.coords.longitude;if(state.maplibre){state.map.flyTo({center:[lon,lat],zoom:14});if(state.userMarker)state.userMarker.setLngLat([lon,lat]);else state.userMarker=new maplibregl.Marker({color:"#a52d27"}).setLngLat([lon,lat]).setPopup(new maplibregl.Popup().setText("Du bist hier")).addTo(state.map);return}state.map.setView([lat,lon],14);if(state.userMarker)state.userMarker.setLatLng([lat,lon]);else state.userMarker=L.circleMarker([lat,lon],{radius:8,weight:3,fillOpacity:.9}).addTo(state.map).bindPopup("Du bist hier").openPopup()},()=>toast("Standortzugriff nicht möglich."),{enableHighAccuracy:true,timeout:15000,maximumAge:10000})}
function focusTarget(id){const t=state.targets.find(x=>x.id===id);if(!t||!state.map)return;const index=state.targets.indexOf(t);const m=state.markers[index];setOverviewTrack(t,{pinned:true});state.overviewTrackPinned=true;const mapEl=$("#map");if(mapEl)mapEl.scrollIntoView({behavior:"smooth",block:"nearest"});if(state.maplibre){state.map.flyTo({center:[t.lon,t.lat],zoom:15});if(m){setTimeout(()=>{try{m.togglePopup()}catch{try{m.getPopup()?.addTo(state.map)}catch{}}},220)}return}state.map.setView([t.lat,t.lon],15,{animate:true});if(m)setTimeout(()=>{try{m.openPopup()}catch{}},120)}
window.focusTarget=focusTarget;window.openBook=openBook;window.openTour=openTour;window.openEntry=openEntry;
function setupBook(){const f=$("#bookFilter");f.innerHTML='<option value="">Alle Einträge</option>'+state.targets.map(t=>`<option value="${t.id}">${t.name}</option>`).join("");f.onchange=()=>loadBook(f.value);loadBook()}
function renderTrophies(){
  const modal=$("#trophyModal"), ms=$("#trophyMilestones"), ss=$("#trophySummits");
  if(!modal||!ms||!ss)return;
  const validIds=new Set(state.targets.map(t=>t.id));
  const collected=new Set(state.stamps.filter(x=>validIds.has(x.target_id)).map(x=>x.target_id));
  const count=collected.size;
  const tiers=[
    {n:3,label:"Wanderwarzi",sub:"ab 3 Wanderzielen",img:"/assets/warzi-star-badge.png?v=66",kids:true,done:count>=3},
    {n:5,label:"Bronzene Wandernadel",sub:"ab 5 Wanderzielen",medal:"bronze",done:count>=5},
    {n:10,label:"Silberne Wandernadel",sub:"ab 10 Wanderzielen",medal:"silver",done:count>=10},
    {n:12,label:"Goldene Wandernadel",sub:"Alle 12 Wanderziele",medal:"gold",done:count>=12}
  ];
  ms.innerHTML=tiers.map(t=>`<article class="trophy-card ${t.done?"unlocked":"locked"}"><div class="trophy-icon">${t.img?`<img src="${t.img}" alt="${t.label}">`:`<span class="medal-icon ${t.medal||""}" aria-hidden="true"></span>`}</div><div><b>${t.label}</b><small>${t.done?"✓ Erreicht":t.sub}</small></div></article>`).join("");
  ss.innerHTML=state.targets.map((t,i)=>`<button type="button" class="summit-trophy ${collected.has(t.id)?"unlocked":"locked"}" data-trophy-target="${t.id}"><span class="summit-number">${String(i+1).padStart(2,"0")}</span><span class="summit-icon">🏔️</span><span class="summit-name"><b>${t.name}</b><small>${collected.has(t.id)?"✓ Gesammelt":"Noch offen"}</small></span></button>`).join("");
  ss.querySelectorAll("[data-trophy-target]").forEach(b=>b.onclick=()=>{modal.classList.add("hidden");openTour(b.dataset.trophyTarget)});
}
function openTrophies(){
  const modal=$("#trophyModal"); if(!modal)return;
  renderTrophies(); modal.classList.remove("hidden");
}
function setupProfile(){
  if(state.user){
    const hasCode=Boolean(state.user.recoveryCode);
    $("#profileName").textContent=state.user.nickname;
    $("#profileHint").textContent="Dein Wanderpass ist auf diesem Gerät aktiv.";
    $("#profileForm").innerHTML=`
      <button id="openTrophies" class="trophy-open">🏆 Meine Trophäen</button>
      <div class="secure-box">
        <b>Wanderpass sichern</b>
        <p><b>Wichtig:</b> Der Sicherungscode ist dein persönlicher Schlüssel zur Wiederherstellung. Wenn du ausgeloggt wirst oder das Gerät wechselst, brauchst du ihn, damit deine gesammelten Stempel und Gipfelbuch-Einträge wieder mit deinem Wanderpass verbunden werden können. Bitte außerhalb der App sicher aufbewahren und nicht weitergeben.</p>
        ${hasCode
          ? `<button id="showRecovery">Sicherungscode anzeigen</button>
             <div id="recoveryBox" class="recovery hidden"></div>
             <button id="copyRecovery" class="secondary hidden">Code kopieren</button>`
          : `<div class="notice">Für dieses Profil ist auf diesem Gerät kein Sicherungscode gespeichert. Aus Sicherheitsgründen kann der Server den Code nicht erneut anzeigen.</div>`}
      </div>
      <button id="logout" class="secondary">Auf diesem Gerät abmelden</button>`;
    if(hasCode){
      const show=()=>{
        const box=$("#recoveryBox"), copy=$("#copyRecovery");
        box.textContent=state.user.recoveryCode;
        box.classList.remove("hidden");
        copy.classList.remove("hidden");
      };
      $("#showRecovery").onclick=show;
      $("#copyRecovery").onclick=async()=>{
        try{await navigator.clipboard.writeText(state.user.recoveryCode);toast("Sicherungscode kopiert.")}
        catch{toast("Kopieren nicht möglich – bitte den Code manuell übernehmen.")}
      };
    }
    $("#logout").onclick=async()=>{try{await api("/api/logout",{method:"POST"})}catch{} localStorage.removeItem("gp.user");state.user=null;setupProfile()};
    return;
  }

  $("#profileName").textContent="Noch kein Profil";
  $("#profileHint").textContent="Lege einen Spitznamen an. Danach bekommst du einmalig einen Sicherungscode für die Wiederherstellung.";
  $("#profileForm").innerHTML=`
    <div class="secure-box">
      <b>Neues Profil</b>
      <p><b>Wichtig:</b> Der Sicherungscode wird nur bei der Erstellung angezeigt. Du brauchst ihn später zur Wiederherstellung deines Wanderpasses. Der Sicherungscode wird dir angezeigt, nachdem du das Profil angelegt hast. Speichere den Code an einem sicheren Ort.</p>
      <input id="nickname" maxlength="24" autocomplete="nickname" placeholder="Dein Berg-Spitzname">
      <button id="createProfile">Profil anlegen</button>
      <div id="newCodeBox" class="hidden">
        <div class="notice success">Profil angelegt. Bitte sichere den Code, bevor du die Seite verlässt.</div>
        <div id="newRecoveryCode" class="recovery"></div>
        <button id="copyNewCode" class="secondary">Code kopieren</button>
        <button id="finishProfile">Ich habe den Code sicher gespeichert</button>
      </div>
    </div>
    <div class="divider">oder vorhandenen Wanderpass wiederherstellen</div>
    <div class="secure-box">
      <p>Gib deinen Spitznamen und den persönlichen Sicherungscode ein.</p>
      <input id="recoverNickname" maxlength="24" autocomplete="username" placeholder="Spitzname">
      <input id="recoverCode" maxlength="14" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" placeholder="z. B. A1B2-C3D4-E5F6">
      <button id="recoverProfile" class="secondary">Wanderpass wiederherstellen</button>
      <div id="recoverStatus" class="form-status" aria-live="polite"></div>
    </div>`;

  $("#createProfile").onclick=async()=>{
    const button=$("#createProfile");
    button.disabled=true;
    try{
      state.user=await api("/api/users",{method:"POST",body:JSON.stringify({nickname:$("#nickname").value})});
      const code=state.user.recoveryCode;
      saveUser();
      $("#newRecoveryCode").textContent=code;
      $("#newCodeBox").classList.remove("hidden");
      $("#nickname").disabled=true;
      button.classList.add("hidden");
      $("#copyNewCode").onclick=async()=>{
        try{await navigator.clipboard.writeText(code);toast("Sicherungscode kopiert.")}
        catch{toast("Kopieren nicht möglich – bitte den Code manuell übernehmen.")}
      };
      $("#finishProfile").onclick=()=>{setupProfile();toast("Profil ist bereit.")};
    }catch(e){toast(e.message);button.disabled=false}
  };

  $("#recoverProfile").onclick=async()=>{
    const button=$("#recoverProfile"), status=$("#recoverStatus");
    button.disabled=true; status.textContent="Wiederherstellung wird geprüft …";
    try{
      const nickname=$("#recoverNickname").value;
      const recoveryCode=$("#recoverCode").value.replace(/[\s-]/g,"").toUpperCase();
      state.user=await api("/api/recover",{method:"POST",body:JSON.stringify({nickname,recoveryCode})});
      saveUser();
      await refresh();
      setupProfile();
      toast("Wanderpass erfolgreich wiederhergestellt.");
    }catch(e){
      status.textContent=e.message;
      button.disabled=false;
    }
  };
}
document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".view").forEach(v=>v.classList.add("hidden"));$("#view-"+b.dataset.tab).classList.remove("hidden");if(b.dataset.tab==="book")loadBook($("#bookFilter").value);if(b.dataset.tab==="map"){setTimeout(()=>{initMap();state.map?.invalidateSize()},50)}if(b.dataset.tab==="profile")setupProfile()});
$("#newEntry").onclick=()=>openEntry();$(".close").onclick=()=>{$("#modal").classList.add("hidden");showPendingMilestone()};$("#saveEntry").onclick=async()=>{try{await api("/api/guestbook",{method:"POST",body:JSON.stringify({targetId:$("#entryTarget").value,text:$("#entryText").value})});$("#entryText").value="";$("#modal").classList.add("hidden");await loadBook($("#bookFilter").value);toast("Eintrag veröffentlicht.");showPendingMilestone()}catch(e){toast(e.message)}};$("#tourBack").onclick=()=>{document.querySelectorAll(".view").forEach(v=>v.classList.add("hidden"));$("#view-pass").classList.remove("hidden")};$("#closeCheckin").onclick=closeCheckin;$("#checkinLater").onclick=closeCheckin;$("#checkinBook").onclick=()=>{const id=$("#checkinModal").dataset.target;closeCheckin(false);openEntry(id)};
async function refresh(){const me=await api("/api/me");state.isTestMode=me.testMode===true;if(me.user){state.user={...state.user,...me.user};saveUser();}state.stamps=me.stamps;renderPass()}
async function prefetchTourTracks(){if(!navigator.onLine||!state.targets.length)return;try{const cache=await caches.open("gp-cache-v63");for(const t of state.targets){const req=new Request(`/api/tours/${encodeURIComponent(t.id)}/gpx`);if(await cache.match(req))continue;try{const r=await fetch(req,{cache:"no-cache"});if(r.ok)await cache.put(req,r.clone())}catch{}}}catch{}}
document.addEventListener("click",e=>{if(e.target.closest("#openTrophies"))openTrophies();if(e.target.id==="closeTrophies"||e.target.id==="trophyModal")$("#trophyModal").classList.add("hidden")});
window.addEventListener("online",()=>{syncQueue();updateMapStatus();renderSyncStatus()});window.addEventListener("offline",()=>{updateMapStatus();renderSyncStatus()});document.addEventListener("click",e=>{if(e.target.id==="closeMilestone"||e.target.id==="milestoneOk")$("#milestoneModal").classList.add("hidden")});
async function boot(){loadUser();try{state.targets=await api("/api/targets")}catch{try{state.targets=await fetch("/data.json",{cache:"force-cache"}).then(r=>r.json())}catch{state.targets=[]}}setupBook();setupProfile();if(state.user){try{await refresh();await syncQueue()}catch(e){if(e.status===401){localStorage.removeItem("gp.user");state.user=null;setupProfile();renderPass();toast("Deine Sitzung ist abgelaufen. Stelle den Wanderpass mit deinem Sicherungscode wieder her.")}else{renderPass();toast("Server gerade nicht erreichbar. Offline-Modus aktiv.")}}}else renderPass();prefetchTourTracks()}
boot();
if("serviceWorker" in navigator) window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js?v=64").catch(()=>{}));
