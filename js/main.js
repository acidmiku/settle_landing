import { Editor } from './editor.js';
import { loadLibraries } from './syntax.js';
import { MOD, isMod, desktopOS, isMobile, finePointer } from './platform.js';

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const root = document.documentElement;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const EASE = 'cubic-bezier(.16,1,.3,1)';
const EASE_IO = 'cubic-bezier(.76,0,.24,1)';
const store = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* Private mode: nothing to keep. */ } },
};

/* ---------- designs ---------- */

// Window palettes for swatches; page palettes live in styles.css.
const SWATCH = {
  scratch: ['#202329', '#ff5579'], kiln: ['#242422', '#ff681b'], blackbox: ['#0b0d09', '#b6f321'],
  optic: ['#fafaf8', '#1837ff'], phosphor: ['#061b16', '#8bf1c9'], sidecar: ['#131e26', '#ff813e'],
  cobalt: ['#1738ee', '#e2ff48'], redline: ['#f2f0e9', '#ed2b20'], frost: ['#f2f5f8', '#0087a6'], tape: ['#ebf23e', '#151614'],
};
const PAGE_BG = {
  scratch: '#17191d', kiln: '#1a1a18', blackbox: '#070806', optic: '#f4f4f1', phosphor: '#04150f',
  sidecar: '#0e171d', cobalt: '#1738ee', redline: '#ebe8df', frost: '#e9eef3', tape: '#ebf23e',
};
const DESIGNS = $$('.design-source li').map(li => ({
  id: li.dataset.id,
  name: li.dataset.id[0].toUpperCase() + li.dataset.id.slice(1),
  desc: li.textContent.trim(),
  tag: li.dataset.tag || '',
}));
const designName = id => DESIGNS.find(d => d.id === id)?.name || 'Scratch';

let skin = DESIGNS.some(d => d.id === root.dataset.skin) ? root.dataset.skin : 'scratch';
root.dataset.skin = skin;

$$('[data-mod]').forEach(key => { key.textContent = MOD; });

/* ---------- the live window ---------- */

const DEMO = [
  { text: 'Before I forget\n\nThe bug is in the retry loop, not the parser.\nAsk about the staging keys on Monday.\nBook the dentist.\n\nBuy coffee before it becomes urgent.' },
  { text: `# Release notes\n\n**0.2.1** adds word wrap, updates and startup.\n\n- [x] Word wrap in every design\n- [x] Check for updates\n- [x] Start with OS\n- [ ] More coffee\n\n| Shortcut | Action |\n| --- | --- |\n| ${MOD} S | Save |\n| Esc | Hide |\n`, preview: true },
  { text: 'fn retry<T, E>(mut attempt: impl FnMut() -> Result<T, E>) -> Result<T, E> {\n    for wait in [100, 400, 1600] {\n        match attempt() {\n            Ok(value) => return Ok(value),\n            Err(_) => sleep(Duration::from_millis(wait)),\n        }\n    }\n    attempt()\n}\n' },
];

const dock = $('#dock');
const frame = $('#live-frame');
const summonLayer = $('#summon');
const slot = $('.summon-slot');
const pill = $('#pill');
const skins = $('#skins');
const pageParts = [$('.head'), $('main'), $('.foot')];

function savedDraft() {
  try {
    const value = JSON.parse(store.get('settle:draft'));
    if (!value || !Array.isArray(value.tabs) || !value.tabs.length || !value.tabs.every(t => typeof t.text === 'string')) return null;
    return value;
  } catch { return null; }
}

const draft = savedDraft();
let userTookOver = Boolean(draft);
let persistTimer;
const live = new Editor($('#live'), {
  live: true,
  design: skin,
  tabs: draft ? draft.tabs : [{ text: '' }, DEMO[1], DEMO[2]],
  active: draft ? draft.active || 0 : 0,
  onAction: (act, button) => windowAction(act, button),
  onChange: (editor, { silent } = {}) => {
    if (editor.autotyping) return;
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      store.set('settle:draft', JSON.stringify({ tabs: editor.tabs, active: editor.current }));
      if (!silent) editor.setState('Backed up locally');
    }, 450);
  },
});

function takeOver() {
  if (userTookOver) return;
  userTookOver = true;
  live.finishTyping(DEMO[0].text);
}
frame.addEventListener('pointerdown', takeOver);
frame.addEventListener('keydown', takeOver, true);

