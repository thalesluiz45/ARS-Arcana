import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";

import { chromium } from "playwright-core";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const ERROR_BASE = process.env.E2E_ERROR_BASE_URL ?? "http://localhost:3001";
const OUT = process.env.E2E_OUT_DIR ?? "e2e/artifacts";
const pageErrors = [];
const consoleErrors = [];
const failures = [];
const passes = [];

mkdirSync(OUT, { recursive: true });

function launchBrowser() {
  const executablePath = process.env.CHROME_PATH;
  return chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : { channel: "chrome" }),
  });
}

const browser = await launchBrowser();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  locale: "pt-BR",
  reducedMotion: "reduce",
});
const page = await context.newPage();

// The provider fetches the session collection once when the site shell mounts.
// Wait for that response before testing the signed-out save action.
const grimoireSnapshotResponse = page
  .waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/grimorios" &&
      response.request().method() === "GET",
    { timeout: 30000 },
  )
  .catch(() => null);

page.on("pageerror", (error) => pageErrors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});

async function step(name, operation) {
  try {
    await operation();
    passes.push(name);
    console.log(`PASS  ${name}`);
  } catch (error) {
    failures.push({ name, error });
    console.error(
      `FAIL  ${name}\n      ${error instanceof Error ? error.message : error}`,
    );
    throw error;
  }
}

async function api(path) {
  const response = await fetch(`${BASE}${path}`);
  assert.equal(
    response.status,
    200,
    `API ${path} respondeu ${response.status}`,
  );
  return response.json();
}

async function text(locator) {
  await locator.first().waitFor({ state: "visible", timeout: 15000 });
  return locator.first().innerText();
}

async function expectText(locator, expected, label) {
  const value = await text(locator);
  assert.ok(
    value
      .toLocaleLowerCase("pt-BR")
      .includes(expected.toLocaleLowerCase("pt-BR")),
    `${label ?? "texto"}: esperava “${expected}”, recebeu “${value.slice(0, 300)}”`,
  );
}

async function waitForBodyText(needle, timeout = 15000) {
  await page
    .getByText(needle, { exact: false })
    .first()
    .waitFor({ state: "visible", timeout });
}

async function waitForEnabled(locator, timeout = 15000) {
  await locator.first().waitFor({ state: "visible", timeout });
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await locator.first().isEnabled()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("o controle não ficou habilitado a tempo");
}

async function goto(path, waitUntil = "domcontentloaded") {
  await page.goto(`${BASE}${path}`, { waitUntil });
}

async function assertNoHorizontalOverflow(label) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  assert.ok(
    metrics.scrollWidth <= metrics.innerWidth + 1,
    `${label}: overflow horizontal (${metrics.scrollWidth} > ${metrics.innerWidth})`,
  );
}

function decodeReturnTo(url) {
  const value = new URL(url).searchParams.get("returnTo");
  assert.ok(value, "URL de login sem returnTo");
  return decodeURIComponent(value);
}

function normalizeInternalPath(value) {
  const url = new URL(value, BASE);
  const params = new URLSearchParams();
  for (const [key, param] of url.searchParams) {
    if (key === "from") {
      const inner = new URL(param, BASE);
      params.set(
        key,
        `${inner.pathname}?${new URLSearchParams(inner.searchParams).toString()}`,
      );
      continue;
    }
    params.set(key, param);
  }
  return `${url.pathname}?${params.toString()}`;
}

function assertSameInternalPath(actual, expected, label) {
  assert.equal(
    normalizeInternalPath(actual),
    normalizeInternalPath(expected),
    `${label}: destino diferente`,
  );
}

const OAUTH_PROVIDERS = {
  google: {
    id: "google",
    name: "Google",
    type: "oidc",
    signinUrl: `${BASE}/api/auth/signin/google`,
    callbackUrl: `${BASE}/api/auth/callback/google`,
  },
};

/**
 * Replaces the Auth.js endpoints with local responses so the OAuth button can
 * be exercised without contacting Google. The sign-in POST is aborted and its
 * callbackUrl captured, which lets the test verify safe post-login returns.
 */
