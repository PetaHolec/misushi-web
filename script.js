(function(){
  const header=document.getElementById('header'), mbar=document.getElementById('mbar');
  const solid=header && header.classList.contains('solid');
  const onScroll=()=>{
    const y=window.scrollY;
    if(header) header.classList.toggle('scrolled', solid || y>40);
    if(mbar) mbar.classList.toggle('show', y>window.innerHeight*(solid?0.25:0.6));
  };
  onScroll(); window.addEventListener('scroll', onScroll, {passive:true});

  // Mobile menu
  const burger=document.getElementById('burger'), mm=document.getElementById('mobileMenu');
  const toggle=(open)=>{
    document.body.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', open); mm.setAttribute('aria-hidden', !open);
  };
  if(burger && mm){
    burger.addEventListener('click', ()=>toggle(!document.body.classList.contains('menu-open')));
    mm.querySelectorAll('a').forEach(a=>a.addEventListener('click', ()=>toggle(false)));
  }

  // Open now (Prague time)
  try{
    const now=new Date(new Date().toLocaleString('en-US',{timeZone:'Europe/Prague'}));
    const m=now.getHours()*60+now.getMinutes(), open=m>=630 && m<1350;
    document.querySelectorAll('#openNow,[data-open-now]').forEach(el=>{
      el.textContent=open?'Nyní otevřeno':'Nyní zavřeno'; el.classList.toggle('closed', !open);
    });
    const row=document.querySelector('#hours tr[data-d="'+now.getDay()+'"]'); row && row.classList.add('today');
  }catch(e){}

  // Reveal on scroll
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.12});
  document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

  // Review dots
  const track=document.getElementById('revTrack'), dots=[...document.querySelectorAll('#revDots i')];
  if(track) track.addEventListener('scroll', ()=>{
    const cards=[...track.children]; const w=cards[0].offsetWidth+14;
    const i=Math.min(cards.length-1, Math.round(track.scrollLeft/w));
    dots.forEach((d,j)=>d.classList.toggle('on', j===i));
  }, {passive:true});
})();