function windowAction(act, button) {
  if (act === 'focus') takeOver();
  else if (act === 'close' || act === 'hide') {
    if (skins.matches(':popover-open')) skins.hidePopover();
    else hide();
  } else if (act === 'max') {
    (mode === 'summoned' ? summonLayer : dock).classList.toggle('is-max');
  } else if (act === 'settings') {
    lastInvoker = button;
    if (skins.matches(':popover-open')) skins.hidePopover();
    else skins.showPopover();
  }
}

/* ---------- hide and summon ---------- */

let mode = 'docked';
let busy = false;
let returnFocus = null;

function dockInView() {
  const r = dock.getBoundingClientRect();
  return r.bottom > innerHeight * .3 && r.top < innerHeight * .7;
}

function settle(animation) {
  return animation.finished.catch(() => {}).then(() => animation.cancel());
}

async function hide() {
  if (busy || mode === 'hidden') return;
  busy = true;
  const hadFocus = frame.contains(document.activeElement);
  await settle(frame.animate(
    [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(18px) scale(.965)' }],
    { duration: 280, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' },
  ));
  if (mode === 'summoned') {
    // Hiding a summoned window sends it home, quietly.
    frame.style.opacity = '0';
    await settle(summonLayer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: 'ease-out', fill: 'forwards' }));
    summonLayer.hidden = true;
    summonLayer.classList.remove('is-max');
    pageParts.forEach(part => { part.inert = false; });
    dock.classList.remove('is-away');
    dock.append(frame);
    frame.style.opacity = '';
    mode = 'docked';
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  } else {
    dock.classList.add('is-hidden');
    mode = 'hidden';
    if (hadFocus) $('.wake').focus({ preventScroll: true });
  }
  busy = false;
  updatePill();
}

async function show() {
  if (busy) return;
  if (mode === 'summoned' || (mode === 'docked' && dockInView())) { live.focus(); return; }
  busy = true;
  takeOver();
  if (dockInView()) {
    dock.classList.remove('is-hidden');
    mode = 'docked';
    live.metricKey = '';
    live.updateMetrics();
    if (finePointer) live.focus();
    await settle(frame.animate(
      [{ opacity: 0, transform: 'translateY(26px) scale(.965)' }, { opacity: 1, transform: 'none' }],
      { duration: 760, easing: EASE },
    ));
  } else {
    returnFocus = document.activeElement;
    dock.classList.remove('is-hidden');
    dock.classList.add('is-away');
    slot.append(frame);
    summonLayer.hidden = false;
    pageParts.forEach(part => { part.inert = true; });
    mode = 'summoned';
    live.metricKey = '';
    live.updateMetrics();
    if (finePointer) live.focus();
    $('.summon-scrim').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, easing: 'ease-out' });
    await settle(frame.animate(
      [{ opacity: 0, transform: 'translateY(34px) scale(.955)' }, { opacity: 1, transform: 'none' }],
      { duration: 820, easing: EASE },
    ));
  }
  busy = false;
  updatePill();
}

$$('[data-summon]').forEach(button => button.addEventListener('click', show));
$('.summon-scrim').addEventListener('click', hide);

let dockVisible = true;
function updatePill() {
  pill.classList.toggle('is-on', mode !== 'summoned' && !dockVisible && root.classList.contains('loaded'));
}
new IntersectionObserver(([entry]) => { dockVisible = entry.isIntersecting; updatePill(); }, { threshold: .12 }).observe(dock);

const ghost = $('.ghost'), ghostRect = $('.ghost rect');
new ResizeObserver(() => {
  ghostRect.setAttribute('width', Math.max(0, ghost.clientWidth - 2));
  ghostRect.setAttribute('height', Math.max(0, ghost.clientHeight - 2));
}).observe(ghost);

/* ---------- wearing a design ---------- */

const swatchStyle = id => `--sw-bg:${SWATCH[id][0]};--sw-accent:${SWATCH[id][1]}`;
$('.skins-list').innerHTML = DESIGNS.map(d => `
  <button type="button" class="skin-option" data-wear="${d.id}" aria-pressed="false">
    <span class="sw" style="${swatchStyle(d.id)}"></span><span>${d.name}</span><small>${d.tag}</small>
  </button>`).join('');

