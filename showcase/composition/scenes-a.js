/* Scenes 1–9: hook → setup → dashboard → list → board → peek → new task → filters → notifications */
"use strict";

/* ───── helpers ───── */
const C = (u, z, x, y, extra) => [u, Object.assign({ z, x, y }, extra || {})];
const sp = (r, o = 1, rad) => ({ x: r[0], y: r[1], w: r[2], h: r[3], o, r: rad });
/** [[tIn,tOut,rect,radius?],…] → spotlight keyframes with soft fades. */
function SPOTS(list) {
  const keys = [];
  let prev = -1e9;
  for (const [a, b, r, rad] of list) {
    const s0 = Math.max(a - 0.3, prev + 0.001);
    keys.push([s0, sp(r, 0, rad)], [Math.max(a, s0 + 0.12), sp(r, 1, rad)], [b, sp(r, 1, rad)], [b + 0.3, sp(r, 0, rad)]);
    prev = b + 0.3;
  }
  if (!keys.length) keys.push([0, sp([0, 0, 1, 1], 0)]);
  return keys;
}
/** flipbook: names shown one after another, each fading in at its time (later layers cover earlier). */
const flip = (items, fade = 0.2) => items.map(([img, from]) => ({ img, from, fade }));
const introFx = (tB) => [[0, { op: 0.38, blur: 16, sc: 0.93 }], [tB, { op: 0.38, blur: 16, sc: 0.93 }], [tB + 0.9, { op: 1, blur: 0, sc: 1 }]];
const CX = 1250, CY = 585; // default window anchor (stage px)

function wordsIn(words, u, t0, stag = 0.08, dur = 0.8) {
  words.forEach((w, i) => {
    const p = seg(u, t0 + i * stag, t0 + i * stag + dur, E.out);
    w.style.opacity = p; w.style.transform = `translate3d(0,${(1 - p) * 56}px,0)`; w.style.filter = p < 0.98 ? `blur(${(1 - p) * 12}px)` : "none";
  });
}

/* generic feature scene: window + docked title */
function feature(id, dur, cfg) {
  defineScene({
    id, dur,
    build(ctx) {
      const w = Win(ctx.root, cfg.win(ctx), ctx);
      const ex = cfg.extra ? cfg.extra(ctx) : null;
      const t = Title(ctx.root, cfg.title);
      (cfg.events || []).forEach(([u, ty]) => ctx.ev(u, ty));
      (cfg.title.bullets || []).forEach(([u]) => ctx.ev(u, "tick"));
      return { update(u) { w.update(u); ex && ex.update(u); t.update(u); } };
    },
  });
}

/* ═════════════ 1 · HOOK ═════════════ */
defineScene({
  id: "intro", dur: 9.0, flashAt: 5.0,
  build(ctx) {
    const r = ctx.root;
    ctx.ev(2.55, "swoosh"); ctx.ev(5.0, "boom"); ctx.ev(5.5, "shimmer");
    const mk = (html, css) => { const d = h("div", "h1", r, Object.assign({ position: "absolute", left: "0", width: "1920px", textAlign: "center", fontSize: "132px" }, css)); return [d, splitWords(d, html)]; };
    const [a, aw] = mk("Which tasks<br>are <span class='red'>overdue</span>?", { top: "340px" });
    const [b, bw] = mk("You shouldn't<br><span class='grad'>have to ask.</span>", { top: "340px" });
    // logo lockup
    const lock = h("div", "", r, { position: "absolute", left: "0", top: "300px", width: "1920px", textAlign: "center" });
    const logo = h("div", "logo", lock, { width: "132px", height: "132px", borderRadius: "34px", margin: "0 auto 34px", fontSize: "70px", boxShadow: "0 20px 80px rgba(99,102,241,.7), inset 0 1px 0 rgba(255,255,255,.4)" });
    logo.textContent = "T";
    const name = h("div", "h1", lock, { fontSize: "124px" }); const nw = splitWords(name, "Task Manager");
    const sub = h("div", "", lock, { font: "400 34px/1.4 Inter, sans-serif", color: "rgba(255,255,255,.68)", marginTop: "18px", letterSpacing: "-.01em" });
    sub.textContent = "A calm, Notion-style workspace for small teams.";
    const chips = h("div", "", lock, { marginTop: "46px", display: "flex", gap: "16px", justifyContent: "center" });
    const cs = ["Assign work", "Track deadlines", "Never miss what's overdue"].map((x) => { const c = h("div", "chip", chips); c.textContent = x; return c; });
    // the pulsing overdue badge behind line 1
    const badge = h("div", "", r, { position: "absolute", left: "1380px", top: "262px", width: "96px", height: "96px", borderRadius: "50%", background: "#ef4444", color: "#fff", font: "800 52px/96px 'Inter Display',sans-serif", textAlign: "center", boxShadow: "0 0 0 10px rgba(239,68,68,.25), 0 0 80px rgba(239,68,68,.7)" });
    badge.textContent = "6";
    return {
      update(u) {
        wordsIn(aw, u, 0.35, 0.1);
        const aOut = seg(u, 2.35, 2.9, E.in);
        a.style.opacity = 1 - aOut; a.style.transform = `scale(${1 + aOut * 0.06})`; a.style.filter = `blur(${aOut * 14}px)`;
        const bp = seg(u, 2.9, 3.0);
        b.style.display = u > 2.85 ? "block" : "none";
        wordsIn(bw, u, 3.0, 0.1);
        const bOut = seg(u, 4.55, 5.0, E.in);
        b.style.opacity = 1 - bOut; b.style.transform = `scale(${1 + bOut * 0.08})`;
        // badge pulse (first line)
        const bp2 = seg(u, 1.4, 1.9, E.back) * (1 - seg(u, 2.35, 2.8));
        badge.style.opacity = bp2; badge.style.transform = `scale(${lerp(0.5, 1, bp2) * (1 + 0.06 * Math.sin(u * 9))})`;
        // lockup
        const lp = seg(u, 5.0, 5.9, E.out);
        logo.style.opacity = lp; logo.style.transform = `scale(${lerp(0.6, 1, E.back(clamp((u - 5.0) / 0.9)))}) rotate(${(1 - lp) * -12}deg)`;
        wordsIn(nw, u, 5.3, 0.1, 0.8);
        sub.style.opacity = seg(u, 6.1, 6.8, E.out); sub.style.transform = `translate3d(0,${(1 - seg(u, 6.1, 6.8, E.out)) * 18}px,0)`;
        cs.forEach((c, i) => { const p = seg(u, 6.8 + i * 0.18, 7.4 + i * 0.18, E.out); c.style.opacity = p; c.style.transform = `translate3d(0,${(1 - p) * 20}px,0)`; });
      },
    };
  },
});