async function interceptOAuth(page) {
  let callbackUrl = null;

  await page.route(/\/api\/auth\/providers/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(OAUTH_PROVIDERS),
    }),
  );
  await page.route(/\/api\/auth\/csrf/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ csrfToken: "e2e-csrf-token" }),
    }),
  );
  await page.route(/\/api\/auth\/signin\/google/, async (route) => {
    const body = new URLSearchParams(route.request().postData() ?? "");
    callbackUrl = body.get("callbackUrl");
    await route.abort("failed");
  });

  return {
    callbackUrl: () => callbackUrl,
    release: async () => {
      await page.unroute(/\/api\/auth\/providers/);
      await page.unroute(/\/api\/auth\/csrf/);
      await page.unroute(/\/api\/auth\/signin\/google/);
    },
  };
}

async function seedLegacyListData(page, spellId) {
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ spellId }) => {
    const request = indexedDB.open("ars-arcana", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("listas_salvas")) {
        const store = db.createObjectStore("listas_salvas", { keyPath: "id" });
        store.createIndex("by-nome", "nome");
      }
      if (!db.objectStoreNames.contains("magias_salvas")) {
        const store = db.createObjectStore("magias_salvas", {
          keyPath: ["listaId", "magiaId"],
        });
        store.createIndex("by-lista", "listaId");
        store.createIndex("by-magia", "magiaId");
      }
      if (!db.objectStoreNames.contains("cache_magias")) {
        const store = db.createObjectStore("cache_magias", { keyPath: "magiaId" });
        store.createIndex("by-expira", "expiresAt");
      }
    };

    const db = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const now = new Date().toISOString();
    const tx = db.transaction(
      ["listas_salvas", "magias_salvas", "cache_magias"],
      "readwrite",
    );
    tx.objectStore("listas_salvas").put({
      id: "sem-grimorio",
      nome: "Sem grimório",
      criadaEm: now,
      atualizadaEm: now,
      reservada: true,
    });
    tx.objectStore("listas_salvas").put({
      id: "legado-combate",
      nome: "Combate",
      criadaEm: now,
      atualizadaEm: now,
      reservada: false,
    });
    tx.objectStore("magias_salvas").put({
      listaId: "legado-combate",
      magiaId: spellId,
      salvaEm: now,
    });
    tx.objectStore("cache_magias").put({
      magiaId: spellId,
      snapshot: {},
      cachedAt: now,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  }, { spellId });
}

async function readLegacyStorage(page) {
  return page.evaluate(async () => {
    const request = indexedDB.open("ars-arcana", 1);
    const db = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction(
      ["listas_salvas", "magias_salvas", "cache_magias"],
      "readonly",
    );
    const complete = new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    const requestToPromise = (request) =>
      new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    const [lists, spells, cache] = await Promise.all([
      requestToPromise(tx.objectStore("listas_salvas").getAll()),
      requestToPromise(tx.objectStore("magias_salvas").getAll()),
      requestToPromise(tx.objectStore("cache_magias").getAll()),
    ]);
    await complete;
    db.close();
    return {
      lists: lists.map((item) => item.id),
      spells: spells.length,
      cache: cache.length,
    };
  });
}

const headerNav = () =>
  page.getByRole("navigation", { name: "Navegação principal" }).first();

await step("Biblioteca carrega catálogo completo e facetas reais", async () => {
  await goto("/");
  assert.equal(await page.title(), "ARS Arcana — Biblioteca de magias");
  await page
    .getByRole("heading", { name: "A magia está em suas mãos.", exact: true })
    .waitFor();
  await waitForBodyText("391 magias para a sua próxima aventura");
  assert.equal(await page.locator("article").count(), 12);
  await page.getByRole("button", { name: "Círculo 0: truques" }).waitFor();
  for (let circle = 1; circle <= 9; circle += 1) {
    await page.getByRole("button", { name: `Círculo ${circle}` }).waitFor();
  }
  await page.locator('label[for="escola-Evocação"]').waitFor();
  await page.locator('label[for="escola-Necromancia"]').waitFor();
  await assertNoHorizontalOverflow("biblioteca desktop");
  await page.screenshot({
    path: `${OUT}/01-library-desktop.png`,
    fullPage: false,
  });
});

