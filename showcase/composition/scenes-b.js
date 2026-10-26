/* Scenes 10–17: company → people → teams → access control → dark/mobile → security → stack → outro */
"use strict";

const ICON = {
  lock: '<path d="M7 11V8a5 5 0 0 1 10 0v3"/><rect x="4" y="11" width="16" height="10" rx="2.5"/>',
  shield: '<path d="M12 3l8 3v6c0 4.6-3.2 8.4-8 9.5C7.2 20.4 4 16.6 4 12V6z"/><path d="M8.5 12.2l2.3 2.3 4.6-4.8"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.5-3.8L4 9"/><path d="M4 4v5h5"/><path d="M4 13a8 8 0 0 0 14.5 3.8L20 15"/><path d="M20 20v-5h-5"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
  table: '<rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="M3.5 9.5h17M9.5 9.5V20"/>',
  server: '<rect x="3.5" y="4" width="17" height="6.5" rx="2"/><rect x="3.5" y="13.5" width="17" height="6.5" rx="2"/><path d="M7 7.2h.01M7 16.7h.01"/>',
  github: '<path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/>',
  triangle: '<path d="M3 20h18L12 4z"/>',
  db: '<ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  rocket: '<path d="M5 15c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.2 2.2 0 0 0-2.9-.1z"/><path d="M12 15l-3-3a22 22 0 0 1 2-4 12.9 12.9 0 0 1 11-6c0 2.7-.8 7.5-6 11a22 22 0 0 1-4 2z"/><path d="M9 12H4s.6-3 2-4c1.6-1.1 5 0 5 0M12 15v5s3-.6 4-2c1.1-1.6 0-5 0-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  zap: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 7.2l8.5 6 8.5-6"/>',
  send: '<path d="M21 3L10 14"/><path d="M21 3l-6.5 18-3.5-7.5L3.5 10z"/>',
};
const svgIcon = (n, size = 34, color = "#8b8dff") => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICON[n]}</svg>`;

/* ═════════════ 10 · COMPANY PROFILE ═════════════ */
(() => {
  const idn = R("company-top", "identity"), det = R("company-top", "details"), tz = R("company-top", "tz"), sw = R("company-top", "swatches"), vis = R("company-top", "visibility"), pv = R("company-top", "preview");
  const sy = 422; // company-full's scroll range
  const swX = (i) => 360 + 14 + 36 * i, swY = 606;
  feature("company", 12.0, {
    title: {
      n: "09", eyebrow: "Company profile", html: "Make it<br><span class='grad'>yours.</span>", lines: 2, tB: 1.2,
      sub: "Everything about how your company appears — and behaves.",
      bullets: [[2.5, "Name, tagline, about, logo &amp; website"], [4.0, "Industry, size &amp; founded year"], [5.4, "Timezone — “overdue” flips at local midnight"], [7.0, "Brand colour <b>recolours the whole app</b>"], [10.0, "Task visibility policy for members"]],
    },
    events: [[7.05, "click"], [7.75, "click"], [8.45, "click"], [9.15, "click"], [7.2, "chime"]],
    win: () => ({
      base: 0.85, fx: introFx(1.2), spotScroll: true, urls: [[0, "/admin/company"]], anchor: [[0, { x: CX, y: CY }]],
      cam: [C(0, 1, 720, 450, { ry: -9, rx: 4 }), C(1.2, 1, 720, 450, { ry: -9, rx: 4 }), C(2.4, 1.3, 700, 330, { ry: 0, rx: 0 }), C(3.9, 1.3, 700, 500), C(5.0, 1.3, 700, 560), C(6.6, 1.25, 720, 480), C(9.4, 1.25, 720, 480), C(10.0, 1.3, 720, 560), C(11.4, 1.3, 720, 560)],
      scroll: [[0, 0], [4.9, 0], [6.2, sy, E.io], [11.9, sy]],
      layers: [
        { page: "company", from: 0, to: 6.95, fadeOut: 0.12 },
        { img: "brand-saved-emerald", from: 6.9, fade: 0.1 },
        { img: "brand-saved-rose", from: 7.6, fade: 0.1 },
        { img: "brand-saved-violet", from: 8.3, fade: 0.1 },
        { img: "brand-saved-amber", from: 9.0, fade: 0.1 },
        { page: "company", from: 9.75, fade: 0.3 },
      ],
      spot: SPOTS([[2.5, 3.8, [idn[0] - 8, idn[1] - 8, idn[2] + 16, idn[3] + 16], 14], [3.95, 4.9, [det[0] - 8, det[1] - 8, det[2] + 16, det[3] + 16], 14], [5.3, 6.4, [tz[0] - 8, tz[1] - 8, tz[2] + 16, tz[3] + 16 + 14], 12], [10.1, 11.5, [vis[0] - 8, vis[1] - 8, vis[2] + 16, vis[3] + 16], 14]]),
      rings: [{ rect: [pv[0], pv[1], pv[2], pv[3]], from: 7.1, to: 9.7, pad: 6, r: 14 }],
      callouts: [
        { at: [idn[0] + idn[2] - 20, idn[1] + 70], dx: 200, dy: 40, text: "How you appear across the app", from: 2.7, to: 3.8, s: true },
        { at: [det[0] + 520, det[1] + 70], dx: 170, dy: 60, text: "Industry · size · founded", from: 4.0, to: 4.9, s: true },
        { at: [tz[0] + tz[2] - 60, tz[1] + 18], dx: 150, dy: -70, text: "Deadlines are calendar dates", from: 5.5, to: 6.5, tone: "warn", s: true },
        { at: [pv[0] + 144, pv[1] + 110], dx: 20, dy: 170, text: "Live preview", from: 7.1, to: 9.6 },
        { at: [swX(4), swY], dx: -80, dy: 90, text: "Whole app recolours", from: 7.3, to: 9.6, tone: "ok" },
      ],
      cursor: [[5.6, 980, 620], [6.9, swX(3), swY, "c"], [7.6, swX(5), swY, "c"], [8.3, swX(6), swY, "c"], [9.0, swX(4), swY, "c"], [9.8, 800, 700]],
    }),
  });
})();

/* ═════════════ 11 · PEOPLE & ROLES ═════════════ */
(() => {
  const roles = R("people-top", "roles"), pr = (k) => R("pm-2-filled", k), role = pr("role"), team = pr("team"), creds = R("pm-3-credentials", "creds"), tabs = R("pm-8-deactivated", "tabs"), toast = R("pm-8-deactivated", "toast"), la = R("pm-7-last-admin", "toast"), lrole = R("pm-7-last-admin", "role");
  const OX = -360, OY = -375;
  defineScene({
    id: "people", dur: 13.0,
    build(ctx) {
      const main = Win(ctx.root, {
        base: 0.85, spotScroll: false, urls: [[0, "/admin/people"]], anchor: [[0, { x: CX, y: CY }]],
        fx: [[0, { op: 0.38, blur: 16, sc: 0.93 }], [1.2, { op: 0.38, blur: 16, sc: 0.93 }], [2.1, { op: 1, blur: 0, sc: 1 }], [6.9, { op: 1, blur: 0, sc: 1 }], [7.25, { op: 0.28, blur: 7, sc: 1 }], [8.6, { op: 0.28, blur: 7, sc: 1 }], [8.95, { op: 1, blur: 0, sc: 1 }]],
        cam: [C(0, 1, 720, 450, { ry: -9, rx: 4 }), C(1.2, 1, 720, 450, { ry: -9, rx: 4 }), C(2.3, 1.2, 700, 200, { ry: 0, rx: 0 }), C(3.3, 1.2, 700, 200), C(3.9, 1.45, 720, 440), C(5.4, 1.45, 720, 440), C(5.9, 1.65, 720, 440), C(7.0, 1.65, 720, 440), C(9.0, 1.45, 1060, 700), C(10.3, 1.45, 1060, 700), C(10.9, 1.15, 900, 560), C(12.4, 1.15, 900, 560)],
        layers: [
          { img: "people-top", from: 0 },
          { img: "pm-0-empty", from: 3.4, fade: 0.2 },
          { img: "pm-1-name-0", from: 3.9, fade: 0.04 }, { img: "pm-1-name-1", from: 4.15, fade: 0.04 }, { img: "pm-1-name-2", from: 4.4, fade: 0.04 },
          { img: "pm-2-filled", from: 4.9, fade: 0.15 },
          { img: "pm-3-credentials", from: 5.9, fade: 0.2 },
          { img: "pm-8-deactivated", from: 8.95, fade: 0.25 },
          { img: "pm-7-last-admin", from: 10.7, fade: 0.2 },
        ],
        spot: SPOTS([[2.4, 3.4, [roles[0] - 6, roles[1] - 6, roles[2] + 12, roles[3] + 12], 14]]),
        rings: [
          { rect: [role[0], role[1], team[0] + team[2] - role[0], role[3]], from: 5.0, to: 5.8, pad: 5, r: 8 },
          { rect: creds, from: 6.0, to: 7.0, tone: "ok", pad: 6, r: 10 },
          { rect: toast, from: 9.1, to: 10.4, tone: "ok", pad: 4, r: 10 },
          { rect: la, from: 10.9, to: 12.6, tone: "danger", pad: 4, r: 10 },
        ],
        callouts: [
          { at: [roles[0] + 540, roles[1] + 30], dx: 0, dy: 90, text: "Admin · Manager · Member", from: 2.6, to: 3.5 },
          { at: [role[0] + 100, role[1] + 18], dx: -60, dy: -120, text: "Pick a role", from: 5.0, to: 5.8 },
          { at: [creds[0] + 330, creds[1] + 60], dx: 120, dy: -130, text: "Temporary password — shown once", from: 6.0, to: 7.0, tone: "ok" },
          { at: [toast[0] + 20, toast[1] + 20], dx: -240, dy: -60, text: "Signed out everywhere, instantly", from: 9.2, to: 10.4, tone: "warn" },
          { at: [la[0] + 40, la[1] + 30], dx: -150, dy: -90, text: "The last admin is protected", from: 11.0, to: 12.7, tone: "danger" },
        ],
        cursor: [[1.9, 1250, 380], [3.0, 1297, 303, "c"], [4.6, 720, 330], [4.9, pr("create")[0] + 60, pr("create")[1] + 18], [5.2, pr("create")[0] + 60, pr("create")[1] + 18, "c"], [6.3, 900, 560], [8.4, 700, 500], [9.0, 760, 700]],
      }, ctx);
      const pw = Win(ctx.root, {
        w: 380, h: 310, ox: OX, oy: OY, chrome: false, base: 1.4, radius: 22, anchor: [[0, { x: 1230, y: 560 }]],
        fx: [[0, { op: 0, sc: 0.9 }], [7.0, { op: 0, sc: 0.9 }], [7.45, { op: 1, sc: 1 }], [8.55, { op: 1, sc: 1 }], [8.9, { op: 0, sc: 1.04 }]],
        cam: [C(0, 1, 190, 155)],
        layers: [{ img: "pw-forced", from: 0 }],
        callouts: [{ at: [190, 8], dx: 0, dy: -46, text: "Forced password change at first sign-in", from: 7.6, to: 8.7, tone: "ok", size: 21 }],
      }, ctx);
      [3.4, 3.9, 4.15, 4.4].forEach((u) => ctx.ev(u, "key"));
      ctx.ev(3.0, "click"); ctx.ev(5.2, "click"); ctx.ev(5.95, "chime"); ctx.ev(7.3, "whoosh"); ctx.ev(9.0, "pop"); ctx.ev(10.8, "error");
      const t = Title(ctx.root, {
        n: "10", eyebrow: "People &amp; roles", html: "People, roles,<br><span class='grad'>under control.</span>", lines: 2, tB: 1.2,
        sub: "Add teammates, decide what they can do, and cut access in one click.",
        bullets: [[2.6, "Admin · Manager · Member roles"], [4.2, "One-time temporary password"], [7.2, "Forced password change on first sign-in"], [8.9, "Reset passwords · deactivate instantly"], [10.8, "The last admin can never be demoted"]],
      });
      [2.6, 4.2, 7.2, 8.9, 10.8].forEach((u) => ctx.ev(u, "tick"));
      return { update(u) { main.update(u); pw.update(u); t.update(u); } };
    },
  });
})();

/* ═════════════ 12 · TEAMS ═════════════ */
(() => {
  const card = R("tm-2-created", "card"), hdr = R("team-top", "header"), grid = R("team-top", "grid");
  feature("teams", 7.0, {
    title: {
      n: "11", eyebrow: "Teams", html: "Teams &amp;<br><span class='grad'>workload.</span>", lines: 2, intro: "quick",
      sub: "Group people into teams, then see who's carrying what.",
      bullets: [[1.8, "Create teams: Engineering, Design, Growth…"], [3.8, "Directory with open &amp; overdue per person"]],
    },
    events: [[3.45, "whoosh"]],
    win: () => ({
      base: 0.85, anchor: [[0, { x: CX, y: CY }]], urls: [[0, "/admin/teams"], [3.5, "/team"]],
      cam: [C(0, 1, 720, 450), C(1.0, 1.35, 560, 300), C(3.2, 1.35, 560, 300), C(3.9, 1.3, 760, 330), C(6.5, 1.3, 760, 330)],
      layers: [{ img: "tm-2-created", from: 0 }, { img: "team-top", from: 3.45, fade: 0.3 }],
      rings: [{ rect: card, from: 1.1, to: 3.2, tone: "ok", pad: 6, r: 14 }, { rect: [grid[0], grid[1], 312, 125], from: 4.3, to: 6.4, pad: 6, r: 14 }],
      callouts: [{ at: [card[0] + card[2], card[1] + 20], dx: 150, dy: -100, text: "New team created", from: 1.2, to: 3.2, tone: "ok" }, { at: [grid[0] + 180, grid[1] + 58], dx: 330, dy: 70, text: "Open · overdue, per person", from: 4.4, to: 6.5, tone: "danger" }],
    }),
  });
})();

/* ═════════════ 13 · ACCESS CONTROL ═════════════ */
defineScene({
  id: "roles", dur: 14.0,
  build(ctx) {
    const rows = [
      ["Company profile, people, roles &amp; teams", "y", "n", "n"],
      ["Create tasks &amp; assign to others", "y", "y", "own tasks only"],
      ["Edit / delete any task", "y", "y", "only ones they created"],
      ["Change status", "any task", "any task", "tasks assigned to them"],
      ["See all tasks", "y", "y", "per company setting"],
      ["Comment", "y", "y", "tasks they can see"],
      ["Team workload view", "y", "y", "n"],
    ];
    const mx = h("div", "card", ctx.root, { left: "690px", top: "150px", width: "1160px", padding: "0" });
    const head = h("div", "", mx, { display: "grid", gridTemplateColumns: "430px 1fr 1fr 1fr", alignItems: "center", height: "96px", padding: "0 34px", borderBottom: "1px solid rgba(255,255,255,.1)" });
    h("div", "", head).innerHTML = `<span style="font:600 19px Inter;letter-spacing:.14em;color:rgba(255,255,255,.4);text-transform:uppercase">Permission</span>`;
    const roleCols = [["Admin", "#c9a8f0", "rgba(144,101,176,.28)"], ["Manager", "#9ccbf0", "rgba(59,130,196,.28)"], ["Member", "#d8d6d2", "rgba(155,154,151,.25)"]];
    const heads = roleCols.map(([n, c, bg]) => { const d = h("div", "", head, { display: "flex", justifyContent: "center" }); const p = h("span", "", d, { padding: "9px 20px", borderRadius: "10px", background: bg, color: c, font: "650 24px Inter", letterSpacing: "-.01em" }); p.textContent = n; return d; });
    const check = `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;
    const cells = rows.map(([label, a, m, b], i) => {
      const r = h("div", "", mx, { display: "grid", gridTemplateColumns: "430px 1fr 1fr 1fr", alignItems: "center", height: "92px", padding: "0 34px", borderBottom: i < rows.length - 1 ? "1px solid rgba(255,255,255,.06)" : "none" });
      const l = h("div", "", r); l.innerHTML = label; Object.assign(l.style, { font: "550 24px/1.25 Inter", color: "#fff", letterSpacing: "-.01em" });
      [a, m, b].forEach((v) => {
        const c = h("div", "", r, { textAlign: "center", font: "500 21px/1.25 Inter", color: "rgba(255,255,255,.78)" });
        c.innerHTML = v === "y" ? check : v === "n" ? `<span style="color:rgba(255,255,255,.28);font-size:30px">–</span>` : v;
      });
      return r;
    });
    const note = h("div", "mono", ctx.root, { position: "absolute", left: "690px", top: "930px", width: "1160px", textAlign: "center", fontSize: "21px", color: "rgba(255,255,255,.6)" });
    note.innerHTML = `<span style="color:#4ade80">✓</span> enforced on the server — <span style="color:#8b8dff">permissions.ts</span> + every action`;

    const w = Win(ctx.root, {
      base: 0.85, urls: [[0, "/dashboard"], [10.0, "/tasks?task=claim"]], anchor: [[0, { x: CX, y: CY }]],
      fx: [[0, { op: 0, sc: 0.94 }], [8.2, { op: 0, sc: 0.94 }], [8.8, { op: 1, sc: 1 }], [13.5, { op: 1, sc: 1 }]],
      cam: [C(0, 1, 720, 450), C(8.8, 1, 720, 450), C(9.4, 1.55, 160, 330), C(10.0, 1.55, 160, 330), C(10.5, 1.75, 1100, 200), C(12.2, 1.75, 1100, 200), C(12.7, 1.45, 720, 450), C(13.6, 1.45, 720, 450)],
      layers: [{ img: "mem-dash-top", from: 8.4 }, { img: "claim-0", from: 10.2, fade: 0.2 }, { img: "claim-1", from: 11.5, fade: 0.2 }, { img: "mem-newtask", from: 12.7, fade: 0.2 }],
      rings: [{ rect: R("claim-0", "claim"), from: 10.3, to: 11.4, pad: 5, r: 8 }, { rect: R("mem-newtask", "assignee"), from: 12.9, to: 13.8, pad: 5, r: 8 }],
      callouts: [
        { at: [120, 360], dx: 330, dy: -70, text: "No admin menu for members", from: 9.4, to: 10.2, tone: "warn", size: 22 },
        { at: [1010, 177], dx: -170, dy: -88, text: "Claim in one click", from: 10.4, to: 11.4, tone: "ok" },
        { at: [1060, 177], dx: -220, dy: 90, text: "Now it's yours", from: 11.6, to: 12.6, tone: "ok" },
        { at: [R("mem-newtask", "assignee")[0] + 60, R("mem-newtask", "assignee")[1] + 18], dx: -10, dy: -140, text: "Members add personal tasks", from: 12.9, to: 13.8 },
      ],
      cursor: [[10.3, 1250, 400], [10.9, 1009, 177, "c"], [12.2, 1100, 300]],
    }, ctx);
    ctx.ev(10.9, "click"); ctx.ev(11.0, "chime");
    rows.forEach((_, i) => ctx.ev(2.6 + i * 0.5, "tick"));
    const t = Title(ctx.root, {
      n: "12", eyebrow: "Access control", html: "The right access<br>for <span class='grad'>everyone.</span>", lines: 2, tB: 1.2,
      sub: "Every rule is enforced on the server — hiding a button is never the only protection.",
      bullets: [[8.6, "Role-aware navigation"], [10.3, "Members <b>claim</b> unassigned tasks"], [12.5, "…and add personal tasks"]],
    });
    [8.6, 10.3, 12.5].forEach((u) => ctx.ev(u, "tick"));
    return {
      update(u) {
        const mIn = seg(u, 2.0, 2.7, E.out), mOut = seg(u, 7.4, 8.0, E.in);
        mx.style.opacity = mIn * (1 - mOut); mx.style.transform = `translate3d(0,${(1 - mIn) * 40 + mOut * -30}px,0) scale(${lerp(0.97, 1, mIn)})`;
        heads.forEach((d, i) => { const p = seg(u, 2.3 + i * 0.12, 2.8 + i * 0.12, E.out); d.style.opacity = p; });
        cells.forEach((r, i) => { const p = seg(u, 2.6 + i * 0.5, 3.1 + i * 0.5, E.out); r.style.opacity = p; r.style.transform = `translate3d(${(1 - p) * 30}px,0,0)`; });
        note.style.opacity = seg(u, 6.4, 7.0, E.out) * (1 - mOut);
        w.update(u); t.update(u);
      },
    };
  },
});