/* ═════════════ 2 · SETUP ═════════════ */
(() => {
  const OX = -350, OY = -140, r = (k, pad = 0) => { const [x, y, w, h_] = R("setup-empty", k, pad); return [x + OX, y + OY, w, h_]; };
  defineScene({
    id: "setup", dur: 9.0,
    build(ctx) {
      const typed = ["setup-company-0", "setup-company-1", "setup-company-2", "setup-company-3", "setup-company-4"];
      const card = Win(ctx.root, {
        w: 400, h: 820, ox: OX, oy: OY, chrome: false, base: 0.92, radius: 26,
        anchor: [[0, { x: CX, y: CY - 10 }]],
        cam: [C(0, 1, 200, 410, { ry: -10, rx: 4 }), C(1.3, 1, 200, 410, { ry: -10, rx: 4 }), C(2.4, 1.15, 200, 330, { ry: 0, rx: 0 }), C(5.2, 1.3, 200, 470, {}), C(7.0, 1.12, 200, 420, {}), C(7.9, 1.0, 200, 410, {})],
        fx: [[0, { op: 0.4, blur: 14, sc: 0.93 }], [1.3, { op: 0.4, blur: 14, sc: 0.93 }], [2.2, { op: 1, blur: 0, sc: 1 }], [7.3, { op: 1, blur: 0, sc: 1 }], [8.0, { op: 0, blur: 6, sc: 0.94 }]],
        layers: [
          { img: "setup-empty", from: 0 },
          ...typed.map((n, i) => ({ img: n, from: 3.0 + i * 0.22, fade: 0.05 })),
          { img: "setup-filled-nosample", from: 5.0, fade: 0.25 },
          { img: "setup-filled", from: 6.45, fade: 0.1 },
        ],
        rings: [
          { rect: r("tz", 4), from: 5.35, to: 6.2, r: 10 },
          { rect: r("sample", 4), from: 6.2, to: 7.2, tone: "ok", r: 12 },
        ],
        callouts: [
          { at: [r("company")[0] + r("company")[2], r("company")[1] + 18], dx: 150, dy: -30, text: "Your company", from: 2.9, to: 4.5 },
          { at: [r("tz")[0] + r("tz")[2], r("tz")[1] + 18], dx: 190, dy: 0, text: "Overdue judged in your timezone", from: 5.4, to: 6.4, tone: "warn" },
          { at: [r("sample")[0] + r("sample")[2], r("sample")[1] + 40], dx: 170, dy: 10, text: "Optional sample data", from: 6.3, to: 7.5, tone: "ok" },
        ],
        cursor: [[2.3, 120, 260], [3.0, r("company")[0] + 120, r("company")[1] + 18, "c"], [4.6, r("company")[0] + 200, r("company")[1] + 18], [6.2, r("sample")[0] + 14, r("sample")[1] + 17, "c"], [6.95, r("submit")[0] + 160, r("submit")[1] + 18], [7.25, r("submit")[0] + 160, r("submit")[1] + 18, "c"]],
      }, ctx);
      const dash = Win(ctx.root, {
        base: 0.85, anchor: [[0, { x: CX, y: CY }]],
        cam: [C(0, 1, 720, 450, { ry: -6, rx: 3 }), C(7.2, 1, 720, 450, { ry: -6, rx: 3 }), C(8.6, 1.0, 720, 450, { ry: 0, rx: 0 })],
        fx: [[0, { op: 0, sc: 0.9 }], [7.4, { op: 0, sc: 0.92 }], [8.3, { op: 1, sc: 1 }]],
        layers: [{ img: "setup-done-dashboard", from: 0 }], urls: [[0, "/dashboard"]], callouts: [{ at: [150, 60], dx: 190, dy: 110, text: "Workspace created", from: 8.4, tone: "ok", size: 26 }],
      }, ctx);
      typed.forEach((_, i) => ctx.ev(3.0 + i * 0.22, "key"));
      ctx.ev(7.25, "chime");
      const t = Title(ctx.root, {
        n: "01", eyebrow: "Get started", html: "Live in<br><span class='grad'>a minute.</span>", lines: 2, tB: 1.2,
        sub: "Create your company and your admin account. That's the whole setup.",
        bullets: [[2.7, "Company, timezone &amp; first admin"], [4.2, "Deadlines judged in <b>your</b> timezone"], [6.1, "Start with sample data to explore"]],
      });
      [2.7, 4.2, 6.1].forEach((u) => ctx.ev(u, "tick"));
      return { update(u) { card.update(u); dash.update(u); t.update(u); } };
    },
  });
})();