await step(
  "Header mostra apenas Biblioteca, Equipamento e Guia com conta deslogada",
  async () => {
    const nav = headerNav();
    assert.equal(await nav.getByRole("link").count(), 3);
    await nav.getByRole("link", { name: "Biblioteca de magias", exact: true }).waitFor();
    await nav.getByRole("link", { name: /^Equipamento/ }).waitFor();
    await nav.getByRole("link", { name: /^Guia do aventureiro/ }).waitFor();
    assert.equal(
      await page.locator("header").getByText("Magias salvas", { exact: false }).count(),
      0,
      "o atalho antigo de Magias salvas ainda aparece no header",
    );

    const account = page.getByRole("link", { name: "Entrar na sua conta" });
    await account.waitFor();
    assert.equal(await account.getAttribute("href"), "/login");
    assert.equal(
      await page.getByRole("button", { name: "Abrir menu da sua conta" }).count(),
      0,
      "menu autenticado apareceu sem sessão",
    );
  },
);

await step("Busca por Enter atualiza URL e resultados", async () => {
  const search = page.getByRole("searchbox", {
    name: "Buscar magias por nome ou descrição",
  });
  await search.fill("bola de fogo");
  await search.press("Enter");
  await page.waitForURL(/\/\?q=bola\+de\+fogo/);
  await page
    .getByRole("heading", { name: "Bola de Fogo", exact: true })
    .waitFor();
  await page
    .getByRole("heading", { name: "Bola de Fogo Adiável", exact: true })
    .waitFor();
  await waitForBodyText("2 magias para a sua próxima aventura");
  const article = page
    .locator("article")
    .filter({
      has: page.getByRole("heading", { name: "Bola de Fogo", exact: true }),
    });
  await expectText(article, "Evocação");
  await expectText(article, "3º Círculo");
  await expectText(article, "45 metros");
  assert.equal(await page.locator("article").count(), 2);
});

let bolaId = null;
let detailUrl = null;
await step("Detalhes exibem todos os campos e preservam a origem", async () => {
  await page
    .getByRole("link", { name: "Bola de Fogo", exact: true })
    .first()
    .click();
  await page.waitForURL(/\/magias\/[0-9a-f-]{36}\?from=/);
  bolaId = new URL(page.url()).pathname.split("/").at(-1);
  detailUrl = page.url();
  await page
    .getByRole("heading", { name: "Bola de Fogo", exact: true, level: 1 })
    .waitFor();
  await waitForBodyText("Evocação");
  await waitForBodyText("3º Círculo");
  await waitForBodyText("Tempo de conjuração");
  await waitForBodyText("Componentes");
  await waitForBodyText("8d6");
  assert.ok(
    page.url().includes("from=%2F%3Fq%3Dbola%2Bde%2Bfogo"),
    "URL de origem não foi preservada",
  );
  await page.screenshot({
    path: `${OUT}/02-detail-desktop.png`,
    fullPage: false,
  });
});

await step(
  "Salvar sem sessão leva ao login e preserva o retorno seguro",
  async () => {
    const snapshotResponse = await grimoireSnapshotResponse;
    assert.ok(snapshotResponse, "a coleção remota não respondeu a tempo");
    assert.equal(snapshotResponse.status(), 401);
    await page.getByRole("button", { name: "Salvar em grimório" }).click();
    await page.waitForURL(/\/login\?returnTo=/);
    const returnTo = decodeReturnTo(page.url());
    assertSameInternalPath(returnTo, detailUrl, "retorno da magia");
    await page
      .getByRole("heading", { name: "Bem-vindo de volta!", exact: true })
      .waitFor();

    const oauth = await interceptOAuth(page);
    try {
      await waitForEnabled(page.getByRole("button", { name: "Entrar com Google" }));
      await page.getByRole("button", { name: "Entrar com Google" }).click();
      await page
        .getByRole("alert")
        .filter({ hasText: "Não foi possível iniciar o login com Google." })
        .waitFor();
      assert.ok(oauth.callbackUrl(), "OAuth não recebeu callbackUrl");
      assertSameInternalPath(
        oauth.callbackUrl(),
        returnTo,
        "callback do OAuth",
      );
    } finally {
      await oauth.release();
    }
  },
);

