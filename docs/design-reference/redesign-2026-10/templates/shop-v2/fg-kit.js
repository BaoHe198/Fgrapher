// Runtime helpers for the Darkroom kit: "tráng ảnh" (develop), lightbox zoom (FLIP), card→hero morph, contrast.
(() => {
  if (window.fgKit) return;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const OUT = 'cubic-bezier(0,0,.2,1)', IN = 'cubic-bezier(.4,0,1,1)';
  const S = () => (window.fgKit && window.fgKit.slow) || 1;

  // ---- develop: images only, 400ms, stagger 60ms, max 6 ----
  let queue = [], timer = null;
  const flush = () => { timer = null; queue.forEach((im, i) => {
    const d = Math.min(i, 5) * 60;
    const a = im.animate([{ opacity: 0, filter: 'blur(6px) saturate(.3)' }, { opacity: 1, filter: 'blur(0) saturate(1)' }], { duration: 400, delay: d, easing: OUT, fill: 'backwards' });
    im.style.opacity = '';
    a.onfinish = () => { im.style.filter = ''; };
  }); queue = []; };
  const develop = im => {
    const go = () => { if (reduced() || !im.animate) { im.style.opacity = ''; return; } queue.push(im); if (!timer) timer = setTimeout(flush, 16); };
    if (im.complete && im.naturalWidth) go(); else { im.addEventListener('load', go, { once: true }); im.addEventListener('error', () => { im.style.opacity = ''; }, { once: true }); }
  };
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); develop(e.target); } }), { threshold: .15 });
  const seen = new WeakSet();
  const scan = () => document.querySelectorAll('img[data-dev]').forEach(im => { if (seen.has(im)) return; seen.add(im); if (im.complete && im.naturalWidth) return; if (!reduced()) im.style.opacity = '0'; io.observe(im); });
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', scan); scan();

  // ---- lightbox: grid image → full view. 280ms open ease-out, 260ms close ease-in ----
  function lightbox(src, opts = {}) {
    const group = opts.group || [src], label = opts.label || (i => String(i + 1).padStart(2, '0') + 'A');
    let i = Math.max(0, group.indexOf(src)), cur = src;
    const R = reduced(), mob = innerWidth < 768;
    const root = document.createElement('div');
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Xem ảnh');
    root.style.cssText = 'position:fixed;inset:0;z-index:1000;touch-action:none';
    const bg = document.createElement('div'); bg.style.cssText = 'position:absolute;inset:0;background:var(--dr-bg)';
    const img = document.createElement('img'); img.alt = cur.alt || '';
    img.style.cssText = 'position:fixed;left:0;top:0;transform-origin:0 0;will-change:transform;user-select:none;-webkit-user-drag:none;box-shadow:0 0 0 1px var(--dr-line)';
    const chrome = document.createElement('div');
    chrome.style.cssText = 'position:absolute;inset:0;pointer-events:none;visibility:hidden;font-family:var(--font-body);color:var(--dr-text)';
    const btn = 'pointer-events:auto;min-width:44px;min-height:44px;display:grid;place-items:center;border:1px solid var(--dr-line-2);border-radius:999px;background:var(--dr-surface);color:var(--dr-text);font:600 14px/1 var(--font-body);cursor:pointer;padding:0 14px';
    chrome.innerHTML = `<div style="position:absolute;left:0;right:0;top:0;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:${mob ? '12px 16px' : '20px 28px'}"><span data-k="n" style="font:600 12px/1 var(--font-mono);letter-spacing:.12em;color:var(--dr-text-2)"></span><button type="button" data-k="x" aria-label="Đóng" style="${btn}">Đóng</button></div>` +
      (group.length > 1 ? `<button type="button" data-k="p" aria-label="Ảnh trước" style="${btn};position:absolute;left:${mob ? 8 : 24}px;top:50%;margin-top:-22px;padding:0">‹</button><button type="button" data-k="f" aria-label="Ảnh sau" style="${btn};position:absolute;right:${mob ? 8 : 24}px;top:50%;margin-top:-22px;padding:0">›</button>` : '') +
      `<div style="position:absolute;left:0;right:0;bottom:0;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 16px;padding:${mob ? '12px 16px 20px' : '20px 28px'};font:500 14px/1.4 var(--font-body);color:var(--dr-text-2)"><span data-k="c"></span><div data-k="a" style="display:flex;gap:8px;pointer-events:auto"></div></div>`;
    root.append(bg, img, chrome); document.body.append(root);
    const q = k => chrome.querySelector(`[data-k="${k}"]`);
    const setMeta = () => { q('n').textContent = opts.meta ? opts.meta(i, cur, group.length) : `KHUNG ${label(i)} · ${String(i + 1).padStart(2, '0')}/${String(group.length).padStart(2, '0')}`; q('c').textContent = cur.dataset.caption || ''; const A = q('a'); if (A && opts.actions) { A.innerHTML = ''; opts.actions(cur).forEach(x => { const el = document.createElement('button'); el.type = 'button'; el.textContent = x.label; el.style.cssText = btn + (x.primary ? ';background:var(--dr-accent);color:var(--gold-900);border-color:transparent' : ''); el.onclick = () => { x.onClick && x.onClick(); close(); }; A.append(el); }); } };
    const fit = () => { const pad = mob ? 12 : 72, top = mob ? 68 : 84, W = innerWidth - pad * 2, H = innerHeight - top * 2; const ar = (cur.naturalWidth || 3) / (cur.naturalHeight || 2); let w = W, h = w / ar; if (h > H) { h = H; w = h * ar; } return { x: (innerWidth - w) / 2, y: (innerHeight - h) / 2, w, h }; };
    const place = r => { img.style.width = r.w + 'px'; img.style.height = r.h + 'px'; img.style.transform = `translate(${r.x}px,${r.y}px)`; };
    const invert = (from, to) => `translate(${from.left}px,${from.top}px) scale(${from.width / to.w},${from.height / to.h})`;
    img.src = cur.currentSrc || cur.src; setMeta();
    let end = fit(); place(end);
    const first = cur.getBoundingClientRect(); cur.style.visibility = 'hidden';
    const prevFocus = document.activeElement;
    const showChrome = () => { chrome.style.visibility = 'visible'; q('x').focus({ preventScroll: true }); };
    if (R) showChrome(); else {
      bg.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 280 * S(), easing: OUT });
      img.animate([{ transform: invert(first, end) }, { transform: `translate(${end.x}px,${end.y}px)` }], { duration: 280 * S(), easing: OUT }).onfinish = showChrome;
    }
    let closing = false;
    const close = () => {
      if (closing) return; closing = true; chrome.style.visibility = 'hidden';
      const to = cur.getBoundingClientRect();
      const done = () => { cur.style.visibility = ''; root.remove(); removeEventListener('keydown', key); prevFocus && prevFocus.focus && prevFocus.focus({ preventScroll: true }); opts.onClose && opts.onClose(); };
      if (R || !to.width) return done();
      const from = getComputedStyle(img).transform;
      bg.animate([{ opacity: getComputedStyle(bg).opacity }, { opacity: 0 }], { duration: 260 * S(), easing: OUT, fill: 'forwards' });
      img.animate([{ transform: from }, { transform: invert(to, end) }], { duration: 260 * S(), easing: OUT, fill: 'forwards' }).onfinish = done;
    };
    const go = d => {
      if (group.length < 2) return; cur.style.visibility = ''; i = (i + d + group.length) % group.length; cur = group[i]; cur.style.visibility = 'hidden';
      img.src = cur.currentSrc || cur.src; img.alt = cur.alt || ''; end = fit(); place(end); setMeta();
      if (!R) img.animate([{ opacity: 0, transform: `translate(${end.x + d * 24}px,${end.y}px)` }, { opacity: 1, transform: `translate(${end.x}px,${end.y}px)` }], { duration: 320, easing: OUT });
    };
    const key = e => { if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1); else if (e.key === 'Tab') { const b = [...chrome.querySelectorAll('button')]; const k = b.indexOf(document.activeElement); e.preventDefault(); b[(k + (e.shiftKey ? -1 : 1) + b.length) % b.length].focus(); } };
    addEventListener('keydown', key);
    q('x').onclick = close; if (q('p')) { q('p').onclick = () => go(-1); q('f').onclick = () => go(1); }
    bg.onclick = close;
    // swipe down to close
    let y0 = null;
    let x0 = null;
    img.onpointerdown = e => { y0 = e.clientY; x0 = e.clientX; img.setPointerCapture(e.pointerId); };
    img.onpointermove = e => { if (y0 == null) return; const dx = e.clientX - x0, dy = Math.max(0, e.clientY - y0); if (Math.abs(dx) > dy) { img.style.transform = `translate(${end.x + dx}px,${end.y}px)`; return; } img.style.transform = `translate(${end.x}px,${end.y + dy}px)`; bg.style.opacity = String(1 - Math.min(dy / 400, .7)); };
    img.onpointerup = e => { if (y0 == null) return; const dx = e.clientX - x0, dy = e.clientY - y0; y0 = x0 = null; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) { place(end); return go(dx < 0 ? 1 : -1); } if (dy > 120) return close(); if (Math.abs(dy) < 4 && Math.abs(dx) < 4 && e.pointerType === 'mouse') return; bg.style.opacity = ''; if (!R) img.animate([{ transform: img.style.transform }, { transform: `translate(${end.x}px,${end.y}px)` }], { duration: 200, easing: OUT }); place(end); };
    return close;
  }

  // ---- morph: one element flies from `from` rect to `to` rect (card image → profile header) ----
  function morph(from, to, { duration = 300, onDone } = {}) {
    const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
    if (reduced() || !document.body.animate) { onDone && onDone(); return; }
    const c = document.createElement('img'); c.src = (from.querySelector('img') || from).currentSrc || from.src;
    const rs = getComputedStyle(from).borderRadius, rt = getComputedStyle(to).borderRadius;
    c.style.cssText = `position:fixed;z-index:999;object-fit:cover;pointer-events:none;left:${a.left}px;top:${a.top}px;width:${a.width}px;height:${a.height}px;border-radius:${rs}`;
    document.body.append(c);
    c.animate([{ left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px', borderRadius: rs }, { left: b.left + 'px', top: b.top + 'px', width: b.width + 'px', height: b.height + 'px', borderRadius: rt }], { duration: duration * S(), easing: OUT, fill: 'forwards' }).onfinish = () => { onDone && onDone(); requestAnimationFrame(() => c.remove()); };
  }

  // ---- contrast of two CSS colours resolved inside `el` (alpha composited over bg) ----
  const probe = (el, v) => { const s = document.createElement('span'); s.style.color = v; el.append(s); const m = getComputedStyle(s).color.match(/[\d.]+/g).map(Number); s.remove(); return m; };
  const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  function contrast(el, fg, bg) { const B = probe(el, bg), F = probe(el, fg), a = F[3] == null ? 1 : F[3]; const mix = [0, 1, 2].map(k => F[k] * a + B[k] * (1 - a)); const l1 = lum(mix), l2 = lum(B); return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05); }

  function paintSeg(root) { (root || document).querySelectorAll('[data-seg]').forEach(b => { const on = b.getAttribute('aria-pressed') === 'true'; b.style.background = on ? 'var(--brand-primary)' : 'transparent'; b.style.color = on ? 'var(--text-on-brand)' : 'var(--text-primary)'; }); }
  window.fgKit = { slow: 1, paintSeg, reduced, lightbox, morph, contrast, scan, OUT, IN };
})();
