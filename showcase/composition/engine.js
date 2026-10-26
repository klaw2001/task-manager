/* Showcase engine — every frame is a pure function of time t (seconds). */
"use strict";

const SW = 1920, SH = 1080, OVERLAP = 0.5;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const E = {
  lin: (t) => t,
  in: (t) => t * t * t,
  out: (t) => 1 - Math.pow(1 - t, 3),
  io: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  soft: (t) => t * t * t * (t * (t * 6 - 15) + 10),
  expo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  back: (t) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};
const seg = (t, a, b, e = E.io) => (b === a ? (t >= b ? 1 : 0) : e(clamp((t - a) / (b - a))));

function mix(a, b, p) {
  if (typeof a === "number") return a + (b - a) * p;
  const o = {};
  for (const k in b) o[k] = typeof b[k] === "number" && typeof a[k] === "number" ? a[k] + (b[k] - a[k]) * p : b[k];
  return o;
}
/** Keyframe track: [[t, value, ease?], …] — value is a number or an object of numbers. */
function track(keys) {
  return (u) => {
    if (u <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, e] = keys[i], [t0, v0] = keys[i - 1];
      if (u <= t1) return mix(v0, v1, (e || E.io)(clamp((u - t0) / (t1 - t0))));
    }
    return keys[keys.length - 1][1];
  };
}
const step = (keys) => (u) => { let v = keys[0][1]; for (const [t, x] of keys) if (u >= t) v = x; return v; };

const M = () => window.MANIFEST;
/** Rect of a named element inside a captured frame: [x, y, w, h] in app CSS px. */
function R(img, key, pad = 0) {
  const r = M()[img]?.rects?.[key];
  if (!r) throw new Error(`no rect ${img}.${key}`);
  return [r.x - pad, r.y - pad, r.w + pad * 2, r.h + pad * 2];
}
const mid = (r) => [r[0] + r[2] / 2, r[1] + r[3] / 2];

function h(tag, cls, parent, css) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (css) Object.assign(e.style, css);
  if (parent) parent.appendChild(e);
  return e;
}

const PENDING = new Set();
function loadImg(src, parent) {
  const im = new Image();
  im.decoding = "async";
  im.src = src;
  parent.appendChild(im);
  PENDING.add(im);
  return im;
}
const ASSET = (name) => `../assets/${name}.png`;

/* ───────────────────────── app window ───────────────────────── */
const CURSOR_SVG = `<svg width="30" height="34" viewBox="0 0 30 34" xmlns="http://www.w3.org/2000/svg"><path d="M3 2v26l7-6.6 4.6 10.6 5-2.2-4.6-10.4H25z" fill="#fff" stroke="#0b0b10" stroke-width="2.2" stroke-linejoin="round"/></svg>`;

/**
 * o: { w,h, ox,oy (image origin offset), chrome, dark, base (scale at zoom 1), cam, anchor, scroll, theme, urls,
 *      layers:[], rings:[], spot, callouts:[], cursor:[], fx }
 */