/* ═════════════ 3 · DASHBOARD ═════════════ */
(() => {
  const o = R("dash-top", "overdue"), badge = R("dash-top", "badge"), stats = R("dash-top", "stats"), nt = R("dash-top", "navTasks");
  const due = R("dash-top", "dueSoon"), wl = R("dash-top", "workload"), mo = R("dash-top", "momentum"), ac = R("dash-top", "activity");
  feature("dashboard", 14.0, {
    title: {
      n: "02", eyebrow: "Dashboard", html: "<span class='red'>Overdue</span> first.<br>Everywhere.", lines: 2, tB: 1.3,
      sub: "Open the app and the first thing you see is what slipped — grouped by person.",
      bullets: [[3.0, "Overdue panel, <b>grouped by person</b>"], [5.0, "Live <b>overdue badge</b> in the sidebar"], [6.6, "Due today · In progress · Done this week"], [8.4, "Next 7 days &amp; blocked work"], [10.4, "Workload, momentum &amp; live activity"]],
    },
    win: () => ({
      base: 0.85, spotScroll: true, urls: [[0, "/dashboard"]],
      anchor: [[0, { x: CX, y: CY }]],
      fx: introFx(1.3),
      cam: [
        C(0, 1, 720, 450, { ry: -9, rx: 4 }), C(1.3, 1, 720, 450, { ry: -9, rx: 4 }),
        C(2.7, 1.18, 760, 380, { ry: 0, rx: 0 }), C(4.5, 1.18, 760, 380), C(5.4, 1.75, 150, 150), C(6.3, 1.75, 150, 150), C(7.0, 1.3, 740, 650),
        C(8.0, 1.3, 740, 650), C(9.0, 1.25, 780, 420), C(10.4, 1.25, 780, 420), C(11.0, 1.2, 1050, 560), C(13.4, 1.2, 1050, 560),
      ],
      scroll: [[0, 0], [8.0, 0], [9.0, 580, E.io], [10.6, 580], [11.7, 1134, E.io]],
      layers: [{ page: "dash", from: 0 }],
      spot: SPOTS([[2.8, 4.8, [o[0] - 8, o[1] - 8, o[2] + 16, o[3] + 16], 16], [6.5, 8.2, [stats[0] - 6, stats[1] - 6, stats[2] + 12, stats[3] + 12], 16], [9.6, 10.9, [wl[0] - 6, wl[1] - 6, wl[2] + 12, wl[3] + 12], 16], [11.6, 12.6, [mo[0] - 6, mo[1] - 6, mo[2] + 12, mo[3] + 12], 16], [12.6, 13.9, [ac[0] - 6, ac[1] - 6, ac[2] + 12, 560], 16]]),
      rings: [{ rect: [badge[0], badge[1], badge[2], badge[3]], from: 5.3, to: 6.8, tone: "danger", pad: 8, r: 14 }],
      callouts: [
        { at: [o[0] + 340, o[1] + 80], dx: 230, dy: -62, text: "Grouped by person", from: 3.1, to: 4.9, tone: "danger" },
        { at: [badge[0] + 19, badge[1] + 9], dx: 190, dy: 70, text: "Live overdue count", from: 5.5, to: 6.8, tone: "danger" },
        { at: [stats[0] + 130, stats[1] + 20], dx: 160, dy: -80, text: "At-a-glance counts", from: 6.7, to: 8.1, tone: "warn" },
        { at: [wl[0] + 190, wl[1] + 70], dx: -330, dy: 20, text: "Workload per person", from: 9.7, to: 10.9, s: true },
        { at: [mo[0] + 120, mo[1] + 120], dx: -300, dy: 40, text: "14-day completion trend", from: 11.7, to: 12.7, tone: "ok", s: true },
        { at: [ac[0] + 150, ac[1] + 90], dx: -300, dy: 30, text: "Live activity feed", from: 12.7, to: 13.9, s: true },
      ],
    }),
  });
})();