/* ═════════════ 14 · DARK MODE + MOBILE ═════════════ */
(() => {
  const theme = R("dash-top", "theme"), tipT = R("tip-theme", "tip");
  defineScene({
    id: "dark", dur: 9.0,
    build(ctx) {
      const w = Win(ctx.root, {
        base: 0.85, anchor: [[0, { x: CX, y: CY }], [0.9, { x: CX, y: CY }], [1.5, { x: 1200, y: 420 }], [2.7, { x: 1200, y: 420 }], [3.3, { x: CX, y: CY }]], urls: [[0, "/dashboard"], [3.0, "/tasks?scope=all"], [3.9, "/tasks?scope=all&view=board"]],
        theme: [[0, 0], [1.85, 0], [2.4, 1]],
        fx: [[0, { op: 1, sc: 1, dx: 0 }], [4.4, { op: 1, sc: 1, dx: 0 }], [5.1, { op: 0, sc: 0.9, dx: -120 }]],
        cam: [C(0, 1, 720, 450), C(1.0, 1.9, 1230, 30), C(2.7, 1.9, 1230, 30), C(3.3, 1, 720, 450), C(4.5, 1, 720, 450)],
        layers: [
          { img: "dash-top", from: 0 },
          { img: "tip-theme", clip: [1100, 0, 1440, 100], from: 1.15, to: 1.85, fade: 0.15, fadeOut: 0.04 },
          { img: "dash-dark-top", from: 1.9, fade: 0.45 },
          { img: "tasks-dark-top", from: 3.1, fade: 0.3 },
          { img: "board-dark-top", from: 4.0, fade: 0.3 },
        ],
        rings: [{ rect: theme, from: 0.9, to: 2.0, pad: 6, r: 10 }],
        callouts: [{ at: [tipT[0] + tipT[2] / 2, tipT[1] + 14], dx: -60, dy: 110, text: "One click to dark", from: 1.3, to: 2.8 }],
        cursor: [[0.2, 1000, 300], [0.9, theme[0] + 16, theme[1] + 16], [1.85, theme[0] + 16, theme[1] + 16, "c"], [2.6, 1100, 350]],
      }, ctx);
      ctx.ev(1.85, "click"); ctx.ev(4.9, "whoosh");
      // phones
      const phones = [["m-dash-top", "Dashboard", 880, 560, 0], ["m-tasks-top", "Tasks", 1250, 520, 0.14], ["m-peek", "Task panel", 1620, 560, 0.28]].map(([img, label, cx, cy, d]) => {
        const sw = 340, sh = Math.round((sw * 844) / 390), p = h("div", "phone", ctx.root, { width: sw + 22 + "px", height: sh + 22 + "px", left: cx - (sw + 22) / 2 + "px", top: cy - (sh + 22) / 2 + "px" });
        const scr = h("div", "scr", p);
        if (!ctx.dry) { const im = h("img", "", scr); im.src = ASSET(img); PENDING.add(im); }
        const lab = h("div", "chip", ctx.root, { left: cx - 90 + "px", top: cy + sh / 2 + 36 + "px", width: "180px", justifyContent: "center", fontSize: "20px", padding: "10px 18px" }); lab.style.position = "absolute"; lab.textContent = label;
        return { p, lab, d, cy };
      });
      const t = Title(ctx.root, {
        n: "13", eyebrow: "Everywhere", html: "Dark mode.<br><span class='grad'>Mobile ready.</span>", lines: 2, intro: "quick",
        sub: "One click to dark. The layout adapts all the way down to your phone.",
        bullets: [[1.8, "Dark mode, remembered per browser"], [3.3, "Responsive — sidebar becomes a drawer"], [5.6, "Same overdue-first view on mobile"]],
      });
      [1.8, 3.3, 5.6].forEach((u) => ctx.ev(u, "tick"));
      [0, 1, 2].forEach((i) => ctx.ev(4.9 + i * 0.14, "pop"));
      return {
        update(u) {
          w.update(u); t.update(u);
          phones.forEach(({ p, lab, d, cy }) => {
            const a = seg(u, 4.8 + d, 5.7 + d, E.out), fl = Math.sin(u * 1.3 + d * 7) * 7;
            p.style.opacity = a; p.style.transform = `translate3d(0,${(1 - a) * 180 + fl}px,0) rotate(${(1 - a) * 4}deg)`;
            lab.style.opacity = seg(u, 5.5 + d, 6.1 + d, E.out); lab.style.transform = `translate3d(0,${fl * 0.4}px,0)`;
          });
        },
      };
    },
  });
})();