function Win(parent, o, ctx) {
  const W = o.w || 1440, H = o.h || 900, CH = o.chrome === false ? 0 : 44;
  const ox = o.ox || 0, oy = o.oy || 0;
  const base = o.base ?? 0.85;
  const holder = h("div", "", parent, { position: "absolute", inset: "0", perspective: "2600px", perspectiveOrigin: "50% 45%" });
  const el = h("div", "win", holder);
  el.style.width = W + "px"; el.style.height = H + "px";
  const frame = h("div", "frame" + (CH ? "" : " bare"), el, { top: -CH + "px", height: H + CH + "px" });
  if (o.radius != null) frame.style.borderRadius = o.radius + "px";
  let chrome = null, urlEl = null;
  if (CH) {
    chrome = h("div", "chrome", frame);
    h("i", "", chrome); h("i", "", chrome); h("i", "", chrome);
    urlEl = h("div", "url", chrome);
  }
  const vp = h("div", "vp", frame, { top: CH + "px" });
  const over = h("div", "over", el);

  const cam = typeof o.cam === "function" ? o.cam : track(o.cam || [[0, { z: 1, x: W / 2, y: H / 2 }]]);
  const anchor = typeof o.anchor === "function" ? o.anchor : o.anchor ? track(o.anchor) : () => ({ x: 1250, y: 575 });
  const scroll = typeof o.scroll === "function" ? o.scroll : o.scroll ? track(o.scroll) : () => 0;
  const fx = typeof o.fx === "function" ? o.fx : o.fx ? track(o.fx) : () => ({ op: 1, blur: 0, sc: 1, dx: 0, dy: 0 });
  const theme = typeof o.theme === "function" ? o.theme : o.theme ? track(o.theme) : () => (o.dark ? 1 : 0);
  const urls = o.urls ? step(o.urls) : () => "";
  const dry = ctx && ctx.dry;

  /* image layers */
  const layers = [];
  const addImg = (name, parentEl, x, y) => {
    if (dry) return null;
    const im = loadImg(ASSET(name), parentEl);
    const m = M()[name];
    im.style.width = m.w + "px"; im.style.height = m.h + "px";
    im.style.left = x + "px"; im.style.top = y + "px";
    return im;
  };
  for (const d of o.layers || []) {
    const L = { d, el: h("div", "layer", vp) };
    L.el.style.width = W + "px"; L.el.style.height = H + "px"; L.el.style.overflow = "hidden";
    if (d.page) {
      const top = d.page + "-top", full = d.page + "-full";
      const hdr = d.hdr ?? 48, sb = d.sb ?? 240;
      L.kind = "page";
      L.content = h("div", "", L.el, { position: "absolute", left: "0", top: "0", width: W + "px", height: H + "px", clipPath: `inset(${hdr}px 0 0 ${sb}px)` });
      L.fullImg = addImg(full, L.content, ox, oy);
      L.hdr = h("div", "", L.el, { position: "absolute", left: "0", top: "0", width: W + "px", height: H + "px", clipPath: `inset(0 0 ${H - hdr}px 0)` });
      addImg(top, L.hdr, ox, oy);
      if (sb) {
        L.sb = h("div", "", L.el, { position: "absolute", left: "0", top: "0", width: W + "px", height: H + "px", clipPath: `inset(0 ${W - sb}px 0 0)` });
        addImg(top, L.sb, ox, oy);
      }
      L.maxScroll = Math.max(0, (M()[full]?.h || H) - H);
    } else if (d.free) {
      // a free-floating cut-out (e.g. the dragged Kanban card) moved by the layer's track
      L.kind = "free";
      const m = M()[d.img];
      L.inner = h("div", "", L.el, { position: "absolute", left: "0", top: "0", width: m.w + "px", height: m.h + "px", transformOrigin: "50% 50%", filter: "drop-shadow(0 18px 28px rgba(0,0,0,.35)) drop-shadow(0 4px 8px rgba(0,0,0,.2))" });
      if (!dry) { const im = loadImg(ASSET(d.img), L.inner); im.style.width = m.w + "px"; im.style.height = m.h + "px"; im.style.left = "0"; im.style.top = "0"; }
    } else {
      L.kind = "img";
      const clip = d.clip;
      if (clip) L.el.style.clipPath = `inset(${clip[1]}px ${W - clip[2]}px ${H - clip[3]}px ${clip[0]}px)`;
      L.inner = h("div", "", L.el, { position: "absolute", left: "0", top: "0", width: W + "px", height: H + "px" });
      addImg(d.img, L.inner, ox + (d.x || 0), oy + (d.y || 0));
    }
    if (d.tr) L.tr = typeof d.tr === "function" ? d.tr : track(d.tr);
    layers.push(L);
  }

  /* focus rings */
  const rings = (o.rings || []).map((d) => ({ d, el: h("div", "ring" + (d.tone ? " " + d.tone : ""), over) }));
  /* spotlight (moving rect with opacity) */
  const spot = o.spot ? { f: typeof o.spot === "function" ? o.spot : track(o.spot), el: h("div", "spot", over) } : null;
  /* callouts */
  const callouts = (o.callouts || []).map((d) => {
    const c = h("div", "callout" + (d.tone ? " " + d.tone : ""), over);
    const dx = d.dx ?? 90, dy = d.dy ?? -70;
    c.innerHTML = `<svg width="1" height="1"><line x1="0" y1="0" x2="${dx}" y2="${dy}" stroke="${d.tone === "danger" ? "#ff6b6b" : d.tone === "ok" ? "#4ade80" : d.tone === "warn" ? "#fbbf24" : "#8b8dff"}" stroke-width="3" stroke-linecap="round"/></svg><div class="dot"></div>`;
    const pill = h("div", "pill", c); pill.textContent = d.text;
    pill.style.left = dx + "px"; pill.style.top = dy + "px";
    if (d.size) pill.style.fontSize = d.size + "px";
    ctx && ctx.ev(d.from, "tick");
    return { d, el: c, pill, line: c.querySelector("line") };
  });
  /* cursor */
  const cur = o.cursor ? o.cursor : null;
  let curEl = null, ripples = [];
  if (cur) {
    curEl = h("div", "cursor", over); curEl.innerHTML = CURSOR_SVG;
    for (const k of cur) if (k[3] === "c") { ripples.push({ t: k[0], x: k[1], y: k[2], el: h("div", "ripple", over) }); ctx && ctx.ev(k[0], "click"); }
  }

  const chromeColors = (m) => {
    const c = (a, b) => `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], m))).join(",")})`;
    chrome.style.background = c([242, 242, 244], [28, 28, 32]);
    chrome.style.borderBottomColor = c([221, 221, 224], [50, 50, 56]);
    urlEl.style.background = c([226, 226, 230], [44, 44, 50]);
    urlEl.style.color = c([88, 88, 96], [170, 170, 180]);
    frame.style.background = c([255, 255, 255], [25, 25, 25]);
  };

  function pos(p, sy, scr) { return [p[0], p[1] - (scr ? sy : 0)]; }

  function update(u) {
    const c = cam(u), a = Object.assign({}, anchor(u)), f = fx(u), sy = scroll(u);
    const k = base * c.z * (f.sc || 1);
    // When zoomed in far enough that the window overflows the frame, keep it covering the frame vertically
    // (no dead band above or below the window).
    if (H * k > 880) {
      const top = a.y - c.y * k, bot = a.y + (H - c.y) * k;
      let ay = a.y;
      if (top > 150) ay -= top - 150;
      else if (bot < 1010) ay += 1010 - bot;
      a.y = ay;
    }
    el.style.transform = `translate3d(${a.x + (f.dx || 0)}px,${a.y + (f.dy || 0)}px,0) rotateX(${c.rx || 0}deg) rotateY(${c.ry || 0}deg) rotate(${c.rz || 0}deg) scale(${k}) translate3d(${-c.x}px,${-c.y}px,0)`;
    holder.style.opacity = f.op ?? 1;
    holder.style.filter = f.blur > 0.05 ? `blur(${f.blur}px)` : "none";
    if (chrome) { chromeColors(theme(u)); urlEl.innerHTML = `<b>northwind.example</b>${urls(u)}`; }

    for (const L of layers) {
      const d = L.d;
      let op = d.fade === 0 ? (u >= d.from ? 1 : 0) : seg(u, d.from, d.from + (d.fade ?? 0.3), E.out);
      if (d.to != null) op *= 1 - seg(u, d.to, d.to + (d.fadeOut ?? d.fade ?? 0.3));
      const show = op > 0.002;
      L.el.style.display = show ? "block" : "none";
      if (!show) continue;
      L.el.style.opacity = op;
      if (L.kind === "page") L.fullImg && (L.fullImg.style.transform = `translate3d(0,${-clamp(sy, 0, L.maxScroll)}px,0)`);
      if (L.tr) { const t = L.tr(u); L.inner.style.transform = `translate3d(${t.x || 0}px,${t.y || 0}px,0) rotate(${t.r || 0}deg) scale(${t.s ?? 1})`; if (t.o != null) L.el.style.opacity = op * t.o; }
    }
    for (const r of rings) {
      const d = r.d, on = seg(u, d.from, d.from + 0.35, E.out) * (1 - seg(u, d.to ?? 1e9, (d.to ?? 1e9) + 0.3));
      r.el.style.display = on > 0.01 ? "block" : "none";
      if (on <= 0.01) continue;
      const p = d.rect, pad = d.pad ?? 6, y = p[1] - (d.s ? sy : 0);
      const grow = lerp(14, 0, E.out(clamp(on)));
      r.el.style.opacity = on;
      r.el.style.left = p[0] - pad - grow + "px"; r.el.style.top = y - pad - grow + "px";
      r.el.style.width = p[2] + (pad + grow) * 2 + "px"; r.el.style.height = p[3] + (pad + grow) * 2 + "px";
      if (d.r != null) r.el.style.borderRadius = d.r + "px";
    }
    if (spot) {
      const s = spot.f(u);
      const yy = s.y - (o.spotScroll ? sy : 0);
      spot.el.style.display = s.o > 0.01 ? "block" : "none";
      spot.el.style.opacity = s.o;
      spot.el.style.left = s.x + "px"; spot.el.style.top = yy + "px"; spot.el.style.width = s.w + "px"; spot.el.style.height = s.h + "px";
      if (s.r != null) spot.el.style.borderRadius = s.r + "px";
    }
    for (const co of callouts) {
      const d = co.d, on = seg(u, d.from, d.from + 0.45, E.back) * (1 - seg(u, d.to ?? 1e9, (d.to ?? 1e9) + 0.3));
      co.el.style.display = on > 0.01 ? "block" : "none";
      if (on <= 0.01) continue;
      const p = pos(d.at, sy, d.s), inv = 1 / k;
      co.el.style.opacity = clamp(on);
      co.el.style.transform = `translate3d(${p[0]}px,${p[1]}px,0) scale(${inv})`;
      co.pill.style.transform = `translate(-50%,-50%) scale(${lerp(0.82, 1, clamp(on))})`;
      co.line.setAttribute("stroke-dasharray", "300"); co.line.setAttribute("stroke-dashoffset", String(300 * (1 - clamp(on))));
    }
    if (cur) {
      const cu = (() => {
        if (u <= cur[0][0]) return cur[0];
        for (let i = 1; i < cur.length; i++) if (u <= cur[i][0]) {
          const [t0, x0, y0] = cur[i - 1], [t1, x1, y1] = cur[i];
          const p = E.io(clamp((u - t0) / (t1 - t0)));
          const dx = x1 - x0, dy = y1 - y0, dist = Math.hypot(dx, dy);
          const bow = Math.sin(Math.PI * p) * dist * 0.05;
          return [u, x0 + dx * p - (dy / (dist || 1)) * bow, y0 + dy * p + (dx / (dist || 1)) * bow];
        }
        return cur[cur.length - 1];
      })();
      const vis = seg(u, cur[0][0] - 0.3, cur[0][0], E.out) * (1 - seg(u, cur[cur.length - 1][0] + 0.2, cur[cur.length - 1][0] + 0.6));
      const pressed = ripples.some((r) => u >= r.t && u < r.t + 0.16);
      const inv = 1 / k;
      curEl.style.display = vis > 0.01 ? "block" : "none";
      curEl.style.opacity = vis;
      const sc = inv * (pressed ? 0.88 : 1);
      curEl.style.transform = `translate3d(${cu[1]}px,${cu[2]}px,0) scale(${sc})`;
      for (const r of ripples) {
        const age = (u - r.t) / 0.55, on = age >= 0 && age <= 1;
        r.el.style.display = on ? "block" : "none";
        if (!on) continue;
        const rad = lerp(6, 40, E.out(age)) * inv;
        r.el.style.opacity = 1 - age;
        r.el.style.width = r.el.style.height = rad * 2 + "px";
        r.el.style.transform = `translate3d(${r.x - rad}px,${r.y - rad}px,0)`;
        r.el.style.borderWidth = 3 * inv + "px";
      }
    }
  }
  return { el, holder, update, base, W, H, vp, over };
}