/* ═════════════ 4 · TASK LIST ═════════════ */
(() => {
  const ban = R("tasks-top", "banner"), go = R("tasks-top", "gOverdue"), gt = R("tasks-top", "gToday"), gu = R("tasks-top", "gUpcoming"), gn = R("tasks-top", "gNone");
  const nt = R("tasks-top", "navTasks");
  const chain = ["Overdue", "Due today", "Upcoming", "No deadline", "Completed"];
  feature("tasks", 10.0, {
    title: {
      n: "03", eyebrow: "Task list", html: "Grouped by<br><span class='grad'>urgency.</span>", lines: 2, intro: "quick",
      sub: "Overdue first, then what's due today, and everything after.",
      bullets: [[1.7, "Overdue banner &amp; sidebar badge"], [3.2, "Status, assignee, deadline &amp; priority inline"], [5.8, "Tags and comment counts at a glance"]],
    },
    extra: (ctx) => {
      const row = h("div", "", ctx.root, { position: "absolute", left: "96px", top: "930px", display: "flex", gap: "10px" });
      const els = chain.map((c, i) => { const e = h("div", "chip", row, { fontSize: "19px", padding: "11px 18px" }); e.textContent = c; return e; });
      const tt = [2.6, 4.4, 5.8, 7.1, 8.2];
      tt.forEach((t) => ctx.ev(t, "tick"));
      const cols = ["#ff6b6b", "#fbbf24", "#8b8dff", "#9ca3af", "#4ade80"];
      return {
        update(u) {
          els.forEach((e, i) => {
            const on = u >= tt[i], cur = u >= tt[i] && (i === 4 || u < tt[i + 1]);
            e.style.opacity = seg(u, 2.0 + i * 0.08, 2.5 + i * 0.08, E.out) * (1 - seg(u, 9.1, 9.5));
            e.style.background = cur ? `${cols[i]}33` : "rgba(255,255,255,.06)";
            e.style.borderColor = cur ? cols[i] : "rgba(255,255,255,.12)";
            e.style.color = cur ? "#fff" : "rgba(255,255,255,.55)";
            e.style.transform = `translate3d(0,${(1 - seg(u, 2.0 + i * 0.08, 2.5 + i * 0.08, E.out)) * 14}px,0)`;
          });
        },
      };
    },
    win: () => ({
      base: 0.85, spotScroll: true, urls: [[0, "/tasks?scope=all"]],
      anchor: [[0, { x: CX, y: CY }]],
      cam: [C(0, 1, 720, 450), C(1.2, 1.55, 644, 190), C(3.0, 1.55, 644, 190), C(3.8, 1.1, 700, 440), C(5.2, 1.1, 700, 440), C(5.8, 1.1, 700, 520), C(9.3, 1.1, 700, 520)],
      scroll: [[0, 0], [5.6, 0], [6.8, 400, E.io], [9.4, 400]],
      layers: [{ page: "tasks", from: 0 }],
      spot: SPOTS([[1.5, 3.0, [ban[0] - 4, ban[1] - 4, ban[2] + 8, ban[3] + 8], 14], [3.4, 5.2, [go[0], go[1] - 4, go[2], go[3] + 8], 12], [5.2, 6.7, [gt[0], gt[1] - 4, gt[2], gt[3] + 8], 12]]),
      rings: [{ rect: R("tasks-top", "badge"), from: 1.4, to: 3.0, tone: "danger", pad: 6, r: 14 }],
      callouts: [
        { at: [ban[0] + 420, ban[1] + 21], dx: 200, dy: 74, text: "Always on top", from: 1.7, to: 3.0, tone: "danger", s: true },
        { at: [go[0] + 760, go[1] + 130], dx: -140, dy: 90, text: "Overdue work, listed first", from: 3.8, to: 5.2, tone: "danger", s: true },
        { at: [gt[0] + 140, gt[1] + 18], dx: 190, dy: -52, text: "Due today", from: 5.3, to: 6.6, tone: "warn", s: true },
      ],
      cursor: [[0.2, 900, 560], [1.0, 215, 124, "c"], [1.4, 700, 300]],
    }),
  });
})();