function syncSkinUI() {
  $$('[data-skin-name]').forEach(el => { el.textContent = designName(skin); });
  $$('[data-wear]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.wear === skin)));
  $$('.slide-wear').forEach(el => {
    const on = el.closest('.slide').dataset.skin === skin;
    el.setAttribute('aria-pressed', String(on));
    el.querySelector('span').textContent = on ? 'This page wears it' : 'Use on this page';
  });
  $$('.slab').forEach(el => {
    const on = el.dataset.skin === skin;
    el.setAttribute('aria-pressed', String(on));
    el.setAttribute('aria-label', on ? `${designName(el.dataset.skin)}: this page wears it` : `Use ${designName(el.dataset.skin)} on this page`);
    el.querySelector('.slab-cta span').textContent = on ? 'This page wears it' : 'Use on this page';
  });
  // The last step of the stage wears whatever the page wears.
  const moreSlide = $('.slide-more');
  if (moreSlide) {
    moreSlide.dataset.skin = skin;
    if (moreSlide.style.zIndex === '3') $('.stage-pin').dataset.skin = skin;
  }
  $('meta[name="theme-color"]').content = PAGE_BG[skin];
}

function wear(id, origin) {
  if (id === skin || !SWATCH[id]) return;
  const change = () => {
    skin = id;
    root.dataset.skin = id;
    store.set('settle:skin', id);
    live.setDesign(id);
    syncSkinUI();
  };
  if (!origin || !document.startViewTransition) { change(); return; }
  root.classList.add('no-skin-transition');
  const transition = document.startViewTransition(change);
  transition.ready.then(() => {
    const radius = Math.hypot(Math.max(origin.x, innerWidth - origin.x), Math.max(origin.y, innerHeight - origin.y));
    root.animate(
      { clipPath: [`circle(0px at ${origin.x}px ${origin.y}px)`, `circle(${radius}px at ${origin.x}px ${origin.y}px)`] },
      { duration: 1000, easing: EASE_IO, pseudoElement: '::view-transition-new(root)' },
    );
  }).catch(() => {});
  transition.finished.finally(() => root.classList.remove('no-skin-transition'));
}

function originOf(event, element) {
  if (event?.clientX || event?.clientY) return { x: event.clientX, y: event.clientY };
  const r = element.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

$('.skins-list').addEventListener('click', e => {
  const option = e.target.closest('[data-wear]');
  if (!option) return;
  const origin = originOf(e, option);
  skins.hidePopover();
  wear(option.dataset.wear, origin);
});

let lastInvoker = null;
document.addEventListener('pointerdown', e => { const b = e.target.closest('[popovertarget="skins"]'); if (b) lastInvoker = b; }, true);
document.addEventListener('keydown', e => { const b = e.target.closest?.('[popovertarget="skins"]'); if (b) lastInvoker = b; }, true);
skins.addEventListener('beforetoggle', e => {
  if (e.newState !== 'open') return;
  const anchor = e.source || lastInvoker || $('.skin-button');
  const r = anchor.getBoundingClientRect();
  const width = Math.min(300, innerWidth - 32), height = 470;
  const left = clamp(r.right - width, 16, innerWidth - width - 16);
  let top = r.bottom + 10;
  if (top + height > innerHeight - 12 && r.top - height - 10 > 12) top = r.top - height - 10;
  skins.style.setProperty('--pop-left', `${left}px`);
  skins.style.setProperty('--pop-right', 'auto');
  skins.style.setProperty('--pop-top', `${clamp(top, 12, Math.max(12, innerHeight - height - 12))}px`);
});
skins.addEventListener('toggle', e => {
  if (e.newState === 'open') ($('.skin-option[aria-pressed="true"]') || $('.skin-option')).focus({ preventScroll: true });
  else if (document.activeElement === document.body && lastInvoker?.isConnected) lastInvoker.focus({ preventScroll: true });
});
skins.addEventListener('keydown', e => {
  if (!['ArrowDown', 'ArrowUp'].includes(e.key)) return;
  e.preventDefault();
  const options = $$('.skin-option'), i = options.indexOf(document.activeElement);
  options[(i + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length].focus();
});

/* ---------- three designs, then the other seven ---------- */

const STAGE = DESIGNS.slice(0, 3);
const MORE = DESIGNS.slice(3);
const STEPS = STAGE.length + 1;
const stage = $('#designs');
const pin = $('.stage-pin');
const slidesEl = $('.slides');
const count = $('[data-stage-count]');
const progressBar = $('.stage-progress i');
const indexNav = $('.stage-index');
const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';

function slideMarkup() {
  return `<div class="slide-meta">
      <p class="slide-tag"></p>
      <h3 class="slide-name"></h3>
      <p class="slide-desc"></p>
      <button type="button" class="slide-wear" aria-pressed="false">${CHECK}<span>Use on this page</span></button>
    </div>
    <div class="slide-win"><div class="win-frame"><div class="win" aria-hidden="true"></div></div></div>`;
}

const designSlides = [0, 1].map(() => {
  const el = document.createElement('div');
  el.className = 'slide';
  el.innerHTML = slideMarkup();
  slidesEl.append(el);
  const editor = new Editor($('.win', el), { live: false, tabs: [DEMO[0], DEMO[1]] });
  $('.slide-wear', el).addEventListener('click', () => wear(el.dataset.skin));
  return { el, editor, meta: $('.slide-meta', el), body: $('.slide-win', el) };
});

// The other seven, the way the app's own design picker shows them: a row of slabs.
const moreEl = document.createElement('div');
moreEl.className = 'slide slide-more';
moreEl.innerHTML = `<div class="more-head">
    <p class="slide-tag">Settings → Design</p>
    <h3 class="slide-name">And seven more.</h3>
    <p class="slide-desc">Each one changes the palette, the type and the layout. Your open text stays put. Try one on this page.</p>
  </div>
  <div class="slabs" role="group" aria-label="Seven more designs">${MORE.map((d, i) => `
    <button type="button" class="slab" data-skin="${d.id}" aria-pressed="false">
      <span class="slab-num" aria-hidden="true">${String(i + STAGE.length + 1).padStart(2, '0')}</span>
      <span class="slab-spine" aria-hidden="true">${d.name}</span>
      <span class="slab-body">
        <span class="slab-name">${d.name}</span>
        <span class="slab-desc">${d.desc}</span>
        <span class="mini" aria-hidden="true"><span class="mini-bar"><b>settle</b><span>—&nbsp;&nbsp;□&nbsp;&nbsp;×</span></span><i></i><i></i><i></i><i></i></span>
        <span class="slab-cta">${CHECK}<span>Use on this page</span></span>
      </span>
    </button>`).join('')}
  </div>`;
slidesEl.append(moreEl);
const more = { el: moreEl, meta: $('.more-head', moreEl), body: $('.slabs', moreEl) };
const slides = [...designSlides, more];
const slabs = $$('.slab', moreEl);

let slabHover = false;
function openSlab(slab) { slabs.forEach(s => s.classList.toggle('is-open', s === slab)); }
openSlab(slabs.find(s => s.dataset.skin === skin) || slabs[0]);
slabs.forEach(slab => {
  slab.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { slabHover = true; openSlab(slab); } });
  slab.addEventListener('focus', () => { if (slab.matches(':focus-visible')) openSlab(slab); });
  slab.addEventListener('click', e => {
    if (!slab.classList.contains('is-open')) { openSlab(slab); return; }
    wear(slab.dataset.skin, originOf(e, slab));
  });
});
more.body.addEventListener('pointerleave', () => { slabHover = false; });
setInterval(() => {
  // While nobody is touching them, the slabs take turns.
  if (step !== STEPS - 1 || slabHover || more.body.contains(document.activeElement) || document.hidden) return;
  const i = slabs.findIndex(s => s.classList.contains('is-open'));
  openSlab(slabs[(i + 1) % slabs.length]);
}, 2600);

indexNav.innerHTML = STAGE.map((d, i) => `<button type="button" data-step="${i}" aria-label="Show ${d.name}">${d.name}</button>`).join('')
  + `<button type="button" data-step="${STEPS - 1}" aria-label="Show the other seven designs">+7 more</button>`;

function stageText() {
  const text = !live.autotyping && live.source.trim() ? live.source : DEMO[0].text;
  return [{ text }, live.current === 1 ? DEMO[0] : DEMO[1]];
}

function fillSlide(slide, design) {
  slide.el.dataset.skin = design.id;
  $('.slide-tag', slide.el).textContent = design.tag;
  $('.slide-name', slide.el).textContent = design.name;
  $('.slide-desc', slide.el).textContent = design.desc;
  slide.editor.setDesign(design.id);
  slide.editor.setTabs(stageText());
  syncSkinUI();
}

let step = 0;
let front = designSlides[0];
fillSlide(designSlides[0], STAGE[0]);
fillSlide(designSlides[1], STAGE[1]);
slides.forEach((s, i) => { s.el.style.zIndex = i === 0 ? 2 : 1; s.el.inert = i !== 0; });
pin.dataset.skin = STAGE[0].id;

function markStep(i) {
  count.textContent = i < STAGE.length ? String(i + 1).padStart(2, '0') : `${String(STAGE.length + 1).padStart(2, '0')}–${DESIGNS.length}`;
  $$('button', indexNav).forEach((b, j) => b.setAttribute('aria-current', String(i === j)));
}
markStep(0);

function goTo(i, direction) {
  if (i === step) return;
  step = i;
  const isMore = i === STEPS - 1;
  const outgoing = front;
  const incoming = isMore ? more : designSlides.find(s => s !== front);
  incoming.el.getAnimations({ subtree: true }).forEach(a => a.cancel());
  if (!isMore) fillSlide(incoming, STAGE[i]);
  slides.forEach(s => {
    s.el.style.zIndex = s === incoming ? 3 : s === outgoing ? 2 : 1;
    s.el.inert = s !== incoming;
  });
  const from = direction > 0 ? 'inset(100% 0% 0% 0%)' : 'inset(0% 0% 100% 0%)';
  incoming.el.animate({ clipPath: [from, 'inset(0% 0% 0% 0%)'] }, { duration: 950, easing: EASE_IO });
  incoming.meta.animate({ transform: [`translateY(${direction * 90}px)`, 'none'], opacity: [0, 1] }, { duration: 1150, easing: EASE });
  if (isMore) {
    slabs.forEach((slab, k) => slab.animate(
      { transform: [`translateY(${direction * (120 + k * 26)}px)`, 'none'], opacity: [0, 1] },
      { duration: 1100, delay: 80 + k * 55, easing: EASE, fill: 'backwards' },
    ));
  } else {
    incoming.body.animate({ transform: [`translateY(${direction * 180}px)`, 'none'] }, { duration: 1300, easing: EASE });
  }
  outgoing.meta.animate({ transform: ['none', `translateY(${-direction * 60}px)`], opacity: [1, .2] }, { duration: 950, easing: EASE_IO, fill: 'forwards' });
  outgoing.body.animate({ transform: ['none', `translateY(${-direction * 90}px)`] }, { duration: 950, easing: EASE_IO, fill: 'forwards' });
  front = incoming;
  pin.dataset.skin = isMore ? skin : STAGE[i].id;
  markStep(i);
}

let progressTarget = 0, progressNow = 0, progressFrame = 0;
function animateProgress() {
  progressNow += (progressTarget - progressNow) * .14;
  if (Math.abs(progressTarget - progressNow) < .0005) progressNow = progressTarget;
  progressBar.style.transform = `scaleX(${progressNow})`;
  progressFrame = progressNow === progressTarget ? 0 : requestAnimationFrame(animateProgress);
}

function stageMetrics() {
  const top = stage.getBoundingClientRect().top + scrollY;
  const total = Math.max(1, stage.offsetHeight - innerHeight);
  return { top, total };
}

let lastScroll = scrollY, ticking = false;
function onScroll() {
  ticking = false;
  const direction = scrollY >= lastScroll ? 1 : -1;
  lastScroll = scrollY;
  const { top, total } = stageMetrics();
  const p = clamp((scrollY - top) / total, 0, 1);
  const i = Math.min(STEPS - 1, Math.floor(p * STEPS));
  goTo(i, i > step ? 1 : i < step ? -1 : direction);
  progressTarget = p;
  if (!progressFrame) progressFrame = requestAnimationFrame(animateProgress);
}
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
addEventListener('resize', () => requestAnimationFrame(onScroll));

indexNav.addEventListener('click', e => {
  const button = e.target.closest('[data-step]');
  if (!button) return;
  const { top, total } = stageMetrics();
  const i = Number(button.dataset.step);
  scrollTo({ top: top + ((i + .5) / STEPS) * total, behavior: 'smooth' });
});

/* ---------- keyboard section ---------- */

const keysSection = $('#keys');
const lastPressed = $('[data-keys-last]');
let keysVisible = false;
new IntersectionObserver(([entry]) => { keysVisible = entry.isIntersecting; }, { threshold: .05 }).observe(keysSection);
const PREVENT = new Set(['mod+s', 'mod+k', 'mod+shift+h', 'mod+,']);

function comboOf(e) {
  const parts = [];
  if (isMod(e)) parts.push('mod');
  if (e.shiftKey) parts.push('shift');
  let key = e.code === 'Space' ? 'space' : e.key.toLowerCase();
  if (key === 'esc') key = 'escape';
  parts.push(key);
  return parts.join('+');
}

function editable(target) {
  return target instanceof HTMLElement && (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName));
}