/* ───────────────────────── title block ───────────────────────── */
function splitWords(root, html) {
  root.innerHTML = html;
  const walk = (node, cls) => {
    for (const n of [...node.childNodes]) {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((tok) => {
          if (!tok) return;
          if (/^\s+$/.test(tok)) frag.appendChild(document.createTextNode(" "));
          else { const s = h("span", "w " + cls); s.textContent = tok; frag.appendChild(s); }
        });
        node.replaceChild(frag, n);
      } else if (n.nodeType === 1 && n.tagName !== "BR") {
        const c = (cls + " " + n.className).trim();
        walk(n, c);
        const kids = [...n.childNodes]; kids.forEach((x) => node.insertBefore(x, n)); node.removeChild(n);
      }
    }
  };
  walk(root, "");
  return [...root.querySelectorAll(".w")];
}

/**
 * o: { n, eyebrow, html, lines, sub, bullets:[[u,text]], intro:'big'|'quick', bigHold, bx, tB }
 */
function Title(root, o) {
  const lines = o.lines || 2, intro = o.intro || "big";
  const tB = o.tB ?? 1.5; // moment the big title starts to dock
  const wrap = h("div", "tw", root, { position: "absolute", inset: "0", pointerEvents: "none" });
  root = wrap;
  const scrim = h("div", "scrim-l", root);
  const eb = h("div", "eyebrow", root, { position: "absolute", left: "0", top: "0" });
  eb.innerHTML = `<span class="n">${o.n}</span><span class="bar"></span><span>${o.eyebrow}</span>`;
  const t = h("div", "title", root);
  const h1 = h("div", "h1", t);
  const words = splitWords(h1, o.html);
  const sub = o.sub ? h("div", "sub", root) : null;
  if (sub) sub.textContent = o.sub;
  const ul = o.bullets ? h("ul", "bullets", root) : null;
  const lis = (o.bullets || []).map(([, txt]) => { const li = h("li", "", ul); li.innerHTML = txt; return li; });

  const CY = 84, TY = 131, S = 0.4;
  const subTop = TY + lines * 48.4 + 18;
  const subH = sub ? sub.offsetHeight || 80 : 0;
  if (sub) sub.style.top = subTop + "px";
  if (ul) ul.style.top = subTop + subH + 30 + "px";
  const bx = o.bx ?? 150, by = o.by ?? 500 - lines * 62;

  function update(u) {
    const dock = intro === "quick" ? 1 : seg(u, tB, tB + 0.8, E.io);
    // title position/scale
    const x = lerp(bx, 96, dock), y = lerp(by, TY, dock), s = lerp(1, S, dock);
    h1.parentNode.style.transform = `translate3d(${x}px,${y}px,0) scale(${s})`;
    eb.style.transform = `translate3d(${lerp(bx, 96, dock)}px,${lerp(by - 62, CY, dock)}px,0)`;
    // word reveal
    const t0 = intro === "quick" ? 0.05 : 0.2;
    words.forEach((w, i) => {
      const p = seg(u, t0 + i * 0.07, t0 + i * 0.07 + 0.7, E.out);
      w.style.opacity = p; w.style.transform = `translate3d(0,${(1 - p) * 46}px,0)`; w.style.filter = p < 0.98 ? `blur(${(1 - p) * 10}px)` : "none";
    });
    eb.style.opacity = seg(u, t0 - 0.05, t0 + 0.5, E.out);
    scrim.style.opacity = dock;
    if (sub) { const p = seg(u, tB + 0.45, tB + 1.1, E.out); sub.style.opacity = intro === "quick" ? seg(u, 0.3, 0.9, E.out) : p; sub.style.transform = `translate3d(0,${(1 - (intro === "quick" ? seg(u, 0.3, 0.9, E.out) : p)) * 14}px,0)`; }
    (o.bullets || []).forEach(([bt], i) => {
      const p = seg(u, bt, bt + 0.55, E.out);
      lis[i].style.opacity = p; lis[i].style.transform = `translate3d(${(1 - p) * -18}px,0,0)`;
    });
  }
  return { update, big: intro === "big", tB };
}