// Lightbox – zvětšení fotek, swipe, pinch/klepnutí pro zoom
(function(){
  const lb=document.getElementById('lb'); if(!lb) return;
  const img=lb.querySelector('.lb-img'), stage=lb.querySelector('.lb-stage'),
        capEl=lb.querySelector('.lb-cap span'), count=lb.querySelector('.lb-count'),
        hint=lb.querySelector('.lb-cap small'), MAX=4;
  let items=[], idx=0, scale=1, tx=0, ty=0, lastFocus=null, g=null;
  const pts=new Map();
  const isTouch=matchMedia('(pointer:coarse)').matches;
  hint.textContent=isTouch?'Klepnutím přiblížíte · přejetím listujete':'Kliknutím přiblížíte · šipkami listujete';

  const srcOf=el=>el.dataset.full||el.getAttribute('href')||(el.querySelector('img')||{}).src;
  const capOf=el=>{const c=el.dataset.caption||(el.querySelector('img')||{}).alt||'';const t=document.createElement('textarea');t.innerHTML=c;return t.value};
  const apply=anim=>{
    img.style.transition=anim?'transform .32s cubic-bezier(.2,.8,.2,1), opacity .25s':'opacity .25s';
    img.style.transform='translate3d('+tx+'px,'+ty+'px,0) scale('+scale+')';
    lb.classList.toggle('zoomed',scale>1.01);
  };
  const reset=anim=>{scale=1;tx=0;ty=0;apply(anim)};
  const clamp=()=>{
    const w=img.offsetWidth*scale,h=img.offsetHeight*scale;
    const mx=Math.max(0,(w-innerWidth)/2), my=Math.max(0,(h-innerHeight)/2);
    tx=Math.max(-mx,Math.min(mx,tx)); ty=Math.max(-my,Math.min(my,ty));
  };
  const base=()=>{const r=img.getBoundingClientRect();return{s:scale,tx:tx,ty:ty,cx:r.left+r.width/2-tx,cy:r.top+r.height/2-ty}};
  const zoomAt=(px,py,s,b)=>{
    const lx=(px-b.cx-b.tx)/b.s, ly=(py-b.cy-b.ty)/b.s;
    scale=s; tx=px-b.cx-lx*s; ty=py-b.cy-ly*s; clamp();
  };

  const show=i=>{
    idx=(i+items.length)%items.length;
    const el=items[idx], src=srcOf(el), th=el.querySelector('img');
    reset(false);
    if(th&&th.currentSrc){img.src=th.currentSrc;img.style.opacity=1}else{img.style.opacity=0}
    img.alt=capOf(el); capEl.textContent=capOf(el);
    count.innerHTML='<b>'+String(idx+1).padStart(2,'0')+'</b> / '+String(items.length).padStart(2,'0');
    const pre=new Image();
    pre.onload=()=>{if(items[idx]===el){img.src=src;img.style.opacity=1}};
    pre.onerror=()=>{if(items[idx]===el)img.style.opacity=1};
    pre.src=src;
    [1,-1].forEach(d=>{const n=items[(idx+d+items.length)%items.length];if(n&&n!==el){const p=new Image();p.src=srcOf(n)}});
  };
  const open=(group,el)=>{
    items=[...document.querySelectorAll('[data-lb="'+group+'"]')].filter(x=>!x.hidden);
    if(!items.length) return;
    lastFocus=document.activeElement;
    lb.classList.toggle('single',items.length<2);
    lb.hidden=false; void lb.offsetWidth;
    show(Math.max(0,items.indexOf(el)));
    lb.classList.add('open');
    document.documentElement.classList.add('lb-lock');
    lb.querySelector('.lb-close').focus({preventScroll:true});
  };
  const close=()=>{
    lb.classList.remove('open'); lb.style.removeProperty('--fade');
    document.documentElement.classList.remove('lb-lock');
    setTimeout(()=>{if(!lb.classList.contains('open')){lb.hidden=true;img.removeAttribute('src')}},300);
    if(lastFocus) lastFocus.focus({preventScroll:true});
  };
  const swipeTo=d=>{
    if(items.length<2){reset(true);return}
    tx=-d*innerWidth*.6; img.style.opacity=0; apply(true);
    setTimeout(()=>show(idx+d),170);
  };

  document.addEventListener('click',e=>{
    const c=e.target.closest('[data-lb-clone]');
    if(c){
      const [grp,i]=c.dataset.lbClone.split(':'); const orig=document.querySelectorAll('[data-lb="'+grp+'"]')[+i];
      if(orig){e.preventDefault();open(grp,orig)} return;
    }
    const el=e.target.closest('[data-lb]'); if(!el||lb.contains(el)) return;
    e.preventDefault(); open(el.dataset.lb,el);
  });
  document.addEventListener('keydown',e=>{
    if(lb.hidden){
      const el=e.target.closest&&e.target.closest('[data-lb][role="button"]');
      if(el&&(e.key==='Enter'||e.key===' ')){e.preventDefault();open(el.dataset.lb,el)}
      return;
    }
    if(e.key==='Escape') close();
    else if(e.key==='ArrowRight') show(idx+1);
    else if(e.key==='ArrowLeft') show(idx-1);
    else if(e.key==='Tab'){
      const f=[...lb.querySelectorAll('button')].filter(b=>getComputedStyle(b).visibility!=='hidden'&&b.offsetParent);
      const i=f.indexOf(document.activeElement); e.preventDefault();
      f[(i+(e.shiftKey?-1:1)+f.length)%f.length].focus();
    }
  });
  lb.querySelector('.lb-close').addEventListener('click',close);
  lb.querySelector('.lb-prev').addEventListener('click',()=>show(idx-1));
  lb.querySelector('.lb-next').addEventListener('click',()=>show(idx+1));
  addEventListener('resize',()=>{if(!lb.hidden)reset(false)});

  stage.addEventListener('wheel',e=>{
    e.preventDefault();
    const s=Math.max(1,Math.min(MAX,scale*(e.deltaY<0?1.15:1/1.15)));
    zoomAt(e.clientX,e.clientY,s,base()); apply(false);
  },{passive:false});

  stage.addEventListener('pointerdown',e=>{
    try{stage.setPointerCapture(e.pointerId)}catch(_){}
    pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pts.size===1){g={type:'pan',x0:e.clientX,y0:e.clientY,tx0:tx,ty0:ty,moved:false,axis:null,onImg:e.target===img}}
    else if(pts.size===2){const [a,b]=[...pts.values()];g={type:'pinch',d0:Math.hypot(a.x-b.x,a.y-b.y)||1,b:base()}}
  });
  stage.addEventListener('pointermove',e=>{
    if(!pts.has(e.pointerId)||!g) return;
    pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(g.type==='pinch'){
      if(pts.size<2) return;
      const [a,b]=[...pts.values()], d=Math.hypot(a.x-b.x,a.y-b.y);
      zoomAt((a.x+b.x)/2,(a.y+b.y)/2,Math.max(1,Math.min(MAX,g.b.s*d/g.d0)),g.b); apply(false); return;
    }
    const dx=e.clientX-g.x0, dy=e.clientY-g.y0;
    if(!g.moved&&Math.abs(dx)+Math.abs(dy)>8){g.moved=true;g.axis=Math.abs(dx)>=Math.abs(dy)?'x':'y'}
    if(!g.moved) return;
    if(scale>1.01){tx=g.tx0+dx;ty=g.ty0+dy;clamp();apply(false)}
    else if(g.axis==='x'){tx=dx;ty=0;apply(false)}
    else{tx=0;ty=Math.max(0,dy);apply(false);lb.style.setProperty('--fade',String(Math.max(.3,1-ty/350)))}
  });
  const end=e=>{
    if(!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if(!g) return;
    if(g.type==='pinch'){
      if(pts.size===1){const [p]=[...pts.values()];g={type:'pan',x0:p.x,y0:p.y,tx0:tx,ty0:ty,moved:true,axis:'x'}}
      else if(pts.size===0){if(scale<1.05)reset(true);g=null}
      return;
    }
    if(pts.size) return;
    const dx=e.clientX-g.x0, dy=e.clientY-g.y0;
    if(scale>1.01){ if(!g.moved) reset(true) }
    else if(g.moved){
      lb.style.removeProperty('--fade');
      if(g.axis==='x'&&Math.abs(dx)>60) swipeTo(dx<0?1:-1);
      else if(g.axis==='y'&&dy>110) close();
      else reset(true);
    } else if(g.onImg){ zoomAt(e.clientX,e.clientY,2.5,base()); apply(true) }
    else close();
    g=null;
  };
  stage.addEventListener('pointerup',end);
  stage.addEventListener('pointercancel',e=>{pts.delete(e.pointerId);g=null;lb.style.removeProperty('--fade');reset(true)});
})();