/* ═════════════ 5 · BOARD ═════════════ */
(() => {
  const view = R("tasks-top", "view"), card = R("bd-0-idle", "card"), tgt = R("bd-0-idle", "target"), after = R("bd-2-dropped", "cardAfter");
  const grab = [card[0] + 136, card[1] + card[3] - 12], drop = [tgt[0] + 150, 600];
  const off = [grab[0] - card[0], grab[1] - card[1]];
  feature("board", 9.5, {
    title: {
      n: "04", eyebrow: "Board", html: "Drag. Drop.<br><span class='grad'>Done.</span>", lines: 2, intro: "quick",
      sub: "Flip to a Kanban board and move work between status columns.",
      bullets: [[1.8, "Five status columns, one glance"], [3.4, "Overdue cards flagged in red"], [5.2, "Drop on a column — status updates instantly"]],
    },
    events: [[1.15, "click"], [2.65, "grab"], [4.4, "drop"]],
    win: () => ({
      base: 0.85, urls: [[0, "/tasks?scope=all"], [1.2, "/tasks?scope=all&view=board"]],
      anchor: [[0, { x: CX, y: CY }]],
      cam: [C(0, 1, 720, 450), C(1.6, 1, 720, 450), C(2.3, 1.3, 800, 500), C(4.9, 1.3, 800, 500), C(5.6, 1.45, 1000, 470), C(8.9, 1.45, 1000, 470)],
      layers: [
        { img: "tasks-top", from: 0 },
        { img: "bd-0-idle", from: 1.2, fade: 0.3 },
        { img: "bd-1-dragging", from: 2.7, fade: 0.12 },
        { img: "drag-card", free: true, from: 2.7, to: 4.4, fade: 0.1, fadeOut: 0.05, tr: [[2.7, { x: card[0], y: card[1], s: 1, r: 0, o: 1 }], [3.0, { x: card[0] + 14, y: card[1] - 6, s: 1.04, r: 3, o: 1 }], [4.3, { x: drop[0] - off[0], y: drop[1] - off[1], s: 1.04, r: 3, o: 1 }], [4.4, { x: drop[0] - off[0], y: drop[1] - off[1], s: 1.0, r: 0, o: 1 }]] },
        { img: "bd-2-dropped", from: 4.4, fade: 0.14 },
      ],
      rings: [{ rect: after, from: 4.7, to: 7.6, tone: "ok", pad: 6, r: 12 }],
      callouts: [
        { at: [after[0] + after[2], after[1] + 40], dx: 200, dy: 70, text: "In review — updated instantly", from: 4.8, to: 7.8, tone: "ok" },
        { at: [card[0] + 200, card[1] + 70], dx: -40, dy: -190, text: "Overdue cards stand out", from: 2.0, to: 2.65, tone: "danger" },
      ],
      cursor: [[0.3, 960, 640], [1.1, view[0] + view[2] * 0.74, view[1] + 17, "c"], [1.9, 760, 500], [2.55, grab[0], grab[1], "c"], [3.0, grab[0] + 20, grab[1] + 8], [4.3, drop[0], drop[1]], [4.5, drop[0], drop[1], "c"], [5.2, drop[0] + 120, drop[1] + 80]],
    }),
  });
})();

/* ═════════════ 6 · SIDE-PEEK ═════════════ */
(() => {
  const P = (k) => R("pe-0-open", k), st = P("status"), asg = P("assignee"), dl = P("deadline"), pr = P("priority");
  const cb = R("pe-3-comment-3", "commentBox"), cbtn = R("pe-3-comment-3", "commentBtn"), com4 = R("pe-4-commented", "comments");
  const typed = ["pe-3-comment-0", "pe-3-comment-1", "pe-3-comment-2", "pe-3-comment-3"];
  feature("peek", 13.0, {
    title: {
      n: "05", eyebrow: "Side-peek", html: "Everything about<br>a task. <span class='grad'>One panel.</span>", lines: 2, tB: 1.2,
      sub: "Click a task and it opens beside your list — nothing to navigate away from.",
      bullets: [[2.9, "Status, assignee, deadline, priority &amp; tags"], [5.1, "Every field edits <b>inline</b>"], [7.0, "Comments for the whole team"], [10.2, "Full change history"]],
    },
    events: [[1.85, "click"], [2.3, "whoosh"], [4.85, "click"], [5.85, "click"], [6.85, "click"], [8.95, "click"], [8.95, "chime"], ...typed.map((_, i) => [7.3 + i * 0.3, "key"])],
    win: () => ({
      base: 0.85, fx: introFx(1.2), anchor: [[0, { x: CX, y: CY }]],
      urls: [[0, "/tasks?scope=all"], [2.3, "/tasks?scope=all&task=c2b5f45e"]],
      cam: [C(0, 1, 720, 450, { ry: -9, rx: 4 }), C(1.2, 1, 720, 450, { ry: -9, rx: 4 }), C(2.2, 1, 720, 450, { ry: 0, rx: 0 }), C(3.0, 1.7, 1115, 285), C(4.7, 1.7, 1115, 300), C(6.2, 1.55, 1120, 440), C(6.9, 1.55, 1120, 540), C(9.6, 1.5, 1120, 620), C(10.4, 1.5, 1120, 600), C(12.4, 1.5, 1120, 640)],
      layers: [
        { img: "tasks-top", from: 0 },
        { img: "pe-0-open", clip: [0, 0, 800, 900], from: 2.3, fade: 0.3 },
        { img: "pe-0-open", clip: [800, 0, 1440, 900], from: 2.3, fade: 0, tr: [[2.3, { x: 70, o: 0 }], [2.75, { x: 0, o: 1 }]] },
        { img: "pe-1-priority", from: 5.0, fade: 0.15 },
        { img: "pe-2-status", from: 6.0, fade: 0.15 },
        ...typed.map((n, i) => ({ img: n, from: i === 0 ? 7.2 : 7.3 + i * 0.3, fade: i === 0 ? 0.2 : 0.04 })),
        { img: "pe-4-commented", from: 9.0, fade: 0.2 },
        { img: "pe-5-activity", from: 10.5, fade: 0.25 },
      ],
      rings: [
        { rect: [st[0], st[1], 99, st[3]], from: 5.8, to: 7.0, tone: "ok", pad: 5, r: 8 },
        { rect: [pr[0], pr[1], 73, pr[3]], from: 4.8, to: 5.9, pad: 5, r: 8 },
        { rect: [com4[0], com4[1] + 20, com4[2], 80], from: 9.1, to: 10.3, tone: "ok", pad: 6, r: 10 },
      ],
      callouts: [
        { at: [asg[0] + 12, asg[1] + 14], dx: -175, dy: -10, text: "Assign to anyone", from: 3.3, to: 4.6 },
        { at: [dl[0] + 120, dl[1] + 14], dx: -170, dy: 36, text: "Live overdue flag", from: 3.6, to: 4.7, tone: "danger" },
        { at: [pr[0] + 66, pr[1] + 11], dx: -165, dy: 46, text: "Priority → Urgent", from: 5.1, to: 5.95, tone: "warn" },
        { at: [st[0] + 80, st[1] + 11], dx: -165, dy: -42, text: "Status → Done", from: 6.1, to: 7.0, tone: "ok" },
        { at: [com4[0] + 110, com4[1] + 56], dx: -190, dy: 50, text: "Comment posted", from: 9.2, to: 10.3, tone: "ok" },
        { at: [880, 660], dx: -230, dy: 10, text: "Who changed what, when", from: 10.9, to: 12.6 },
      ],
      cursor: [[0.4, 980, 700], [1.8, 470, 859], [1.85, 470, 859, "c"], [3.4, 1050, 200], [4.85, pr[0] + 30, pr[1] + 11, "c"], [5.85, st[0] + 38, st[1] + 11, "c"], [6.85, cb[0] + 200, cb[1] + 30, "c"], [8.6, cbtn[0] + 38, cbtn[1] + 14], [8.95, cbtn[0] + 38, cbtn[1] + 14, "c"], [9.8, 1120, 600]],
    }),
  });
})();