/* ───────────────────────── global layers ───────────────────────── */
const SCENES = [];
let TOTAL = 0;
function defineScene(sc) { SCENES.push(sc); }
function layout() {
  let t = 0;
  SCENES.forEach((s, i) => { s.start = i ? t - OVERLAP : 0; t = s.start + s.dur; });
  TOTAL = t;
  window.TOTAL = TOTAL;
}

const G = {};
function initGlobal() {
  const stage = document.getElementById("stage");
  G.bg = h("div", "", stage); G.bg.id = "bg";
  G.g1 = h("div", "glow", G.bg, { width: "1500px", height: "1500px", left: "-500px", top: "-700px" });
  G.g2 = h("div", "glow", G.bg, { width: "1700px", height: "1700px", left: "1000px", top: "300px" });
  G.g3 = h("div", "glow", G.bg, { width: "1100px", height: "1100px", left: "600px", top: "-200px" });
  h("div", "dots", G.bg);
  G.scenes = h("div", "", stage, { position: "absolute", inset: "0" });
  G.mark = h("div", "", stage); G.mark.id = "mark";
  G.mark.innerHTML = `<div class="logo">T</div><span>Task Manager</span>`;
  G.progress = h("div", "", stage); G.progress.id = "progress"; G.pbar = h("i", "", G.progress);
  G.vig = h("div", "", stage); G.vig.id = "vignette";
  G.grain = h("div", "", stage); G.grain.id = "grain";
  G.flash = h("div", "", stage); G.flash.id = "flash";
  G.fade = h("div", "", stage, { position: "absolute", inset: "0", background: "#000", opacity: "1", pointerEvents: "none" });
}
const TONES = [ // [t, [r,g,b] for glow1, glow2, glow3]
  [0, [[99, 102, 241], [139, 92, 246], [56, 189, 248]]],
  [30, [[99, 102, 241], [168, 85, 247], [14, 165, 233]]],
  [90, [[16, 185, 129], [99, 102, 241], [236, 72, 153]]],
  [200, [[99, 102, 241], [217, 70, 239], [56, 189, 248]]],
];
function tone(t) {
  let a = TONES[0], b = TONES[TONES.length - 1];
  for (let i = 1; i < TONES.length; i++) if (t <= TONES[i][0]) { a = TONES[i - 1]; b = TONES[i]; break; }
  const p = clamp((t - a[0]) / (b[0] - a[0] || 1));
  return a[1].map((c, i) => c.map((v, j) => Math.round(lerp(v, b[1][i][j], p))));
}
function updateGlobal(t) {
  const [c1, c2, c3] = tone(t), s = Math.sin, a = G.bgBoost ?? 1;
  const glow = (el, c, al) => (el.style.background = `radial-gradient(circle, rgba(${c},${al * a}) 0%, rgba(${c},0) 62%)`);
  glow(G.g1, c1, 0.34); glow(G.g2, c2, 0.28); glow(G.g3, c3, 0.14);
  G.g1.style.transform = `translate3d(${s(t * 0.21) * 90}px,${Math.cos(t * 0.17) * 70}px,0)`;
  G.g2.style.transform = `translate3d(${Math.cos(t * 0.19) * 110}px,${s(t * 0.15) * 80}px,0)`;
  G.g3.style.transform = `translate3d(${s(t * 0.13 + 2) * 140}px,${Math.cos(t * 0.23) * 60}px,0)`;
  G.grain.style.transform = `translate3d(${(Math.floor(t * 24) * 53) % 40}px,${(Math.floor(t * 24) * 31) % 40}px,0)`;
  const brandIn = seg(t, 8.6, 9.6, E.out) * (1 - seg(t, TOTAL - 7.2, TOTAL - 6.2));
  G.mark.style.opacity = brandIn * 0.9;
  G.pbar.style.width = clamp(t / TOTAL) * 100 + "%";
  G.progress.style.opacity = seg(t, 1, 2) * (1 - seg(t, TOTAL - 2.5, TOTAL - 1.2));
  G.fade.style.opacity = Math.max(1 - seg(t, 0, 0.5, E.out), seg(t, TOTAL - 1.0, TOTAL, E.io));
}

