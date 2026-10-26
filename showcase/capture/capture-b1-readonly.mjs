// Phase B1 — seeded database, read-only: every screen of the product, light + dark + mobile + member/manager views.
// Safe to re-run any number of times (nothing is modified).
import { open, login, shot, shotScrollable, typeFrames, settle, wait, BASE } from "./lib.mjs";

const attempt = async (label, fn) => {
  try {
    await fn();
  } catch (e) {
    console.error(`✗ ${label}:`, e.message.split("\n")[0]);
  }
};

// ───────────── Admin · desktop · light ─────────────
{
  const { browser, page } = await open();
  await login(page, "founder@example.com");
  const nav = {
    sidebar: page.locator("aside nav"),
    navDash: page.locator('nav a[href="/dashboard"]'),
    navTasks: page.locator('nav a[href="/tasks"]'),
    navTeam: page.locator('nav a[href="/team"]'),
    navPeople: page.locator('nav a[href="/admin/people"]'),
    navTeams: page.locator('nav a[href="/admin/teams"]'),
    navCompany: page.locator('nav a[href="/admin/company"]'),
    badge: page.locator('nav a[href="/tasks"] span[title$="overdue"]'),
    bell: page.getByRole("button", { name: /Notifications/ }),
    theme: page.getByRole("button", { name: "Toggle dark mode" }),
    newTask: page.getByRole("button", { name: "New task" }),
  };

  await attempt("dashboard", async () => {
    await page.goto(`${BASE}/dashboard`);
    await settle(page, 700);
    await shotScrollable(page, "dash", {
      rects: {
        ...nav,
        greeting: page.locator("h1"),
        overdue: page.locator('section[aria-labelledby="overdue-h"]'),
        stats: page.locator("div.grid.grid-cols-2").first(),
        statOverdue: page.locator('a[href="/tasks?due=overdue"]').nth(1),
        dueSoon: page.locator('section:has(h2:text("Due in the next 7 days"))'),
        workload: page.locator('section:has(h2:text("Team workload"))'),
        momentum: page.locator('section:has(h2:text("Momentum"))'),
        activity: page.locator('section:has(h2:text("Recent activity"))'),
      },
    });
  });

  await attempt("tasks list", async () => {
    await page.goto(`${BASE}/tasks?scope=all`);
    await settle(page, 700);
    await shotScrollable(page, "tasks", {
      rects: {
        ...nav,
        banner: page.locator('a[href*="due=overdue"]').filter({ hasText: "overdue task" }),
        toolbar: page.locator("main > div > div").nth(0),
        scope: page.getByRole("tablist", { name: "Scope" }),
        view: page.getByRole("group", { name: "View" }),
        search: page.getByLabel("Search tasks"),
        gOverdue: page.locator('details:has(> summary:has-text("Overdue"))').first(),
        gToday: page.locator('details:has(> summary:has-text("Due today"))').first(),
        gUpcoming: page.locator('details:has(> summary:has-text("Upcoming"))').first(),
        gNone: page.locator('details:has(> summary:has-text("No deadline"))').first(),
        gDone: page.locator('details:has(> summary:has-text("Completed"))').first(),
        rowFix: page.locator("li", { hasText: "Fix checkout timeout on slow networks" }).first(),
      },
    });
  });

  await attempt("board", async () => {
    await page.goto(`${BASE}/tasks?scope=all&view=board`);
    await settle(page, 700);
    await shotScrollable(page, "board", {
      rects: {
        ...nav,
        colTodo: page.locator('section[aria-label="Not started"]'),
        colProg: page.locator('section[aria-label="In progress"]'),
        colReview: page.locator('section[aria-label="In review"]'),
        colBlocked: page.locator('section[aria-label="Blocked"]'),
        colDone: page.locator('section[aria-label="Done"]'),
        cardFix: page.locator('section[aria-label="In progress"] li', { hasText: "Fix checkout timeout" }),
        view: page.getByRole("group", { name: "View" }),
      },
    });
  });

  await attempt("peek", async () => {
    await page.goto(`${BASE}/tasks?scope=all`);
    await settle(page, 500);
    await page.getByRole("link", { name: "Fix checkout timeout on slow networks" }).first().click();
    await page.waitForURL(/task=/);
    await settle(page, 700);
    const P = page.locator('aside[role="dialog"]');
    const peek = {
      panel: P,
      title: P.getByLabel("Task title"),
      status: P.locator('select[aria-label="Status"]'),
      assignee: P.locator('select[aria-label="Assignee"]'),
      deadline: P.locator('input[aria-label="Deadline"]'),
      priority: P.locator('select[aria-label="Priority"]'),
      tags: P.getByLabel("Tags", { exact: true }),
      description: page.locator('section[aria-label="Description"]'),
      comments: page.locator('section[aria-label="Comments"]'),
      commentBox: page.getByLabel("Write a comment"),
      activity: page.locator("summary", { hasText: "Activity" }),
      close: page.locator('aside[role="dialog"] header a').first(),
      del: page.getByRole("button", { name: "Delete" }),
    };
    await shot(page, "peek-top", { rects: peek });
    await page.locator('aside[role="dialog"] .overflow-y-auto').evaluate((el) => (el.scrollTop = el.scrollHeight));
    await wait(200);
    await shot(page, "peek-bottom", { rects: peek });
    await page.locator("summary", { hasText: "Activity" }).click();
    await page.locator('aside[role="dialog"] .overflow-y-auto').evaluate((el) => (el.scrollTop = el.scrollHeight));
    await wait(250);
    await shot(page, "peek-activity", { rects: peek });
  });

  await attempt("filters", async () => {
    await page.goto(`${BASE}/tasks?scope=all&due=overdue`);
    await settle(page, 600);
    const f = {
      toolbar: page.locator("main > div > div").nth(0),
      dueSel: page.getByLabel("Deadline", { exact: true }).first(),
      status: page.getByLabel("Status", { exact: true }).first(),
      prio: page.getByLabel("Priority", { exact: true }).first(),
      who: page.getByLabel("Assignee", { exact: true }).first(),
      search: page.getByLabel("Search tasks"),
      clear: page.getByRole("button", { name: "Clear" }),
    };
    await shot(page, "filter-overdue", { rects: f });
    await page.goto(`${BASE}/tasks?scope=all&priority=URGENT&status=all`);
    await settle(page, 600);
    await shot(page, "filter-urgent", { rects: f });
    await page.goto(`${BASE}/tasks?scope=all`);
    await settle(page, 500);
    const s = page.getByLabel("Search tasks");
    const frames = ["la", "laun", "launch"];
    for (const [i, t] of frames.entries()) {
      await s.fill(t);
      await wait(900);
      await settle(page, 300);
      await shot(page, `search-${i}`, { rects: f });
    }
  });

  await attempt("notifications", async () => {
    await page.goto(`${BASE}/dashboard`);
    await settle(page, 500);
    await page.getByRole("button", { name: /Notifications/ }).click();
    await wait(300);
    await shot(page, "notif-open", {
      rects: { bell: nav.bell, panel: page.locator("div.absolute.right-0.top-full"), first: page.locator("div.absolute.right-0.top-full li").first() },
    });
  });

  await attempt("admin pages", async () => {
    await page.goto(`${BASE}/admin/people`);
    await settle(page, 700);
    await shotScrollable(page, "people", {
      rects: {
        ...nav,
        roles: page.locator('section[aria-label="Roles"]'),
        tabs: page.getByRole("tablist"),
        add: page.getByRole("button", { name: "Add team member" }),
        table: page.locator("table"),
        rowJordan: page.locator("tr", { hasText: "Jordan Lee" }),
        rowAlex: page.locator("tr", { hasText: "Alex Morgan" }),
        actionsJordan: page.locator("tr", { hasText: "Jordan Lee" }).locator("td").last(),
      },
    });
    await page.goto(`${BASE}/admin/teams`);
    await settle(page, 600);
    await shotScrollable(page, "teams", { rects: { ...nav, newTeam: page.getByRole("button", { name: "New team" }), grid: page.locator("ul.grid") } });
    await page.goto(`${BASE}/admin/company`);
    await settle(page, 700);
    await shotScrollable(page, "company", {
      rects: {
        ...nav,
        identity: page.locator('section:has(h2:text("Identity"))'),
        details: page.locator('section:has(h2:text("Details"))'),
        prefs: page.locator('section:has(h2:text("Workspace preferences"))'),
        tz: page.locator("#c-tz"),
        swatches: page.locator('fieldset:has(legend:text("Brand colour"))'),
        visibility: page.locator('fieldset:has(legend:text("Task visibility for members"))'),
        preview: page.locator("aside").last(),
        save: page.getByRole("button", { name: "Save changes" }),
      },
    });
  });

  await attempt("team + settings", async () => {
    await page.goto(`${BASE}/team`);
    await settle(page, 700);
    await shotScrollable(page, "team", { rects: { ...nav, header: page.locator("main section").first(), grid: page.locator("ul.grid").first() } });
    await page.goto(`${BASE}/settings`);
    await settle(page, 600);
    await shot(page, "settings", { rects: { ...nav, profile: page.locator('section[aria-labelledby="profile-h"]'), pw: page.locator('section[aria-labelledby="pw-h"]') } });
  });

  // ───────────── Dark mode ─────────────
  await attempt("dark", async () => {
    await page.goto(`${BASE}/dashboard`);
    await settle(page, 500);
    await page.getByRole("button", { name: "Toggle dark mode" }).click();
    await wait(300);
    await shotScrollable(page, "dash-dark", { rects: nav });
    await page.goto(`${BASE}/tasks?scope=all`);
    await settle(page, 600);
    await shotScrollable(page, "tasks-dark", { rects: nav });
    await page.goto(`${BASE}/tasks?scope=all&view=board`);
    await settle(page, 600);
    await shot(page, "board-dark-top", { rects: nav });
    await page.getByRole("button", { name: "Toggle dark mode" }).click(); // back to light
    await wait(300);
  });
  await browser.close();
}