// Mapa – MapLibre + OpenFreeMap: čistá vektorová mapa přebarvená do tónů webu,
// načítá se až když se k ní uživatel přiblíží
(function(){
  const el=document.getElementById('map'); if(!el) return;
  const LNG=14.4194829, LAT=50.082309;
  const C={bg:'#F2EEE7',park:'#E6E5D7',wood:'#E1E0D1',water:'#D2D8D8',res:'#EEE9E1',bld:'#E7E0D4',bldLine:'#DAD1C3',
           casing:'#DFD6C8',minor:'#FBF9F5',path:'#ECE6DB',major:'#FFFFFF',rail:'#DCD5C9',text:'#6B6357',textMinor:'#8C8274',halo:'#F7F4EF'};
  let started=false;
  const recolor=map=>{
    map.getStyle().layers.forEach(l=>{
      const id=l.id, set=(p,v)=>{try{map.setPaintProperty(id,p,v)}catch(_){}};
      if(l.type==='background') set('background-color',C.bg);
      else if(l.type==='fill'){
        if(id==='water') set('fill-color',C.water);
        else if(id==='park') set('fill-color',C.park);
        else if(id.includes('wood')) set('fill-color',C.wood);
        else if(id.includes('residential')) set('fill-color',C.res);
        else if(id==='building'){set('fill-color',C.bld);set('fill-outline-color',C.bldLine)}
        else if(id.includes('pier')) set('fill-color',C.bg);
      } else if(l.type==='line'){
        if(id.includes('waterway')) set('line-color',C.water);
        else if(id.includes('dashline')) set('line-color',C.halo);
        else if(id.includes('rail')) set('line-color',C.rail);
        else if(id.includes('casing')) set('line-color',C.casing);
        else if(id.includes('pier')) set('line-color',C.bg);
        else if(id.includes('path')) set('line-color',C.path);
        else if(id.includes('minor')) set('line-color',C.minor);
        else if(id.includes('major')||id.includes('motorway')) set('line-color',C.major);
        else if(id.includes('boundary')) set('line-color','#CFC6B8');
      } else if(l.type==='symbol'){
        set('text-color',(id.startsWith('highway')||id.startsWith('water'))?C.textMinor:C.text);
        set('text-halo-color',C.halo);
      }
    });
  };
  const init=()=>{
    if(!window.maplibregl) return;
    let map;
    try{
      map=new maplibregl.Map({
        container:el.querySelector('.map-canvas'),style:'https://tiles.openfreemap.org/styles/positron',
        center:[LNG,LAT],zoom:el.offsetWidth<420?15.2:15.8,minZoom:12,maxZoom:18,attributionControl:false,
        cooperativeGestures:true,dragRotate:false,pitchWithRotate:false,touchPitch:false,
        locale:{
          'CooperativeGesturesHandler.WindowsHelpText':'Mapu přiblížíte Ctrl + kolečkem myši',
          'CooperativeGesturesHandler.MacHelpText':'Mapu přiblížíte ⌘ + kolečkem myši',
          'CooperativeGesturesHandler.MobileHelpText':'Mapu posunete dvěma prsty',
          'NavigationControl.ZoomIn':'Přiblížit','NavigationControl.ZoomOut':'Oddálit'
        }
      });
    }catch(_){return}
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-left');
    map.addControl(new maplibregl.AttributionControl({compact:true}),'top-right');
    const mk=document.createElement('div'); mk.className='ms-marker';
    mk.innerHTML='<span class="ms-label">Mi Sushi</span><svg class="ms-pin" viewBox="0 0 40 52" aria-hidden="true"><path d="M20 50.5S36.5 33.6 36.5 21A16.5 16.5 0 0 0 3.5 21C3.5 33.6 20 50.5 20 50.5z"/><circle cx="20" cy="21" r="6"/></svg><span class="ms-ground"></span>';
    new maplibregl.Marker({element:mk,anchor:'bottom'}).setLngLat([LNG,LAT]).addTo(map);
    map.on('style.load',()=>{recolor(map);map.setPadding({top:60,bottom:0,left:0,right:0})});
    const collapseAttrib=()=>{const d=el.querySelector('.maplibregl-ctrl-attrib');if(d){d.removeAttribute('open');d.classList.remove('maplibregl-compact-show')}};
    map.on('load',()=>{collapseAttrib();el.classList.add('ready')});
  };
  const load=()=>{
    if(started) return; started=true;
    const css=document.createElement('link'); css.rel='stylesheet';
    css.href='https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.min.css'; document.head.appendChild(css);
    const js=document.createElement('script');
    js.src='https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.min.js'; js.onload=init; document.head.appendChild(js);
  };
  if('IntersectionObserver' in window){
    const io=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting)){load();io.disconnect()}},{rootMargin:'800px 0px'});
    io.observe(el);
  } else load();
})();