document.addEventListener('keydown', e => {
  if (e.isComposing) return;
  const combo = comboOf(e);
  // The app's global shortcut, borrowed by the page.
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'Space') {
    e.preventDefault();
    if (mode === 'summoned' || (mode === 'docked' && dockInView() && frame.contains(document.activeElement))) hide();
    else show();
  } else if (e.key === 'Escape' && mode === 'summoned' && !frame.contains(e.target) && !skins.matches(':popover-open')) {
    e.preventDefault();
    hide();
  } else if (combo === 'mod+,' && !frame.contains(e.target)) {
    e.preventDefault();
    lastInvoker = $('.skin-button');
    skins.togglePopover();
  }
  if (!keysVisible || editable(e.target) || frame.contains(e.target)) return;
  const row = $(`.key-row[data-combo="${CSS.escape(combo)}"]`, keysSection);
  if (!row) return;
  if (PREVENT.has(combo)) e.preventDefault();
  row.classList.remove('hit');
  void row.offsetWidth;
  row.classList.add('hit');
  lastPressed.replaceChildren(...row.querySelector('.key-combo').cloneNode(true).childNodes, ` ${row.querySelector('.key-name').textContent}.`);
});
$$('.key-row').forEach(row => row.addEventListener('animationend', () => row.classList.remove('hit')));