await step(
  "Tela de login reproduz a referência sem shell do site e sem senha",
  async () => {
    await goto("/login");
    await page
      .getByRole("heading", { name: "Bem-vindo de volta!", exact: true })
      .waitFor();
    await waitForBodyText("Faça login para continuar sua jornada.");
    await waitForBodyText("Ainda não tem uma conta?");
    await page.getByRole("button", { name: "Crie uma agora" }).waitFor();
    await page.getByRole("link", { name: "Voltar para a biblioteca" }).waitFor();
    assert.equal(await page.locator('input[type="email"], input[type="password"]').count(), 0);
    assert.equal(await page.locator("header").count(), 0, "login usa o header do site");
    assert.equal(
      await page.getByRole("navigation", { name: "Navegação principal" }).count(),
      0,
      "login usa a navegação do site",
    );
    const html = await page.content();
    assert.ok(!html.includes("GOOGLE_CLIENT_SECRET"), "nome de segredo exposto no HTML");
    assert.ok(!html.includes("AUTH_SECRET"), "nome do segredo de sessão exposto no HTML");
    await page.screenshot({
      path: `${OUT}/03-login-desktop.png`,
      fullPage: false,
    });
  },
);

await step("returnTo externo é rejeitado antes do OAuth", async () => {
  await goto("/login?returnTo=https%3A%2F%2Fevil.example%2Fpwn");
  await page
    .getByRole("heading", { name: "Bem-vindo de volta!", exact: true })
    .waitFor();

  const oauth = await interceptOAuth(page);
  try {
    await waitForEnabled(page.getByRole("button", { name: "Entrar com Google" }));
    await page.getByRole("button", { name: "Entrar com Google" }).click();
    await page
      .getByRole("alert")
      .filter({ hasText: "Não foi possível iniciar o login com Google." })
      .waitFor();
    assert.equal(oauth.callbackUrl(), "/");
  } finally {
    await oauth.release();
  }
});

await step("Erro de OAuth mostra mensagem explícita e opção de tentar novamente", async () => {
  await goto("/login?error=AccessDenied");
  await expectText(
    page.getByRole("alert"),
    "O acesso com Google foi cancelado ou negado.",
    "mensagem de erro OAuth",
  );
  await page.getByRole("button", { name: "Tentar novamente" }).waitFor();
  await page.screenshot({
    path: `${OUT}/04-login-error.png`,
    fullPage: false,
  });
});

await step(
  "Área privada redireciona ao login com o caminho completo de retorno",
  async () => {
    const target =
      "/magias-salvas?grimorio=abc&q=bola&sort=circulo-desc&page=2";
    await goto(target, "domcontentloaded");
    await page.waitForURL(/\/login\?returnTo=/);
    assertSameInternalPath(decodeReturnTo(page.url()), target, "retorno da coleção");
    await page
      .getByRole("heading", { name: "Bem-vindo de volta!", exact: true })
      .waitFor();
  },
);

await step("APIs privadas recusam sessão ausente ou forjada", async () => {
  const spellId = "11111111-1111-4111-8111-111111111111";
  const grimoireId = "22222222-2222-4222-8222-222222222222";
  const forgedCookie =
    "authjs.session-token=forged; __Secure-authjs.session-token=forged";
  const requests = [
    ["GET", "/api/grimorios?userId=forged-user", undefined],
    [
      "POST",
      "/api/grimorios",
      { nome: "Invasão", userId: "forged-user" },
    ],
    [
      "PATCH",
      `/api/grimorios/${grimoireId}`,
      { nome: "Invasão", userId: "forged-user" },
    ],
    ["DELETE", `/api/grimorios/${grimoireId}`, undefined],
    [
      "PUT",
      "/api/magias-salvas",
      {
        magiaId: spellId,
        grimoireIds: [grimoireId],
        withoutGrimoire: false,
        userId: "forged-user",
      },
    ],
  ];

  for (const [method, path, body] of requests) {
    const response = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        accept: "application/json",
        cookie: forgedCookie,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    assert.equal(response.status, 401, `${method} ${path} respondeu ${response.status}`);
    const payload = await response.json();
    assert.equal(payload.code, "unauthorized", `${method} ${path} não retornou unauthorized`);
  }
});