/* ═════════════ 7 · NEW TASK ═════════════ */
(() => {
  const D = (k) => R("nt-3-filled", k), as = D("assignee"), tom = D("chipTomorrow"), cr = D("create"), ti = D("title"), tg = D("tags"), pri = D("priority");
  const typed = ["nt-1-title-0", "nt-1-title-1", "nt-1-title-2", "nt-1-title-3"];
  feature("newtask", 9.0, {
    title: {
      n: "06", eyebrow: "New task", html: "Capture it in<br>a <span class='grad'>keystroke.</span>", lines: 2, intro: "quick",
      sub: "Press C anywhere in the app. Fill what you know — refine it later.",
      bullets: [[1.9, "Assign to <b>anyone</b> on the team"], [3.4, "Quick deadlines: Today · Tomorrow · Next week"], [5.2, "Priority, description &amp; tags"]],
    },
    events: [[1.0, "key"], [4.45, "click"], [5.85, "click"], [6.0, "chime"], ...typed.map((_, i) => [1.9 + i * 0.28, "key"])],
    extra: (ctx) => {
      const k = h("div", "keycap", ctx.root, { left: "1370px", top: "150px" }); k.textContent = "C";
      return {
        update(u) {
          const inP = seg(u, 0.35, 0.8, E.back), out = seg(u, 1.7, 2.1, E.in), press = seg(u, 0.95, 1.05, E.lin) * (1 - seg(u, 1.2, 1.4));
          k.style.opacity = inP * (1 - out); k.style.transform = `translate3d(0,${(1 - inP) * -40 + press * 10}px,0) scale(${lerp(0.8, 1, inP)})`;
          k.style.boxShadow = press > 0.5 ? "0 2px 0 #0c0c15, 0 10px 24px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.2)" : "";
        },
      };
    },
    win: () => ({
      base: 0.85, urls: [[0, "/tasks?scope=all"]], anchor: [[0, { x: CX, y: CY }]],
      cam: [C(0, 1, 720, 450), C(1.2, 1, 720, 450), C(2.0, 1.4, 720, 440), C(6.0, 1.4, 720, 440), C(6.6, 1.2, 840, 700), C(8.4, 1.2, 840, 700)],
      layers: [
        { img: "tasks-top", from: 0 },
        { img: "nt-0-empty", from: 1.1, fade: 0.18 },
        ...typed.map((n, i) => ({ img: n, from: 1.9 + i * 0.28, fade: 0.03 })),
        { img: "nt-2-assign", from: 3.4, fade: 0.2 },
        { img: "nt-3-filled", from: 4.6, fade: 0.15 },
        { img: "nt-4-created", from: 6.0, fade: 0.2 },
      ],
      rings: [
        { rect: [as[0], as[1], as[2] + pri[2] + 16, as[3]], from: 3.5, to: 4.6, pad: 5, r: 8 },
        { rect: [D("chipToday")[0], tom[1], D("chipWeek")[0] + D("chipWeek")[2] - D("chipToday")[0], tom[3]], from: 4.0, to: 5.4, pad: 5, r: 10 },
        { rect: R("nt-4-created", "row"), from: 6.3, to: 8.4, tone: "ok", pad: 2, r: 4 },
      ],
      callouts: [
        { at: [as[0] + as[2], as[1] + 18], dx: -10, dy: -110, text: "Assign to anyone", from: 3.5, to: 4.6 },
        { at: [tom[0] + 40, tom[1] + 14], dx: 160, dy: 100, text: "Deadline in one click", from: 4.1, to: 5.5, tone: "warn" },
        { at: [R("nt-4-created", "row")[0] + 140, R("nt-4-created", "row")[1] + 20], dx: 220, dy: -80, text: "On the list instantly", from: 6.4, to: 8.4, tone: "ok", s: false },
      ],
      cursor: [[1.4, 1100, 300], [3.5, as[0] + 120, as[1] + 18], [4.45, tom[0] + 38, tom[1] + 14, "c"], [5.4, cr[0] + 50, cr[1] + 18], [5.85, cr[0] + 50, cr[1] + 18, "c"], [7.0, 900, 800]],
    }),
  });
})();

