(() => {
  document.documentElement.classList.add('js');
  const header = document.querySelector('.site-header');
  const links = document.querySelector('.nav-links');
  const toggle = document.querySelector('.menu-toggle');
  const backdrop = document.querySelector('.mobile-backdrop');
  const progress = document.querySelector('.progress');
  const topButton = document.querySelector('.back-top');
  const closeMenu = () => { links?.classList.remove('open'); backdrop?.classList.remove('show'); toggle?.setAttribute('aria-expanded','false'); document.body.style.overflow=''; };
  toggle?.addEventListener('click', () => {
    const open = !links.classList.contains('open');
    links.classList.toggle('open',open); backdrop.classList.toggle('show',open);
    toggle.setAttribute('aria-expanded',String(open)); document.body.style.overflow=open?'hidden':'';
  });
  backdrop?.addEventListener('click',closeMenu);
  links?.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()});
  const update = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    if(progress) progress.style.transform=`scaleX(${max>0?scrollY/max:0})`;
    header?.classList.toggle('scrolled',scrollY>30);
    topButton?.classList.toggle('show',scrollY>700);
  };
  addEventListener('scroll',update,{passive:true}); update();
  topButton?.addEventListener('click',()=>scrollTo({top:0,behavior:'smooth'}));
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');observer.unobserve(e.target)}}),{threshold:.12,rootMargin:'0px 0px -8% 0px'});
    document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));
    setTimeout(()=>document.querySelectorAll('.reveal').forEach(el=>el.classList.add('visible')),1500);
  } else document.querySelectorAll('.reveal').forEach(el=>el.classList.add('visible'));
  document.querySelectorAll('img[data-zoom]').forEach(img=>{img.tabIndex=0;img.setAttribute('role','button');img.setAttribute('aria-label',`Open image: ${img.alt||'Capstone guide image'}`)});
  if(document.querySelector('img[data-zoom]')){
    const dialog=document.createElement('dialog');dialog.className='lightbox';dialog.setAttribute('aria-label','Image viewer');
    const close=document.createElement('button');close.className='lightbox-close';close.type='button';close.setAttribute('aria-label','Close image');close.textContent='×';
    const figure=document.createElement('figure'),largeImage=document.createElement('img'),captionText=document.createElement('figcaption');largeImage.alt='';figure.append(largeImage,captionText);dialog.append(close,figure);document.body.append(dialog);
    const large=largeImage,caption=captionText;let opener=null;
    const openImage=img=>{opener=img;large.src=img.currentSrc||img.src;large.alt=img.alt;caption.textContent=img.closest('figure')?.querySelector('figcaption')?.textContent||img.alt||'';dialog.showModal();close.focus()};
    document.querySelectorAll('img[data-zoom]').forEach(img=>{img.addEventListener('click',()=>openImage(img));img.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openImage(img)}})});
    close.addEventListener('click',()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});dialog.addEventListener('close',()=>opener?.focus());
  }
  const guidePage=document.querySelector('.portfolio-page, .poster-page, .journal-page, .logbook-page, .panel-page, .time-frame-page');
  if(guidePage){
    const isPortfolio=guidePage.classList.contains('portfolio-page');
    const isPoster=guidePage.classList.contains('poster-page');
    const isJournal=guidePage.classList.contains('journal-page');
    const isLogbook=guidePage.classList.contains('logbook-page');
    const isTimeFrame=guidePage.classList.contains('time-frame-page');
    const selector=isPortfolio?'.portfolio-page .chapter[id^="part-"]':isPoster?'.poster-page .chapter[id^="poster-"]':isJournal?'.journal-page .chapter[id^="journal-"]':isLogbook?'.logbook-page .chapter[id^="logbook-"]':isTimeFrame?'.time-frame-page .chapter#time-intro,.time-frame-page .chapter#time-general-rule,.time-frame-page .week[id^="time-week-"]':'.panel-page h2[id^="panel-"]';
    const targets=[...document.querySelectorAll(selector)];
    if(targets.length){
      const toc=document.createElement('nav');toc.className='pub-toc';toc.setAttribute('aria-label',isPortfolio?'Portfolio section shortcuts':isPoster?'Poster section shortcuts':isJournal?'Journal section shortcuts':isLogbook?'Logbook section shortcuts':isTimeFrame?'Time Frame section shortcuts':'Panel Review section shortcuts');
      const label=document.createElement('span');label.className='section-kicker';label.textContent='Sections';toc.append(label);
      const tocLinks=targets.map((el,i)=>{const link=document.createElement('a');link.href=`#${el.id}`;link.textContent=el.dataset.tocTitle||el.querySelector('h2')?.textContent||el.querySelector('strong')?.textContent||`Section ${i+1}`;toc.append(link);return link});
      document.body.append(toc);
      // Keep shortcut navigation available even when scroll observation is unsupported.
      if('IntersectionObserver' in window){
        const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){tocLinks.forEach(a=>a.classList.toggle('active',a.hash===`#${e.target.id}`))}}),{rootMargin:'-35% 0px -55% 0px'});targets.forEach(el=>observer.observe(el))
      }
    }
  }
  const clearTransition=()=>document.body.classList.remove('page-leave','page-enter');
  addEventListener('pageshow',e=>{clearTransition();if(e.persisted)document.body.classList.remove('page-leave')});
  setTimeout(()=>document.body.classList.add('page-enter'),0);setTimeout(clearTransition,1500);
  document.addEventListener('click',e=>{const a=e.target.closest('a[href]');if(!a||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||a.target==='_blank'||a.hasAttribute('download'))return;const u=new URL(a.href,location.href);if(u.origin!==location.origin||u.hash&&u.pathname===location.pathname)return;e.preventDefault();document.body.classList.add('page-leave');setTimeout(()=>location.assign(u.href),160)});
})();
