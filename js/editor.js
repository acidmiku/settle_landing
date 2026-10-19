// A working replica of Settle's editor window. The layout, wrapping, gutter
// and syntax rules follow the app's src/js/editor.js; saving and hiding are
// played out on the page instead of the desktop.
import { LANGUAGES, languageName, normalizeSyntax } from './languages.js';
import { detectSyntax, highlight, renderMarkdown, escapeHtml } from './syntax.js';
import { MOD, isMod } from './platform.js';

const ICON = {
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6.5"/><path d="m15 15 6 6"/></svg>',
  history: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10a9 9 0 1 1 1 7M3 4v6h6M12 7v6l4 2"/></svg>',
  settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 3-1 3-3 1-2 5 2 5 3 1 1 3h6l1-3 3-1 2-5-2-5-3-1-1-3z"/><circle cx="12" cy="12" r="3"/></svg>',
  min: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12"/></svg>',
  max: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6h12v12H6z"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg>',
};

function markup(live) {
  const off = live ? '' : ' tabindex="-1"';
  const field = live ? '' : ' readonly tabindex="-1"';
  return `
<div class="win-titlebar" aria-hidden="true"><i></i><i></i><i></i><span>Settle</span></div>
<aside class="design-rail" aria-label="Quick tools"><span class="rail-brand" aria-hidden="true">SETTLE</span><button type="button" data-act="history" title="Saved notes" aria-label="Saved notes"${off}>↶</button><button type="button" data-act="settings" title="Design (${MOD}+,)" aria-label="Choose a design"${off}>⚙</button></aside>
<header class="topbar">
  <time class="clock" aria-hidden="true"></time>
  <div class="brand">settle</div>
  <div class="drag-space"></div>
  <div class="top-actions">
    <button type="button" class="search-button" data-act="search" title="Search saved notes (${MOD}+K)" aria-label="Search saved notes"${off}>${ICON.search}<span>${MOD} K</span></button>
    <button type="button" class="icon-button" data-act="history" title="Saved notes (${MOD}+Shift+H)" aria-label="Saved notes"${off}>${ICON.history}</button>
    <button type="button" class="icon-button" data-act="settings" title="Design (${MOD}+,)" aria-label="Choose a design"${off}>${ICON.settings}</button>
  </div>
  <div class="window-controls">
    <button type="button" data-act="hide" aria-label="Minimize window" title="Minimize"${off}>${ICON.min}</button>
    <button type="button" data-act="max" aria-label="Maximize window" title="Maximize / Restore"${off}>${ICON.max}</button>
    <button type="button" data-act="close" aria-label="Hide window" title="Hide"${off}>${ICON.close}</button>
  </div>
</header>
<div class="buffer-bar">
  <div class="buffer-tabs" role="tablist" aria-label="Open tabs"></div>
  <button type="button" class="icon-button" data-act="new" aria-label="New tab" title="New tab"${off}>+</button>
  <span class="buffer-state" role="status">Draft · local</span>
  <button type="button" class="icon-button" data-act="close-tab" aria-label="Close tab" title="Close this tab"${off}>×</button>
</div>
<div class="workspace">
  <section class="editor" aria-label="Writing surface">
    <div class="editor-source">
      <div class="redline-heading"><span class="title-line-number" aria-hidden="true">1</span><input class="note-title" aria-label="Note title" placeholder="Untitled" autocomplete="off" spellcheck="false"${field}><time class="heading-time"></time></div>
      <div class="editor-body">
        <div class="line-numbers" aria-hidden="true"><div class="line-number-content">1</div></div>
        <div class="active-line" aria-hidden="true"></div>
        <div class="text-surface">
          <pre class="syntax-layer" aria-hidden="true"><code></code></pre>
          <textarea class="note-input" aria-label="Note editor" placeholder="Let it out. Start anywhere." spellcheck="false" autocapitalize="sentences"${field}></textarea>
        </div>
      </div>
    </div>
    <article class="markdown-preview" aria-label="Markdown preview"${live ? ' tabindex="0"' : ''} hidden></article>
  </section>
</div>
<footer class="actionbar">
  <div class="footer-tools">
    <label class="syntax-control"><span>Syntax</span><select aria-label="Syntax language"${off}></select></label>
    <button type="button" class="footer-tool" data-act="lines" aria-pressed="true" title="Toggle line numbers"${off}>Line numbers</button>
    <button type="button" class="footer-tool" data-act="preview" aria-pressed="false" hidden${off}>Preview Markdown</button>
  </div>
  <button type="button" class="action action-save" data-act="save"${off}><kbd>${MOD} S</kbd><span>Save</span></button>
  <button type="button" class="action" data-act="copy"${off}><kbd>${MOD} Enter</kbd><span>Copy + clear</span></button>
  <span class="editor-stats">Ln 1, Col 1</span>
  <button type="button" class="action action-hide" data-act="close"${off}><kbd>Esc</kbd><span>Hide</span></button>
</footer>
<div class="toasts" aria-live="polite"></div>`;
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const blankTab = () => ({ text: '', syntax: 'auto', preview: false });
const PROSE = ['plaintext', 'markdown'];

export class Editor {
  constructor(win, { live = false, tabs, active = 0, design = 'scratch', onAction = () => {}, onChange = () => {} } = {}) {
    this.win = win;
    this.live = live;
    this.onAction = onAction;
    this.onChange = onChange;
    win.innerHTML = markup(live);
    const q = selector => win.querySelector(selector);
    this.el = {
      tabs: q('.buffer-tabs'), state: q('.buffer-state'), input: q('.note-input'), title: q('.note-title'),
      layer: q('.syntax-layer'), code: q('.syntax-layer code'), gutter: q('.line-number-content'),
      active: q('.active-line'), source: q('.editor-source'), preview: q('.markdown-preview'),
      select: q('.syntax-control select'), stats: q('.editor-stats'), lines: q('[data-act="lines"]'),
      previewButton: q('[data-act="preview"]'), toasts: q('.toasts'), clock: q('.clock'), time: q('.heading-time'),
    };
    this.tabs = (tabs?.length ? tabs : [blankTab()]).map(t => ({ text: String(t.text || ''), syntax: normalizeSyntax(t.syntax || 'auto'), preview: t.preview === true }));
    this.current = Math.max(0, Math.min(active, this.tabs.length - 1));
    this.language = 'plaintext';
    this.previewing = false;
    this.lineNumbers = true;
    this.wordWrap = true;
    this.redline = false;
    this.lastTarget = this.el.input;
    this.metricKey = '';
    this.heights = [];
    this.offsets = [];
    this.autotyping = false;
    this.el.select.innerHTML = '<option value="auto">Auto · Plain text</option>'
      + LANGUAGES.map(([id, name]) => `<option value="${id}">${escapeHtml(name)}</option>`).join('');
    win.dataset.design = design;
    win.dataset.lineNumbers = 'true';
    if (live) this.bind();
    this.clock();
    this.showTab();
    new ResizeObserver(() => { this.metricKey = ''; this.updateMetrics(); }).observe(this.el.input);
    window.addEventListener('settle:libraries', () => { if (!this.autotyping) this.refreshSyntax(); });
  }

  get tab() { return this.tabs[this.current]; }
  get source() { return this.tab.text; }

  /* ---------- layout, mirroring the app ---------- */

  layout() {
    const { input, title, layer } = this.el;
    const design = this.win.dataset.design;
    this.redline = design === 'redline' && this.language === 'plaintext';
    this.win.dataset.proseTitle = String(this.redline);
    this.win.dataset.code = String(!PROSE.includes(this.language));
    const source = this.source, split = source.indexOf('\n');
    title.value = split < 0 ? source : source.slice(0, split);
    input.value = this.redline ? (split < 0 ? '' : source.slice(split + 1)) : source;
    if (!this.redline) this.lastTarget = input;
    const wrap = this.wordWrap ? 'soft' : 'off';
    input.setAttribute('wrap', wrap);
    layer.style.whiteSpace = wrap === 'off' ? 'pre' : 'pre-wrap';
    this.metricKey = '';
  }

  paint() {
    const { input, layer, code } = this.el;
    const caret = this.autotyping && !(this.redline && !this.source.includes('\n'));
    const colored = this.language !== 'plaintext' || caret;
    code.innerHTML = highlight(input.value, this.language) + (caret ? '<span class="fake-caret"></span>' : '') + '\n';
    input.classList.toggle('highlighted', colored);
    layer.hidden = !colored;
    this.updateMetrics();
  }

  selection() {
    const target = this.lastTarget;
    const offset = this.redline && target === this.el.input ? this.el.title.value.length + 1 : 0;
    return [target.selectionStart + offset, target.selectionEnd + offset];
  }

  restoreSelection(start, end, focus = false) {
    const offset = this.redline ? this.el.title.value.length + 1 : 0;
    const target = this.redline && start < offset ? this.el.title : this.el.input;
    const shift = target === this.el.input ? offset : 0;
    if (focus) target.focus({ preventScroll: true });
    target.setSelectionRange(Math.max(0, start - shift), Math.max(0, end - shift));
    this.lastTarget = target;
  }

  refreshSyntax() {
    clearTimeout(this.timer);
    if (this.composing) return;
    const next = this.tab.syntax === 'auto' ? detectSyntax(this.source) : this.tab.syntax;
    if (next !== this.language) {
      const caret = this.selection(), scroll = [this.el.input.scrollTop, this.el.input.scrollLeft];
      const editing = document.activeElement === this.el.input || document.activeElement === this.el.title;
      this.language = next;
      this.layout();
      this.restoreSelection(...caret, editing);
      [this.el.input.scrollTop, this.el.input.scrollLeft] = scroll;
    }
    this.el.select.value = this.tab.syntax;
    this.el.select.options[0].textContent = `Auto · ${languageName(this.language)}`;
    this.win.dataset.language = this.language;
    this.el.previewButton.hidden = this.language !== 'markdown';
    if (this.language !== 'markdown' && this.previewing) this.setPreview(false);
    this.paint();
    if (this.previewing) renderMarkdown(this.source, this.el.preview);
  }

  changed() {
    const { input, title } = this.el;
    this.tab.text = this.redline ? title.value + (input.value || this.source.includes('\n') ? '\n' + input.value : '') : input.value;
    this.metricKey = '';
    // Show fresh text immediately while detection waits for a pause in typing.
    this.el.code.textContent = input.value + '\n';
    this.updateMetrics();
    this.renderTabTitle();
    this.onChange(this);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.refreshSyntax(), 100);
  }

  updateMetrics() {
    const { input, gutter, active, layer, stats, title } = this.el;
    if (this.previewing || !input.clientWidth) return;
    const lines = input.value.split('\n'), css = getComputedStyle(input);
    const leading = parseFloat(css.lineHeight);
    const design = this.win.dataset.design;
    const key = [input.clientWidth, css.fontSize, css.fontFamily, css.lineHeight, css.paddingLeft, input.getAttribute('wrap'), this.redline, design, input.value].join('|');
    if (key !== this.metricKey) {
      this.metricKey = key;
      if (input.getAttribute('wrap') === 'off') this.heights = lines.map(() => leading);
      else {
        // Measure logical lines so gutters stay correct even when prose wraps.
        const measure = document.createElement('div');
        Object.assign(measure.style, {
          position: 'fixed', visibility: 'hidden', pointerEvents: 'none', top: '0', left: '0',
          width: `${input.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight)}px`,
          fontFamily: css.fontFamily, fontSize: css.fontSize, fontWeight: css.fontWeight, fontStyle: css.fontStyle,
          lineHeight: css.lineHeight, letterSpacing: css.letterSpacing, tabSize: css.tabSize,
          whiteSpace: 'pre-wrap', overflowWrap: 'break-word', margin: '0', padding: '0', border: '0',
        });
        for (const line of lines) {
          const row = document.createElement('div');
          row.textContent = line || '​';
          measure.append(row);
        }
        document.body.append(measure);
        this.heights = [...measure.children].map(row => row.getBoundingClientRect().height);
        measure.remove();
      }
      let top = 0;
      this.offsets = this.heights.map(height => { const y = top; top += height; return y; });
      const pad = design === 'optic' ? 2 : 1;
      gutter.innerHTML = this.heights.map((height, i) => `<span style="height:${height}px">${String(i + 1 + (this.redline ? 1 : 0)).padStart(pad, '0')}</span>`).join('');
    }
    const before = input.value.slice(0, input.selectionStart), current = before.split('\n').length;
    const col = before.length - before.lastIndexOf('\n');
    gutter.querySelector('.current')?.classList.remove('current');
    gutter.children[current - 1]?.classList.add('current');
    gutter.style.transform = `translateY(${-input.scrollTop}px)`;
    active.style.top = `${parseFloat(css.paddingTop) + (this.offsets[current - 1] || 0) - input.scrollTop}px`;
    active.style.height = `${this.heights[current - 1] || leading}px`;
    stats.textContent = this.redline && document.activeElement === title
      ? `Ln 1, Col ${title.selectionStart + 1}`
      : `Ln ${current + (this.redline ? 1 : 0)}, Col ${col}`;
    layer.style.width = `${input.clientWidth}px`;
    layer.style.height = `${input.clientHeight}px`;
    layer.scrollTop = input.scrollTop;
    layer.scrollLeft = input.scrollLeft;
  }

  setPreview(enabled, persist = true) {
    this.previewing = Boolean(enabled && this.language === 'markdown');
    if (this.previewing) renderMarkdown(this.source, this.el.preview);
    this.el.source.hidden = this.previewing;
    this.el.preview.hidden = !this.previewing;
    this.el.previewButton.setAttribute('aria-pressed', String(this.previewing));
    this.el.previewButton.textContent = this.previewing ? 'Edit Markdown' : 'Preview Markdown';
    this.el.lines.disabled = this.previewing;
    if (persist) { this.tab.preview = this.previewing; this.onChange(this); }
    if (!this.previewing) this.updateMetrics();
  }

  /* ---------- tabs ---------- */

  showTab() {
    this.setPreview(false, false);
    this.language = this.tab.syntax === 'auto' ? detectSyntax(this.source) : this.tab.syntax;
    this.layout();
    this.refreshSyntax();
    this.setPreview(this.tab.preview && this.language === 'markdown', false);
    this.renderTabs();
  }

  renderTabs() {
    this.el.tabs.replaceChildren(...this.tabs.map((tab, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'buffer-tab';
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', String(i === this.current));
      button.tabIndex = this.live && i === this.current ? 0 : -1;
      button.textContent = button.title = tab.text.split('\n')[0].trim() || 'New note';
      if (this.live) button.onclick = () => this.switchTab(i);
      return button;
    }));
  }

  renderTabTitle() {
    const button = this.el.tabs.children[this.current];
    const title = this.source.split('\n')[0].trim() || 'New note';
    if (button && button.textContent !== title) button.textContent = button.title = title;
  }

  switchTab(index, focusTab = false) {
    if (index === this.current || !this.tabs[index]) return;
    this.current = index;
    this.showTab();
    this.onChange(this, { silent: true });
    if (focusTab) this.el.tabs.children[index]?.focus();
  }

  newTab() {
    this.tabs.push(blankTab());
    this.current = this.tabs.length - 1;
    this.showTab();
    this.onChange(this);
    this.focus();
  }

  closeTab() {
    this.tabs.splice(this.current, 1);
    if (!this.tabs.length) this.tabs.push(blankTab());
    this.current = Math.min(this.current, this.tabs.length - 1);
    this.showTab();
    this.onChange(this);
    this.focus();
  }

  setTabs(tabs, active = 0) {
    this.tabs = tabs.map(t => ({ text: t.text, syntax: normalizeSyntax(t.syntax || 'auto'), preview: false }));
    this.current = Math.min(active, this.tabs.length - 1);
    this.showTab();
  }

  /* ---------- actions ---------- */

  save() {
    if (!this.source.trim()) { this.toast('Write something first.'); this.focus(); return; }
    this.tab.text = '';
    this.tab.preview = false;
    this.showTab();
    this.toast('Note saved');
    this.onChange(this);
    this.focus();
  }

  async copyClear() {
    if (!this.source.trim()) { this.toast('Write something first.'); this.focus(); return; }
    try {
      await navigator.clipboard.writeText(this.source);
      this.tab.text = '';
      this.tab.preview = false;
      this.showTab();
      this.toast('Copied to clipboard');
      this.onChange(this);
    } catch {
      this.toast('Copy failed; your text is still here.');
    }
    this.focus();
  }

  toggleLineNumbers() {
    this.lineNumbers = !this.lineNumbers;
    this.win.dataset.lineNumbers = String(this.lineNumbers);
    this.el.lines.setAttribute('aria-pressed', String(this.lineNumbers));
    this.metricKey = '';
    this.updateMetrics();
  }

  toast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    this.el.toasts.append(toast);
    setTimeout(() => toast.remove(), 2700);
  }

  setState(message) { this.el.state.textContent = message; }

  setDesign(design) {
    if (this.win.dataset.design === design) return;
    const caret = this.selection(), scroll = [this.el.input.scrollTop, this.el.input.scrollLeft];
    this.win.dataset.design = design;
    this.layout();
    if (!this.autotyping) this.restoreSelection(...caret);
    [this.el.input.scrollTop, this.el.input.scrollLeft] = scroll;
    this.paint();
  }

  focus() {
    const target = this.previewing ? this.el.preview : this.redline && !this.source ? this.el.title : this.lastTarget;
    target.focus({ preventScroll: true });
  }

  clock() {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    this.el.clock.textContent = time;
    this.el.time.textContent = time;
    setTimeout(() => this.clock(), 60000 - (Date.now() % 60000));
  }

  bind() {
    const { input, title, select, tabs, preview } = this.el;
    this.win.addEventListener('click', e => {
      const button = e.target.closest('[data-act]');
      if (!button || !this.win.contains(button)) return;
      const act = button.dataset.act;
      if (act === 'new') this.newTab();
      else if (act === 'close-tab') this.closeTab();
      else if (act === 'lines') this.toggleLineNumbers();
      else if (act === 'preview') { this.refreshSyntax(); this.setPreview(!this.previewing); this.focus(); }
      else if (act === 'save') this.save();
      else if (act === 'copy') this.copyClear();
      else if (act === 'search') this.toast(`In the app, ${MOD} K searches every saved note.`);
      else if (act === 'history') this.toast(`In the app, ${MOD} Shift H opens your saved notes.`);
      else this.onAction(act, button);
    });
    this.win.addEventListener('keydown', e => {
      if (e.isComposing) return;
      const mod = isMod(e);
      if (e.key === 'Escape') { e.preventDefault(); this.onAction('close'); }
      else if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 's') { e.preventDefault(); this.save(); }
      else if (mod && e.key === 'Enter') { e.preventDefault(); this.copyClear(); }
      else if (e.shiftKey && !mod && e.key === 'Enter' && (e.target === input || e.target === title)) { e.preventDefault(); this.save(); }
      else if (mod && e.key === ',') {
        // Kiln keeps its gear in the rail, so anchor to whichever one is showing.
        e.preventDefault();
        const gear = [...this.win.querySelectorAll('[data-act="settings"]')].find(b => b.getClientRects().length);
        this.onAction('settings', gear);
      }
    });
    tabs.addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const next = (this.current + (e.key === 'ArrowRight' ? 1 : -1) + this.tabs.length) % this.tabs.length;
      this.switchTab(next, true);
    });
    select.addEventListener('change', () => {
      this.tab.syntax = normalizeSyntax(select.value);
      this.refreshSyntax();
      this.onChange(this);
      this.focus();
    });
    title.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.isComposing) {
        e.preventDefault();
        if (!this.source.includes('\n')) { this.tab.text += '\n'; this.onChange(this); }
        input.focus();
      }
    });
    input.addEventListener('focus', () => { this.lastTarget = input; this.onAction('focus'); });
    title.addEventListener('focus', () => { this.lastTarget = title; this.onAction('focus'); });
    input.addEventListener('input', () => this.changed());
    title.addEventListener('input', () => this.changed());
    for (const target of [input, title]) {
      target.addEventListener('compositionstart', () => { this.composing = true; clearTimeout(this.timer); });
      target.addEventListener('compositionend', () => { this.composing = false; clearTimeout(this.timer); this.timer = setTimeout(() => this.refreshSyntax(), 100); });
      ['click', 'keyup', 'scroll', 'select'].forEach(event => target.addEventListener(event, () => this.updateMetrics()));
    }
    preview.addEventListener('click', e => e.stopPropagation());
  }

  /* ---------- the window writes its own first note ---------- */

  async typeOut(text, { shouldStop = () => false } = {}) {
    this.autotyping = true;
    this.win.classList.add('is-autotyping');
    this.language = 'plaintext';
    for (let i = this.source.length + 1; i <= text.length; i++) {
      if (shouldStop()) break;
      this.tab.text = text.slice(0, i);
      this.layout();
      this.el.input.setSelectionRange(this.el.input.value.length, this.el.input.value.length);
      this.paint();
      this.renderTabTitle();
      const ch = text[i - 1], next = text[i];
      let wait = 16 + Math.random() * 34;
      if (ch === '\n') wait += next === '\n' ? 90 : 200 + Math.random() * 160;
      else if ('.,:;'.includes(ch)) wait += 120 + Math.random() * 160;
      else if (ch === ' ' && Math.random() < .06) wait += 110;
      await sleep(wait);
    }
    this.finishTyping(text);
  }

  finishTyping(text) {
    if (!this.autotyping) return;
    this.autotyping = false;
    this.win.classList.remove('is-autotyping');
    this.tab.text = text;
    this.layout();
    this.el.input.setSelectionRange(this.el.input.value.length, this.el.input.value.length);
    this.refreshSyntax();
    this.renderTabTitle();
  }
}