/* ═════════════ 15 · SECURITY ═════════════ */
defineScene({
  id: "security", dur: 8.0,
  build(ctx) {
    const items = [
      ["lock", "Hashed passwords", "bcrypt — never stored in plain text"],
      ["shield", "Signed sessions", "httpOnly · SameSite=Lax · Secure JWT cookie"],
      ["refresh", "Re-checked every request", "Deactivations, resets &amp; password changes apply instantly"],
      ["ban", "Brute-force lockout", "15-minute lock after 5 failed attempts"],
      ["table", "Row Level Security", "Enabled on every table — Supabase-safe"],
      ["server", "Server-side permissions", "Every action authorised, not just hidden"],
    ];
    const cards = items.map(([ic, ti, de], i) => {
      const c = h("div", "card", ctx.root, { left: 700 + (i % 2) * 596 + "px", top: 200 + Math.floor(i / 2) * 232 + "px", width: "566px", height: "204px", padding: "30px 32px" });
      c.innerHTML = `<div style="display:flex;align-items:center;gap:16px">${svgIcon(ic, 38)}<span style="font:650 30px 'Inter Display',Inter;color:#fff;letter-spacing:-.02em">${ti}</span></div><div style="margin-top:16px;font:400 23px/1.45 Inter;color:rgba(255,255,255,.66)">${de}</div>`;
      ctx.ev(2.5 + i * 0.5, "tick");
      return c;
    });
    ctx.ev(2.4, "whoosh");
    // Settings inset: profile + password change (changing it signs out every other device)
    const SC = 0.62, CW = 660, CH = 560, CX0 = 470, CY0 = 70;
    const inset = h("div", "", ctx.root, { position: "absolute", left: "96px", top: "640px", width: CW * SC + "px", height: CH * SC + "px", borderRadius: "18px", overflow: "hidden", background: "#fff", boxShadow: "0 30px 80px rgba(0,0,0,.65), 0 0 0 1px rgba(255,255,255,.14)" });
    if (!ctx.dry) { const im = loadImg(ASSET("settings"), inset); const m = M().settings; Object.assign(im.style, { position: "absolute", maxWidth: "none", width: m.w * SC + "px", height: m.h * SC + "px", left: -CX0 * SC + "px", top: -CY0 * SC + "px" }); }
    const cap = h("div", "", ctx.root, { position: "absolute", left: "96px", top: "590px", width: "520px", font: "600 22px/1.3 Inter", color: "#fff", display: "flex", alignItems: "center", gap: "10px" });
    cap.innerHTML = `${svgIcon("lock", 24)}<span>Your account, your control</span>`;
    const cap2 = h("div", "", ctx.root, { position: "absolute", left: "96px", top: 640 + CH * SC + 14 + "px", width: "520px", font: "400 19px/1.4 Inter", color: "rgba(255,255,255,.58)" });
    cap2.textContent = "Edit your profile or change your password — every other device is signed out.";
    ctx.ev(4.8, "pop");
    const t = Title(ctx.root, {
      n: "14", eyebrow: "Security", html: "Secure by<br><span class='grad'>design.</span>", lines: 2, tB: 1.1,
      sub: "Small, auditable, and enforced on the server — not in the browser.",
    });
    ctx.root.append(inset, cap, cap2); // stack above the title scrim
    return {
      update(u) {
        t.update(u);
        const ip = seg(u, 4.6, 5.3, E.out), io = 1 - seg(u, 7.4, 7.8);
        for (const e of [inset, cap, cap2]) { e.style.opacity = ip * io; e.style.transform = `translate3d(0,${(1 - ip) * 30}px,0)`; }
        cards.forEach((c, i) => {
          const p = seg(u, 2.5 + i * 0.5, 3.1 + i * 0.5, E.out), glow = Math.max(0, 1 - Math.abs(u - (3.1 + i * 0.5)) / 0.9);
          c.style.opacity = p; c.style.transform = `translate3d(0,${(1 - p) * 50}px,0) scale(${lerp(0.96, 1, p)})`;
          c.style.borderColor = `rgba(${lerp(255, 139, glow) | 0},${lerp(255, 141, glow) | 0},${lerp(255, 255, glow) | 0},${0.12 + glow * 0.5})`;
        });
      },
    };
  },
});