await step(
  "Placeholders de Equipamento, Guia e Arsenal mantêm o padrão visual",
  async () => {
    const pages = [
      ["/equipamento", "Em breve, seu inventário.", "O inventário ainda está sendo preparado."],
      ["/guia", "Em breve, novos caminhos.", "O guia ainda está sendo escrito."],
      ["/arsenal", "Em breve, seu arsenal.", "O arsenal ainda está sendo forjado."],
    ];

    for (const [path, title, body] of pages) {
      await goto(path);
      await page.getByRole("heading", { name: title, exact: true }).waitFor();
      await waitForBodyText(body);
      await page.getByRole("link", { name: "Entrar na sua conta" }).waitFor();
      await assertNoHorizontalOverflow(`${path} desktop`);
    }

    await goto("/equipamento");
    assert.equal(
      await headerNav().getByRole("link", { name: /^Equipamento/ }).getAttribute("aria-current"),
      "page",
    );
    await goto("/guia");
    assert.equal(
      await headerNav()
        .getByRole("link", { name: /^Guia do aventureiro/ })
        .getAttribute("aria-current"),
      "page",
    );
  },
);

await step(
  "Filtros combinam classe, círculo 0 e escola com contagens reais",
  async () => {
    await goto("/");
    await page.selectOption("#filtro-classe", "Mago");
    await page.waitForURL(/classe=Mago/);

    const classPage = await api("/api/magias?classe=Mago&limit=1");
    await waitForBodyText(
      `${classPage.total} magias para a sua próxima aventura`,
    );

    await page.getByRole("button", { name: "Círculo 0: truques" }).click();
    await page.waitForURL(/circulo=0/);
    const circlePage = await api("/api/magias?classe=Mago&circulo=0&limit=1");
    await waitForBodyText(
      `${circlePage.total} magias para a sua próxima aventura`,
    );

    await page.locator('label[for="escola-Evocação"]').click();
    await page.waitForURL(/tipo=Evoca/);
    const schoolPage = await api(
      `/api/magias?classe=Mago&circulo=0&tipo=${encodeURIComponent("Evocação")}&limit=50`,
    );
    assert.ok(schoolPage.total > 0, "combinação de filtros sem resultados");
    await waitForBodyText(
      `${schoolPage.total} magias para a sua próxima aventura`,
    );
    assert.equal(await page.locator("article").count(), schoolPage.total);
    for (const article of await page.locator("article").all()) {
      const value = (await article.innerText()).toLocaleLowerCase("pt-BR");
      assert.ok(value.includes("evocação"), "card fora do filtro de escola");
      assert.ok(value.includes("truque"), "card fora do filtro de círculo 0");
    }
  },
);

await step("Limpar filtros restaura o catálogo completo", async () => {
  await page.getByRole("button", { name: "Limpar", exact: true }).click();
  await page.waitForURL(`${BASE}/`);
  await waitForBodyText("391 magias para a sua próxima aventura");
  assert.equal(await page.locator("#filtro-classe").inputValue(), "");
});

await step(
  "Ordenação e paginação do servidor funcionam e voltam preservadas",
  async () => {
    await page.selectOption("#ordenar-magias", "circulo-desc");
    await page.waitForURL(/sort=circulo-desc/);
    await expectText(page.locator("article").first(), "9º Círculo");

    await page.getByRole("link", { name: /Próxima página/ }).click();
    await page.waitForURL(/page=2/);
    await waitForBodyText("Mostrando 13–24 de 391");
    assert.equal(await page.locator("article").count(), 12);

    await page.goBack();
    await page.waitForURL(/sort=circulo-desc/);
    await waitForBodyText("Mostrando 1–12 de 391");
    assert.equal(
      await page.locator("#ordenar-magias").inputValue(),
      "circulo-desc",
    );
  },
);

await step("ID inválido e UUID inexistente não causam crash", async () => {
  await goto("/magias/nao-e-um-uuid");
  await page
    .getByRole("heading", { name: "Este identificador não leva a uma magia." })
    .waitFor();
  await page
    .getByRole("link", { name: "Ir para a biblioteca", exact: true })
    .waitFor();

  await goto(
    "/magias/22222222-2222-4222-8222-222222222222",
    "domcontentloaded",
  );
  await page
    .getByRole("heading", { name: "Esta magia não foi encontrada." })
    .waitFor({ timeout: 15000 });
  await page.getByText(/não possui este identificador/).waitFor();
});