/* ═════════════ 8 · FILTERS & SEARCH ═════════════ */
(() => {
  const F = (k) => R("filter-overdue", k), due = F("dueSel"), search = R("search-2", "search"), prio = F("prio");
  const q = ["search-0", "search-1", "search-2"];
  feature("filters", 8.0, {
    title: {
      n: "07", eyebrow: "Filters &amp; search", html: "Find anything.<br><span class='grad'>Share the view.</span>", lines: 2, intro: "quick",
      sub: "Every filter lives in the URL, so a link recreates your exact view.",
      bullets: [[1.8, "Status · Deadline · Priority · Assignee · Tag"], [3.6, "Instant search across tasks"], [5.2, "Shareable URLs"]],
    },
    events: [[1.35, "click"], [3.15, "click"], [4.85, "click"], ...q.map((_, i) => [5.0 + i * 0.5, "key"])],
    win: () => ({
      base: 0.85, anchor: [[0, { x: CX, y: CY - 40 }]],
      urls: [[0, "/tasks?scope=all"], [1.4, "/tasks?scope=all&due=overdue"], [3.2, "/tasks?scope=all&priority=URGENT&status=all"], [5.0, "/tasks?scope=all&q=launch"]],
      cam: [C(0, 1, 720, 450), C(1.0, 1.5, 640, 120), C(7.5, 1.5, 640, 120)],
      layers: [
        { img: "tasks-top", from: 0 },
        { img: "filter-overdue", from: 1.4, fade: 0.2 },
        { img: "filter-urgent", from: 3.2, fade: 0.2 },
        ...q.map((n, i) => ({ img: n, from: 5.0 + i * 0.5, fade: i === 0 ? 0.2 : 0.04 })),
      ],
      rings: [
        { rect: [due[0], due[1], due[2], due[3]], from: 1.3, to: 2.6, pad: 5, r: 8 },
        { rect: [prio[0], prio[1], prio[2], prio[3]], from: 3.1, to: 4.4, pad: 5, r: 8 },
        { rect: [search[0], search[1], search[2], search[3]], from: 4.8, to: 6.8, pad: 5, r: 8 },
        { rect: [460, -36, 520, 28], from: 1.9, to: 7.2, pad: 3, r: 8, tone: "ok" },
      ],
      callouts: [
        { at: [720, -22], dx: 0, dy: -64, text: "The view lives in the URL", from: 2.0, to: 7.3, tone: "ok" },
        { at: [due[0] + 60, due[1] + 16], dx: -40, dy: 82, text: "Overdue only", from: 1.5, to: 2.7, tone: "danger" },
        { at: [prio[0] + 56, prio[1] + 16], dx: 30, dy: 80, text: "Urgent, any status", from: 3.3, to: 4.5, tone: "warn" },
        { at: [search[0] + 250, search[1] + 14], dx: 60, dy: 88, text: "Search as you type", from: 5.3, to: 7.2 },
      ],
      cursor: [[0.3, 1000, 380], [1.35, due[0] + 60, due[1] + 16, "c"], [3.15, prio[0] + 56, prio[1] + 16, "c"], [4.85, search[0] + 60, search[1] + 16, "c"], [6.8, search[0] + 200, search[1] + 100]],
    }),
  });
})();