/* ---------- small motions ---------- */

const langs = $$('.langs span:not(.langs-more)');
let langTimer = 0, langOn = -1;
new IntersectionObserver(([entry]) => {
  clearInterval(langTimer);
  if (!entry.isIntersecting) return;
  langTimer = setInterval(() => {
    langs[langOn]?.classList.remove('is-on');
    let next;
    do next = Math.floor(Math.random() * langs.length); while (next === langOn);
    langOn = next;
    langs[langOn].classList.add('is-on');
  }, 1150);
}).observe($('.langs'));

const pathText = desktopOS === 'macos' ? $('[data-path-os="mac"] code').textContent : $('[data-path-os="windows"] code').textContent;
const typedPath = $(`[data-path-os="${desktopOS === 'macos' ? 'mac' : 'windows'}"] code`);
new IntersectionObserver(async ([entry], observer) => {
  if (!entry.isIntersecting) return;
  observer.disconnect();
  typedPath.textContent = '';
  for (let i = 1; i <= pathText.length; i++) {
    typedPath.textContent = pathText.slice(0, i);
    await sleep(18 + Math.random() * 34);
  }
}, { threshold: .6 }).observe(typedPath);

const reveals = new IntersectionObserver(entries => {
  entries.filter(entry => entry.isIntersecting).forEach((entry, i) => {
    if (!entry.target.closest('.hero')) entry.target.style.setProperty('--d', `${i * .07}s`);
    entry.target.classList.add('in');
    reveals.unobserve(entry.target);
  });
}, { rootMargin: '0px 0px -6% 0px', threshold: .12 });
$('.hero .lede').style.setProperty('--d', '.55s');
$('.hero .cta').style.setProperty('--d', '.65s');
$('.dock-hint').style.setProperty('--d', '1.5s');
$$('.reveal').forEach(el => reveals.observe(el));