await step(
  "Layout estreito mantém navegação, login e placeholders utilizáveis",
  async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await goto("/");
    await assertNoHorizontalOverflow("biblioteca mobile");
    await page.getByRole("link", { name: "Entrar na sua conta" }).waitFor();
    await page.getByRole("button", { name: "Abrir menu de navegação" }).click();
    const sheet = page.locator('[data-slot="sheet-content"]');
    await sheet.waitFor();
    await sheet.getByRole("link", { name: "Biblioteca de magias", exact: true }).waitFor();
    await sheet.getByRole("link", { name: /^Equipamento/ }).waitFor();
    await sheet.getByRole("link", { name: /^Guia do aventureiro/ }).waitFor();
    await page.keyboard.press("Escape");
    await page.screenshot({
      path: `${OUT}/05-library-mobile.png`,
      fullPage: false,
    });

    await goto("/login");
    await assertNoHorizontalOverflow("login mobile");
    await waitForEnabled(page.getByRole("button", { name: "Entrar com Google" }));
    await page
      .getByRole("heading", { name: "Bem-vindo de volta!", exact: true })
      .waitFor();
    await page.screenshot({
      path: `${OUT}/06-login-mobile.png`,
      fullPage: false,
    });

    await goto("/equipamento");
    await page
      .getByRole("heading", { name: "Em breve, seu inventário.", exact: true })
      .waitFor();
    await assertNoHorizontalOverflow("equipamento mobile");
    await page.setViewportSize({ width: 1440, height: 1000 });
  },
);

await step("Nenhum erro de página ou console inesperado no fluxo", async () => {
  assert.deepEqual(
    pageErrors,
    [],
    `erros de página: ${pageErrors.join(" | ")}`,
  );
  const unexpected = consoleErrors.filter(
    (message) =>
      !message.includes("net::ERR_INTERNET_DISCONNECTED") &&
      !message.includes("net::ERR_FAILED") &&
      !message.includes("Failed to load resource"),
  );
  assert.deepEqual(
    unexpected,
    [],
    `erros de console: ${unexpected.join(" | ")}`,
  );
});

await browser.close();

const legacyBrowser = await launchBrowser();
const legacyContext = await legacyBrowser.newContext({
  viewport: { width: 1440, height: 1000 },
  locale: "pt-BR",
  reducedMotion: "reduce",
});
const legacyPage = await legacyContext.newPage();
try {
  await step(
    "Login detecta dados legados e cancelar preserva os stores",
    async () => {
      await seedLegacyListData(legacyPage, bolaId);
      await legacyPage.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });

      const loginButton = legacyPage.getByRole("button", {
        name: "Entrar com Google",
      });
      await waitForEnabled(loginButton);
      await loginButton.click();

      const dialog = legacyPage.getByRole("alertdialog", {
        name: "Dados antigos neste navegador",
      });
      await dialog.waitFor();
      await expectText(dialog, "1 grimório");
      await expectText(dialog, "1 magia salva");
      await expectText(dialog, "não serão importados");
      await legacyPage.screenshot({
        path: `${OUT}/07-legacy-confirmation.png`,
        fullPage: false,
      });

      await dialog.getByRole("button", { name: "Cancelar" }).click();
      await dialog.waitFor({ state: "hidden" });

      const storage = await readLegacyStorage(legacyPage);
      assert.deepEqual(storage.lists.sort(), ["legado-combate", "sem-grimorio"]);
      assert.equal(storage.spells, 1);
      assert.equal(storage.cache, 1);
      assert.equal(
        await legacyPage.evaluate(() =>
          localStorage.getItem("ars-arcana:legacy-cleanup-pending"),
        ),
        null,
      );
    },
  );

  await step(
    "Confirmar só marca a limpeza; sem sessão os dados permanecem",
    async () => {
      const oauth = await interceptOAuth(legacyPage);
      try {
        await legacyPage
          .getByRole("button", { name: "Entrar com Google" })
          .click();
        const dialog = legacyPage.getByRole("alertdialog", {
          name: "Dados antigos neste navegador",
        });
        await dialog.waitFor();
        await dialog.getByRole("button", { name: "Entrar e apagar" }).click();

        await legacyPage.waitForFunction(
          () =>
            localStorage.getItem("ars-arcana:legacy-cleanup-pending") === "1",
        );
        await legacyPage
          .getByRole("alert")
          .filter({ hasText: "Não foi possível iniciar o login com Google." })
          .waitFor();
        assert.equal(oauth.callbackUrl(), "/");

        const afterConfirm = await readLegacyStorage(legacyPage);
        assert.equal(afterConfirm.spells, 1);
        assert.equal(afterConfirm.cache, 1);

        await legacyPage.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
        const afterNavigation = await readLegacyStorage(legacyPage);
        assert.deepEqual(
          afterNavigation.lists.sort(),
          ["legado-combate", "sem-grimorio"],
        );
        assert.equal(afterNavigation.spells, 1);
        assert.equal(afterNavigation.cache, 1);
        assert.equal(
          await legacyPage.evaluate(() =>
            localStorage.getItem("ars-arcana:legacy-cleanup-pending"),
          ),
          "1",
          "a limpeza foi consumida sem uma sessão autenticada",
        );
      } finally {
        await oauth.release();
      }
    },
  );
} finally {
  await legacyBrowser.close();
}