/* ═════════════ 16 · STACK & DEPLOY ═════════════ */
defineScene({
  id: "stack", dur: 8.0,
  build(ctx) {
    const chipsTxt = ["Next.js 16", "React 19", "Tailwind v4", "TypeScript", "Drizzle ORM", "PostgreSQL"];
    const chips = chipsTxt.map((c, i) => { const e = h("div", "chip", ctx.root, { position: "absolute", left: 700 + (i % 3) * 388 + "px", top: 190 + Math.floor(i / 3) * 84 + "px", width: "364px", justifyContent: "center", fontSize: "30px", padding: "18px 24px" }); e.textContent = c; ctx.ev(2.3 + i * 0.12, "tick"); return e; });
    const nodes = [["github", "GitHub", "push to deploy"], ["triangle", "Vercel", "build runs migrations"], ["db", "Postgres", "Neon · Supabase"], ["rocket", "/setup", "create company &amp; admin"]];
    const nEls = nodes.map(([ic, ti, de], i) => {
      const n = h("div", "card", ctx.root, { left: 700 + i * 296 + "px", top: 440 + "px", width: "250px", height: "176px", padding: "26px 24px", textAlign: "center" });
      n.innerHTML = `<div style="display:grid;place-items:center">${svgIcon(ic, 44)}</div><div style="margin-top:14px;font:650 26px 'Inter Display',Inter;color:#fff">${ti}</div><div style="margin-top:6px;font:400 19px/1.35 Inter;color:rgba(255,255,255,.6)">${de}</div>`;
      ctx.ev(3.6 + i * 0.45, "tick");
      return n;
    });
    const arrows = [0, 1, 2].map((i) => { const a = h("div", "", ctx.root, { left: 700 + i * 296 + 252 + "px", top: 520 + "px", width: "40px", height: "20px" }); a.style.position = "absolute"; a.innerHTML = `<svg width="40" height="20" viewBox="0 0 40 20" fill="none" stroke="#8b8dff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M2 10h34M28 3l8 7-8 7"/></svg>`; return a; });
    const foot = [["zap", "Zero-setup local dev", "Embedded Postgres (PGlite) — nothing to install"], ["clock", "Daily overdue digest", "Vercel Cron → /api/cron/overdue, 06:00 UTC"], ["mail", "Assignment emails", "Optional — Brevo SMTP, off until configured"]].map(([ic, ti, de], i) => {
      const c = h("div", "card", ctx.root, { left: 700 + i * 394 + "px", top: 680 + "px", width: "368px", height: "170px", padding: "24px 26px" });
      c.innerHTML = `<div style="display:flex;align-items:center;gap:12px">${svgIcon(ic, 30)}<span style="font:650 24px 'Inter Display',Inter;color:#fff">${ti}</span></div><div style="margin-top:12px;font:400 19px/1.42 Inter;color:rgba(255,255,255,.62)">${de}</div>`;
      ctx.ev(5.6 + i * 0.4, "tick");
      return c;
    });
    ctx.ev(2.2, "whoosh");
    const t = Title(ctx.root, {
      n: "15", eyebrow: "Under the hood", html: "Modern stack.<br><span class='grad'>One-click deploy.</span>", lines: 2, tB: 1.1,
      sub: "Built to run on Vercel with the Postgres you already use.",
    });
    return {
      update(u) {
        t.update(u);
        chips.forEach((c, i) => { const p = seg(u, 2.3 + i * 0.12, 2.9 + i * 0.12, E.out); c.style.opacity = p; c.style.transform = `translate3d(0,${(1 - p) * 30}px,0) scale(${lerp(0.94, 1, p)})`; });
        nEls.forEach((c, i) => { const p = seg(u, 3.6 + i * 0.45, 4.2 + i * 0.45, E.out); c.style.opacity = p; c.style.transform = `translate3d(0,${(1 - p) * 40}px,0)`; });
        arrows.forEach((a, i) => { const p = seg(u, 4.0 + i * 0.45, 4.5 + i * 0.45, E.out); a.style.opacity = p; a.style.transform = `translate3d(${(1 - p) * -14}px,0,0)`; });
        foot.forEach((c, i) => { const p = seg(u, 5.6 + i * 0.4, 6.2 + i * 0.4, E.out); c.style.opacity = p; c.style.transform = `translate3d(0,${(1 - p) * 36}px,0)`; });
      },
    };
  },
});