/* ---------- downloads ---------- */

const RELEASES = 'https://github.com/acidmiku/settle/releases';
const primary = $('[data-download="primary"]');
const osName = { windows: 'Windows', macos: 'macOS' };
if (desktopOS) $('[data-download-label]').textContent = `Download for ${osName[desktopOS]}`;
const YOURS = '<span class="platform-yours">This computer</span>';
const yoursTag = os => (os === desktopOS ? YOURS : '');
if (desktopOS) $(`.platform[data-platform="${desktopOS}"] [data-meta]`).insertAdjacentHTML('afterbegin', YOURS);
if (isMobile) $('[data-download-meta]').textContent = 'For Windows and macOS desktops';

const megabytes = bytes => `${(bytes / 1048576).toFixed(1)} MB`;
function versionOf(tag) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(tag || '');
  return m ? m.slice(1).map(Number) : null;
}
function pickRelease(list) {
  for (const r of list) {
    const v = versionOf(r.tag_name);
    // 0.1.x is the app before its rebuild; this page describes 0.2 and later.
    if (r.draft || r.prerelease || !v || v[0] * 1e6 + v[1] * 1e3 + v[2] < 2000) continue;
    const win = r.assets.find(a => /setup\.exe$/i.test(a.name)) || r.assets.find(a => /\.(exe|msi)$/i.test(a.name));
    const mac = r.assets.find(a => /\.dmg$/i.test(a.name));
    if (!win && !mac) continue;
    const asset = a => a && { url: a.browser_download_url, size: a.size, name: a.name };
    return { version: v.join('.'), date: r.published_at, page: r.html_url, windows: asset(win), macos: asset(mac) };
  }
  return null;
}
async function loadRelease() {
  try {
    const cached = JSON.parse(store.get('settle:release') || 'null');
    if (cached && Date.now() - cached.at < 15 * 60 * 1000) return cached.data;
  } catch { /* Fetch again. */ }
  const response = await fetch('https://api.github.com/repos/acidmiku/settle/releases?per_page=20', { headers: { Accept: 'application/vnd.github+json' } });
  if (!response.ok) throw new Error(`GitHub answered ${response.status}`);
  const data = pickRelease(await response.json());
  store.set('settle:release', JSON.stringify({ at: Date.now(), data }));
  return data;
}
function applyRelease(release) {
  if (!release) return;
  const date = new Date(release.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  $('[data-release-line]').innerHTML = `Version ${release.version}, released ${date}. Every build is on <a href="${RELEASES}">GitHub Releases</a>.`;
  for (const os of ['windows', 'macos']) {
    const link = $(`[data-download="${os}"]`), asset = release[os];
    const meta = $('[data-meta]', link);
    if (asset) {
      link.href = asset.url;
      meta.innerHTML = `${yoursTag(os)}<b>${release.version}</b> · ${os === 'windows' ? '64-bit installer' : 'Universal · Apple silicon and Intel · macOS 12.3+'} · ${megabytes(asset.size)}`;
    } else {
      link.href = release.page;
      meta.innerHTML = `${yoursTag(os)}<b>${release.version}</b> · Not in this release yet. See the release page.`;
      $('[data-ext]', link).textContent = 'GitHub';
    }
  }
  const asset = desktopOS && release[desktopOS];
  if (asset) {
    primary.href = asset.url;
    $('[data-download-meta]').textContent = `${release.version} · ${megabytes(asset.size)}`;
  } else {
    primary.href = '#download';
    $('[data-download-label]').textContent = `Download Settle ${release.version}`;
  }
}
loadRelease().then(applyRelease).catch(() => {});

/* ---------- start ---------- */

syncSkinUI();
const fontsReady = document.fonts ? Promise.race([document.fonts.ready, sleep(1400)]) : Promise.resolve();
fontsReady.then(() => requestAnimationFrame(() => {
  root.classList.add('loaded');
  updatePill();
  onScroll();
}));
frame.addEventListener('animationend', function entered(e) {
  if (e.target !== frame) return;
  dock.classList.add('entered');
  frame.removeEventListener('animationend', entered);
});

const idle = window.requestIdleCallback || (fn => setTimeout(fn, 1200));
idle(() => loadLibraries());

if (!userTookOver) {
  fontsReady.then(async () => {
    await sleep(1500);
    if (!userTookOver) await live.typeOut(DEMO[0].text, { shouldStop: () => userTookOver });
    live.setState('Backed up locally');
  });
} else {
  live.setState('Draft · local');
}