const storageBrowser = await launchBrowser();
const storageContext = await storageBrowser.newContext({
  viewport: { width: 1200, height: 900 },
  locale: "pt-BR",
});
await storageContext.addInitScript(() => {
  Object.defineProperty(window, "indexedDB", {
    configurable: true,
    value: undefined,
  });
});
const storagePage = await storageContext.newPage();
try {
  await step(
    "Falha do IndexedDB não bloqueia a tela de login",
    async () => {
      await storagePage.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
      await storagePage
        .getByRole("heading", { name: "Bem-vindo de volta!", exact: true })
        .waitFor();
      const button = storagePage.getByRole("button", { name: "Entrar com Google" });
      await waitForEnabled(button);
      assert.ok(await button.isVisible(), "ação principal ficou indisponível");
    },
  );
} finally {
  await storageBrowser.close();
}

const errorBrowser = await launchBrowser();
const errorPage = await errorBrowser.newPage({
  viewport: { width: 1200, height: 900 },
  locale: "pt-BR",
});
try {
  await step(
    "Ambiente sem DATABASE_URL mostra catálogo indisponível, não vazio",
    async () => {
      const response = await errorPage.goto(`${ERROR_BASE}/`, {
        waitUntil: "domcontentloaded",
      });
      assert.ok(response, "sem resposta do servidor de erro");
      await errorPage
        .getByRole("heading", { name: "Não foi possível carregar as magias." })
        .waitFor({
          timeout: 20000,
        });
      const body = (
        await errorPage.locator("main").innerText()
      ).toLocaleLowerCase("pt-BR");
      assert.ok(body.includes("catálogo indisponível"), body);
      assert.ok(body.includes("nenhum resultado vazio foi inventado"), body);
      assert.ok(
        !body.includes("nenhuma magia encontrada."),
        "erro exibido como busca vazia",
      );
      await errorPage.screenshot({
        path: `${OUT}/08-catalog-error.png`,
        fullPage: false,
      });
    },
  );

  await step(
    "Login continua acessível sem banco e área privada redireciona",
    async () => {
      await errorPage.goto(`${ERROR_BASE}/login`, {
        waitUntil: "domcontentloaded",
      });
      await errorPage
        .getByRole("heading", { name: "Bem-vindo de volta!", exact: true })
        .waitFor({ timeout: 20000 });
      await waitForEnabled(
        errorPage.getByRole("button", { name: "Entrar com Google" }),
        20000,
      );

      await errorPage.goto(`${ERROR_BASE}/magias-salvas`, {
        waitUntil: "domcontentloaded",
      });
      await errorPage.waitForURL(/\/login\?returnTo=/);
      assert.equal(
        decodeURIComponent(
          new URL(errorPage.url()).searchParams.get("returnTo") ?? "",
        ),
        "/magias-salvas",
      );
    },
  );
} finally {
  await errorBrowser.close();
}

const summary = {
  passes,
  failures: failures.map((item) => item.name),
  pageErrors,
};
writeFileSync(
  `${OUT}/validation-summary.json`,
  JSON.stringify(summary, null, 2),
);
console.log(`\n${passes.length} verificações passaram.`);