/* ═════════════ 9 · NOTIFICATIONS + EMAIL ═════════════ */
(() => {
  const bell = R("notif-open", "bell"), panel = R("notif-open", "panel"), tipB = R("tip-bell", "tip");
  const bc = mid(bell);
  const SUBJECT = "Alex Morgan assigned you a task: Send Q4 proposal to Acme"; // output of the app's own assignmentEmail()
  feature("notifs", 10.0, {
    title: {
      n: "08", eyebrow: "Notifications &amp; email", html: "Never miss<br>a <span class='grad'>change.</span>", lines: 2, intro: "quick",
      sub: "In the app, in your inbox, and on a schedule.",
      bullets: [[2.5, "Assigned · Commented · Status changed · Overdue"], [3.7, "One click jumps to the task"], [5.4, "<b>Email</b> to the assignee on assignment"], [8.0, "Daily overdue digest"]],
    },
    events: [[1.9, "click"], [2.0, "pop"], [5.0, "whoosh"], [5.75, "chime"], [7.8, "whoosh"], [8.3, "chime"]],
    extra: (ctx) => {
      const W0 = 700, sc = W0 / 568, cropH = 360 * sc;
      const wrap = h("div", "", ctx.root, { position: "absolute", left: "1090px", top: "150px", width: W0 + "px" });
      const hd = h("div", "", wrap, { padding: "0 4px 22px" });
      hd.innerHTML = `<div style="display:flex;align-items:center;gap:10px;font:650 17px Inter;color:#8b8dff;letter-spacing:.16em;text-transform:uppercase">${svgIcon("mail", 24)} New email</div>
        <div style="margin-top:14px;font:650 30px/1.22 'Inter Display',Inter;color:#fff;letter-spacing:-.02em">${SUBJECT}</div>
        <div style="margin-top:12px;font:400 19px Inter;color:rgba(255,255,255,.58)">Northwind Studio &lt;tasks@northwind.example&gt; &nbsp;→&nbsp; Priya Shah</div>`;
      const body = h("div", "", wrap, { width: W0 + "px", height: cropH + "px", overflow: "hidden", borderRadius: "18px", background: "#f7f7f5", boxShadow: "0 40px 90px rgba(0,0,0,.65), 0 0 0 1px rgba(255,255,255,.14)", position: "relative" });
      if (!ctx.dry) { const im = loadImg(ASSET("email-assign"), body); Object.assign(im.style, { position: "absolute", maxWidth: "none", left: "0", top: "0", width: W0 + "px", height: "auto" }); }
      const smtp = h("div", "chip", wrap, { position: "absolute", left: "0", top: cropH + 215 + "px", fontSize: "19px", padding: "11px 18px" });
      smtp.innerHTML = `${svgIcon("send", 20)}<span>Sent via Brevo SMTP — after the request finishes</span>`;
      const cron = h("div", "card", ctx.root, { left: "1090px", top: "400px", width: "720px", padding: "28px 32px", background: "rgba(12,12,22,.96)" });
      cron.innerHTML = `<div style="display:flex;align-items:center;gap:12px;font:650 22px Inter;color:#fff"><span style="width:12px;height:12px;border-radius:50%;background:#4ade80;box-shadow:0 0 14px #4ade80"></span>Daily overdue digest</div>
        <div class="mono" style="margin-top:16px;font-size:21px;line-height:1.75;color:rgba(255,255,255,.78)"><span style="color:#8b8dff">cron</span> 0 6 * * *  <span style="color:rgba(255,255,255,.4)">// Vercel Cron, 06:00 UTC</span><br>GET /api/cron/overdue<br><span style="color:#4ade80">→</span> notifies the assignee &amp; creator, once</div>`;
      return {
        update(u) {
          const a = seg(u, 4.9, 5.6, E.out) * (1 - seg(u, 7.5, 7.95));
          wrap.style.opacity = a; wrap.style.transform = `translate3d(0,${(1 - seg(u, 4.9, 5.6, E.out)) * 46 - seg(u, 7.5, 7.95) * 20}px,0) scale(${lerp(0.96, 1, seg(u, 4.9, 5.6, E.out))})`;
          smtp.style.opacity = seg(u, 6.1, 6.7, E.out);
          const c = seg(u, 7.9, 8.6, E.out) * (1 - seg(u, 9.55, 9.95));
          cron.style.opacity = c; cron.style.transform = `translate3d(0,${(1 - seg(u, 7.9, 8.6, E.out)) * 40}px,0)`;
        },
      };
    },
    win: () => ({
      base: 0.85, urls: [[0, "/dashboard"]], anchor: [[0, { x: CX - 60, y: CY - 40 }]],
      fx: [[0, { op: 1, blur: 0 }], [4.6, { op: 1, blur: 0 }], [5.2, { op: 0.2, blur: 8 }], [9.9, { op: 0.2, blur: 8 }]],
      cam: [C(0, 1, 720, 450), C(0.9, 1.8, 1050, 170), C(4.5, 1.8, 1050, 170), C(5.3, 1.25, 900, 330), C(9.9, 1.25, 900, 330)],
      layers: [
        { img: "dash-top", from: 0 },
        { img: "tip-bell", clip: [1100, 0, 1440, 100], from: 1.25, to: 1.9, fade: 0.15, fadeOut: 0.04 },
        { img: "notif-open", from: 1.9, fade: 0.2 },
      ],
      rings: [{ rect: [panel[0], panel[1], panel[2], 102], from: 3.0, to: 4.5, pad: 4, r: 8 }, { rect: bell, from: 0.9, to: 2.0, pad: 5, r: 10, tone: "danger" }],
      callouts: [
        { at: [tipB[0] + tipB[2] / 2, tipB[1] + 12], dx: -170, dy: 80, text: "Tooltips on icon-only buttons", from: 1.3, to: 1.9, tone: "ok", size: 21 },
        { at: [panel[0] + 24, panel[1] + 140], dx: -190, dy: 40, text: "Unread, highlighted", from: 2.9, to: 4.4 },
      ],
      cursor: [[0.2, 1100, 400], [0.9, bc[0], bc[1]], [1.9, bc[0], bc[1], "c"], [3.2, panel[0] + 100, panel[1] + 70], [4.4, panel[0] + 100, panel[1] + 70]],
    }),
  });
})();