// ───────────── Mobile ─────────────
await attempt("mobile", async () => {
  const { browser, page } = await open({ width: 390, height: 844, scale: 3, mobile: true });
  await login(page, "founder@example.com");
  await page.goto(`${BASE}/dashboard`);
  await settle(page, 700);
  await shotScrollable(page, "m-dash");
  await page.getByRole("button", { name: "Open menu" }).click();
  await wait(300);
  await shot(page, "m-drawer");
  await page.goto(`${BASE}/tasks?scope=all`);
  await settle(page, 700);
  await shotScrollable(page, "m-tasks");
  await page.getByRole("link", { name: "Fix checkout timeout on slow networks" }).first().click();
  await page.waitForURL(/task=/);
  await settle(page, 700);
  await shot(page, "m-peek");
  await browser.close();
});

// ───────────── Manager + member views ─────────────
await attempt("manager", async () => {
  const { browser, page } = await open();
  await login(page, "maya@example.com");
  await page.goto(`${BASE}/dashboard`);
  await settle(page, 700);
  await shotScrollable(page, "mgr-dash", { rects: { sidebar: page.locator("aside nav"), workload: page.locator('section:has(h2:text("Team workload"))') } });
  await page.goto(`${BASE}/tasks?scope=all`);
  await settle(page, 600);
  await shot(page, "mgr-tasks-top");
  await browser.close();
});

await attempt("member", async () => {
  const { browser, page } = await open();
  await login(page, "jordan@example.com");
  console.log("  member landed on", page.url());
  await page.goto(`${BASE}/dashboard`);
  await settle(page, 700);
  await shotScrollable(page, "mem-dash", { rects: { sidebar: page.locator("aside nav"), overdue: page.locator('section[aria-labelledby="overdue-h"]') } });
  await page.goto(`${BASE}/tasks`);
  await settle(page, 600);
  await shotScrollable(page, "mem-tasks", { rects: { scope: page.getByRole("tablist", { name: "Scope" }) } });
  await page.goto(`${BASE}/admin/people`);
  await settle(page, 600);
  console.log("  member → /admin/people ended on", page.url());
  await shot(page, "mem-admin-blocked");
  await browser.close();
});

console.log("read-only capture complete");