// Rail – samo-posuvný pás (menu, galerie): jede sám, zastaví se při dotyku/najetí myší,
// dá se táhnout prstem i myší, má tlačítka zpět / pauza / vpřed
(function(){
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  // na mobilu jen pár fotek – zbytek je na podstránce Galerie
  if(matchMedia('(max-width:699px)').matches) document.querySelectorAll('[data-rail-extra]').forEach(n=>n.remove());
  document.querySelectorAll('[data-rail]').forEach(rail=>{
    const track=rail.querySelector('.rail-track'); if(!track) return;
    const originals=[...track.children]; if(!originals.length) return;
    const speed=+(rail.dataset.speed||32);
    const ctrl=document.querySelector('[data-rail-ctrl="'+rail.id+'"]');
    const pauseBtn=ctrl&&ctrl.querySelector('[data-rail-pause]');
    let loopW=0,x=0,vx=0,anim=null,drag=null,moved=false,hover=false,focus=false,visible=true,
        userPaused=reduce,idleUntil=0,last=performance.now();

    const addClones=()=>{
      originals.forEach((el,i)=>{
        const c=el.cloneNode(true); c.classList.add('is-clone'); c.setAttribute('aria-hidden','true'); c.removeAttribute('id');
        c.setAttribute('tabindex','-1'); c.querySelectorAll('a,button,[tabindex]').forEach(n=>n.setAttribute('tabindex','-1'));
        if(c.dataset.lb){c.dataset.lbClone=c.dataset.lb+':'+i;c.removeAttribute('data-lb')}
        c.removeAttribute('role'); track.appendChild(c);
      });
    };
    const measure=()=>{
      const clone=track.querySelector('.is-clone');
      loopW=clone?clone.offsetLeft-originals[0].offsetLeft:0;
    };
    addClones(); measure();
    for(let n=0;n<3&&track.scrollWidth<loopW+rail.clientWidth+50;n++) addClones();

    const wrap=()=>{
      if(loopW<=0) return; let d=0;
      while(x<=-loopW){x+=loopW;d+=loopW} while(x>0){x-=loopW;d-=loopW}
      if(d){ if(anim){anim.from+=d;anim.to+=d} if(drag){drag.x0+=d} }
    };
    const setPaused=v=>{
      userPaused=v;
      if(pauseBtn){pauseBtn.setAttribute('aria-pressed',String(v));pauseBtn.setAttribute('aria-label',v?'Spustit posouvání':'Zastavit posouvání')}
    };
    setPaused(userPaused);
    const stepW=()=>originals[0].getBoundingClientRect().width+parseFloat(getComputedStyle(track).columnGap||14);
    const nudge=dir=>{anim={from:x,to:x-dir*stepW(),t0:performance.now(),d:520};vx=0;idleUntil=performance.now()+4000};

    const render=()=>{track.style.transform='translate3d('+x.toFixed(2)+'px,0,0)'};
    const tick=now=>{
      const dt=Math.min(64,now-last)/1000; last=now;
      if(!drag||!drag.active){
        if(anim){
          const k=Math.min(1,(now-anim.t0)/anim.d), e=1-Math.pow(1-k,3);
          x=anim.from+(anim.to-anim.from)*e; if(k>=1) anim=null;
        } else if(Math.abs(vx)>8){
          x+=vx*dt; vx*=Math.pow(0.004,dt);
        } else {
          vx=0;
          if(!userPaused&&!hover&&!focus&&visible&&now>idleUntil&&!document.hidden) x-=speed*dt;
        }
      }
      wrap(); render();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    rail.addEventListener('pointerdown',e=>{
      if(e.button>0) return;
      drag={id:e.pointerId,px:e.clientX,py:e.clientY,x0:x,lx:e.clientX,lt:performance.now(),axis:null,active:false};
      moved=false; vx=0; anim=null;
    });
    rail.addEventListener('pointermove',e=>{
      if(!drag||e.pointerId!==drag.id) return;
      const dx=e.clientX-drag.px, dy=e.clientY-drag.py;
      if(!drag.axis){
        if(Math.abs(dx)+Math.abs(dy)<6) return;
        drag.axis=Math.abs(dx)>Math.abs(dy)?'x':'y';
        if(drag.axis==='x'){drag.active=true;moved=true;rail.classList.add('is-dragging');try{rail.setPointerCapture(e.pointerId)}catch(_){}}
      }
      if(!drag.active) return;
      const now=performance.now(), inst=(e.clientX-drag.lx)/Math.max(8,now-drag.lt)*1000;
      vx=vx*0.5+inst*0.5; drag.lx=e.clientX; drag.lt=now;
      x=drag.x0+dx; wrap(); render();
    });
    const up=e=>{
      if(!drag||e.pointerId!==drag.id) return;
      if(drag.active){ idleUntil=performance.now()+3500; if(performance.now()-drag.lt>120) vx=0 } else vx=0;
      drag=null; rail.classList.remove('is-dragging');
    };
    rail.addEventListener('pointerup',up); rail.addEventListener('pointercancel',up);
    rail.addEventListener('click',e=>{ if(moved){e.preventDefault();e.stopPropagation();moved=false} },true);
    rail.addEventListener('pointerenter',e=>{ if(e.pointerType==='mouse') hover=true });
    rail.addEventListener('pointerleave',e=>{ if(e.pointerType==='mouse') hover=false });
    rail.addEventListener('focusin',()=>{focus=true});
    rail.addEventListener('focusout',()=>{focus=false});
    rail.addEventListener('scroll',()=>{rail.scrollLeft=0});
    rail.addEventListener('dragstart',e=>e.preventDefault());
    if('IntersectionObserver' in window) new IntersectionObserver(es=>{visible=es[0].isIntersecting}).observe(rail);
    addEventListener('resize',()=>{measure();wrap()});

    if(ctrl){
      const prev=ctrl.querySelector('[data-rail-prev]'), next=ctrl.querySelector('[data-rail-next]');
      if(prev) prev.addEventListener('click',()=>nudge(-1));
      if(next) next.addEventListener('click',()=>nudge(1));
      if(pauseBtn) pauseBtn.addEventListener('click',()=>{setPaused(!userPaused);idleUntil=0});
    }
  });
})();

// Podstránka Galerie – filtr Vše / Interiér / Jídlo
(function(){
  const chips=document.querySelectorAll('[data-filter]'); if(!chips.length) return;
  const tiles=[...document.querySelectorAll('.masonry .gtile')];
  chips.forEach(ch=>ch.addEventListener('click',()=>{
    const f=ch.dataset.filter;
    chips.forEach(c=>c.setAttribute('aria-pressed',String(c===ch)));
    tiles.forEach(t=>{t.hidden=!(f==='all'||t.dataset.cat===f)});
  }));
})();

// Úvodní prolínačka fotek (Ken Burns)
(function(){
  const box=document.querySelector('[data-hero-slides]'); if(!box) return;
  const imgs=[...box.querySelectorAll('img')], dots=[...document.querySelectorAll('.hero-dots button')];
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches, INT=6000;
  let i=0, timer=null;
  const loadAll=()=>imgs.forEach(im=>{if(im.dataset.src&&!im.getAttribute('src')) im.src=im.dataset.src});
  const ready=im=>im.complete&&im.naturalWidth>0;
  const go=n=>{
    n=(n+imgs.length)%imgs.length; if(n===i) return;
    const next=imgs[n], cur=imgs[i];
    if(!ready(next)){ loadAll(); next.addEventListener('load',()=>go(n),{once:true}); return }
    cur.classList.remove('is-active'); cur.classList.add('is-leaving');
    next.classList.add('is-active');
    setTimeout(()=>cur.classList.remove('is-leaving'),1700);
    i=n; dots.forEach((d,k)=>d.setAttribute('aria-current',String(k===i)));
  };
  const start=()=>{clearInterval(timer); if(!reduce) timer=setInterval(()=>{const n=(i+1)%imgs.length; if(ready(imgs[n])) go(n)},INT)};
  dots.forEach((d,k)=>d.addEventListener('click',()=>{go(k);start()}));
  if(document.readyState==='complete') loadAll(); else addEventListener('load',loadAll);
  start();
  document.addEventListener('visibilitychange',()=>{ if(document.hidden) clearInterval(timer); else start() });
})();