/* ───────────────────────── scheduler ───────────────────────── */
const PRE = 0.1, POST = 0.1;
function ensureBuilt(sc, dry) {
  if (sc.built) return;
  sc.root = h("div", "scene", G.scenes);
  sc.events = [];
  const ctx = { root: sc.root, dry: !!dry, scene: sc, ev: (u, type) => sc.events.push({ t: sc.start + u, type }) };
  sc.inst = sc.build(ctx);
  sc.built = true;
}
function dispose(sc) {
  if (!sc.built) return;
  sc.root.remove(); sc.built = false; sc.inst = null; sc.root = null; sc.tw = undefined;
}
window.render = async function render(t) {
  if (!G.bg) initGlobal();
  updateGlobal(t);
  let flash = 0;
  for (const sc of SCENES) {
    const u = t - sc.start;
    const active = u > -PRE && u < sc.dur + POST;
    if (active) ensureBuilt(sc);
    else if (sc.built && (u < -2 || u > sc.dur + 2)) dispose(sc);
    if (!sc.built) continue;
    sc.root.style.display = active ? "block" : "none";
    if (!active) continue;
    const inP = sc.id === "intro" ? 1 : seg(u, 0, OVERLAP, E.out), outP = sc.last ? 0 : seg(u, sc.dur - OVERLAP, sc.dur, E.in);
    sc.root.style.opacity = clamp(inP * (1 - outP));
    const sIn = lerp(1.025, 1, inP), sOut = lerp(1, 0.985, outP);
    sc.root.style.transform = `scale(${sIn * sOut})`;
    sc.inst.update(u);
    if (sc.tw === undefined) sc.tw = sc.root.querySelector(".tw");
    if (sc.tw) sc.tw.style.opacity = seg(u, 0.35, 0.75, E.out) * (sc.last ? 1 : 1 - seg(u, sc.dur - 0.55, sc.dur - 0.3));
    if (sc.flashAt != null && u >= sc.flashAt) flash = Math.max(flash, 1 - seg(u, sc.flashAt, sc.flashAt + 0.4, E.out));
  }
  G.flash.style.opacity = flash * 0.5;
  const pend = [...PENDING]; PENDING.clear();
  await Promise.all(pend.map((im) => im.decode().catch(() => 0)));
};
window.collectEvents = function () {
  if (!G.bg) initGlobal();
  const all = [];
  for (const sc of SCENES) {
    ensureBuilt(sc, true);
    all.push({ t: sc.start, type: "scene" }, ...sc.events);
    dispose(sc);
  }
  return all.sort((a, b) => a.t - b.t);
};
window.boot = function () { layout(); initGlobal(); };
