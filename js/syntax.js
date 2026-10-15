// Same detection, highlighting and Markdown rules as the app (src/js/syntax.js),
// with the vendored libraries loaded lazily so the page paints first.
import { LANGUAGES } from './languages.js';

let lib = null;
let loading = null;

export function loadLibraries() {
  loading ||= import('../vendor/editor.js')
    .then(module => { lib = module; window.dispatchEvent(new Event('settle:libraries')); return module; })
    .catch(() => null);
  return loading;
}
export const librariesReady = () => Boolean(lib);

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const detectable = LANGUAGES.map(([id]) => id).filter(id => !['plaintext', 'markdown', 'ini', 'makefile'].includes(id));

export function detectSyntax(text) {
  const sample = text.slice(0, 10000);
  if (!sample.trim()) return 'plaintext';
  // Prefer explicit document markers over statistical guesses on prose.
  if (/^\s*[\[{]/.test(sample)) {
    try { JSON.parse(text); return 'json'; } catch { /* It may be unfinished code. */ }
  }
  if (/^ {0,3}(?:#{1,6}\s+\S|```|~~~|>\s+\S|[-*+] \[[ xX]\])/m.test(sample)
    || /\[[^\]\n]+\]\([^)\n]+\)|\*\*[^*\n]+\*\*/.test(sample)
    || /^(?: {0,3}[-*+] |\d+\. ).+\n(?: {0,3}[-*+] |\d+\. )/m.test(sample)) return 'markdown';
  if (!lib) return 'plaintext';
  const result = lib.hljs.highlightAuto(sample, detectable);
  return result.relevance >= 5 ? result.language || 'plaintext' : 'plaintext';
}

export function highlight(text, language) {
  if (!lib || language === 'plaintext' || !lib.hljs.getLanguage(language)) return escapeHtml(text);
  try { return lib.hljs.highlight(text, { language, ignoreIllegals: true }).value; }
  catch { return escapeHtml(text); }
}

export function renderMarkdown(text, target) {
  if (!lib) { target.textContent = text; return; }
  const { marked, DOMPurify } = lib;
  target.innerHTML = DOMPurify.sanitize(marked.parse(text, { gfm: true, async: false }), {
    ALLOWED_TAGS: ['p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'del', 's', 'blockquote', 'pre', 'code', 'ul', 'ol', 'li', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'input', 'details', 'summary'],
    ALLOWED_ATTR: ['href', 'title', 'alt', 'src', 'class', 'start', 'align', 'type', 'checked', 'disabled', 'open'],
    ALLOW_DATA_ATTR: false,
  });
  target.querySelectorAll('[class]').forEach(element => {
    const language = element.tagName === 'CODE' && [...element.classList].find(name => /^language-[\w-]+$/.test(name));
    if (language) element.className = language;
    else element.removeAttribute('class');
  });
  target.querySelectorAll('input').forEach(input => { input.type = 'checkbox'; input.disabled = true; });
  target.querySelectorAll('img').forEach(img => {
    if (!/^data:image\/(?:png|jpeg|gif|webp);base64,/i.test(img.getAttribute('src') || '')) {
      const alt = document.createElement('span');
      alt.className = 'preview-image'; alt.textContent = img.alt || 'Image';
      img.replaceWith(alt);
    }
  });
  target.querySelectorAll('a').forEach(link => {
    const href = link.getAttribute('href') || '';
    if (!/^(https?:|mailto:)/i.test(href)) link.removeAttribute('href');
    else { link.target = '_blank'; link.rel = 'noreferrer'; }
  });
  target.querySelectorAll('pre code').forEach(code => {
    const language = [...code.classList].find(c => c.startsWith('language-'))?.slice(9);
    if (language && lib.hljs.getLanguage(language)) code.innerHTML = highlight(code.textContent, language);
  });
}