/* ═════════════ 17 · OUTRO ═════════════ */
defineScene({
  id: "outro", dur: 6.5, last: true,
  build(ctx) {
    ctx.ev(0.9, "shimmer"); ctx.ev(5.0, "tail");
    const r = ctx.root;
    const logo = h("div", "logo", r, { position: "absolute", left: "894px", top: "230px", width: "132px", height: "132px", borderRadius: "34px", fontSize: "70px", boxShadow: "0 20px 80px rgba(99,102,241,.7), inset 0 1px 0 rgba(255,255,255,.4)" });
    logo.textContent = "T";
    const hd = h("div", "h1", r, { position: "absolute", left: "0", top: "420px", width: "1920px", textAlign: "center", fontSize: "124px" });
    const hw = splitWords(hd, "Nothing overdue<br><span class='grad'>left behind.</span>");
    const sub = h("div", "", r, { position: "absolute", left: "0", top: "770px", width: "1920px", textAlign: "center", font: "500 30px/1.4 Inter", color: "rgba(255,255,255,.7)", letterSpacing: "-.01em" });
    sub.innerHTML = "<b style='color:#fff'>Task Manager</b> &nbsp;·&nbsp; calm work for small teams";
    const line = h("div", "", r, { position: "absolute", left: "0", top: "830px", width: "1920px", textAlign: "center", font: "400 23px/1.4 Inter", color: "rgba(255,255,255,.45)" });
    line.textContent = "Next.js 16 · React 19 · Tailwind v4 · Drizzle · PostgreSQL";
    return {
      update(u) {
        const lp = seg(u, 0.5, 1.2, E.out);
        logo.style.opacity = lp; logo.style.transform = `scale(${lerp(0.7, 1, E.back(clamp((u - 0.5) / 0.8)))})`;
        wordsIn(hw, u, 0.9, 0.1);
        sub.style.opacity = seg(u, 2.0, 2.7, E.out); sub.style.transform = `translate3d(0,${(1 - seg(u, 2.0, 2.7, E.out)) * 16}px,0)`;
        line.style.opacity = seg(u, 2.5, 3.2, E.out);
      },
    };
  },
});
