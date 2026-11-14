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
  return value;
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
  "Áreas privadas redirecionam ao login com o caminho completo de retorno",
  async () => {
    const targets = [
      "/magias-salvas?grimorio=abc&q=bola&sort=circulo-desc&page=2",
      "/arsenal?q=adaga",
    ];
    for (const target of targets) {
      await goto(target, "domcontentloaded");
      await page.waitForURL(/\/login\?returnTo=/);
      assertSameInternalPath(
        decodeReturnTo(page.url()),
        target,
        `retorno de ${target}`,
      );
      await page
        .getByRole("heading", { name: "Bem-vindo de volta!", exact: true })
        .waitFor();
    }
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
    ["GET", "/api/arsenal?userId=forged-user", undefined],
    ["POST", "/api/arsenal", { slug: "adaga", userId: "forged-user" }],
    ["DELETE", "/api/arsenal/adaga", undefined],
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

await step("Guia permanece como placeholder com o padrão visual", async () => {
  await goto("/guia");
  await page
    .getByRole("heading", { name: "Em breve, novos caminhos.", exact: true })
    .waitFor();
  await waitForBodyText("O guia ainda está sendo escrito.");
  await page.getByRole("link", { name: "Entrar na sua conta" }).waitFor();
  await assertNoHorizontalOverflow("/guia desktop");
  assert.equal(
    await headerNav()
      .getByRole("link", { name: /^Guia do aventureiro/ })
      .getAttribute("aria-current"),
    "page",
  );
});

await step(
  "Catálogo de equipamentos carrega 174 itens e facetas reais",
  async () => {
    const catalog = await api("/api/equipamentos?limit=1");
    assert.equal(catalog.total, 174);
    assert.deepEqual(catalog.facets.tipos, [
      { valor: "arma", total: 38 },
      { valor: "armadura", total: 13 },
      { valor: "ferramenta", total: 25 },
      { valor: "aventura", total: 98 },
    ]);
    assert.deepEqual(catalog.facets.armas.tipos, [
      { valor: "simples", total: 14 },
      { valor: "marcial", total: 24 },
    ]);
    assert.deepEqual(catalog.facets.armas.alcances, [
      { valor: "corpo-a-corpo", total: 28 },
      { valor: "distancia", total: 10 },
    ]);
    assert.deepEqual(catalog.facets.armaduras, [
      { valor: "Leve", total: 3 },
      { valor: "Média", total: 5 },
      { valor: "Pesada", total: 4 },
      { valor: "Escudo", total: 1 },
    ]);

    await goto("/equipamento");
    assert.equal(await page.title(), "ARS Arcana — Equipamento");
    await page
      .getByRole("heading", {
        name: "Prepare-se para qualquer batalha.",
        exact: true,
      })
      .waitFor();
    await waitForBodyText("174 equipamentos para a sua próxima aventura");
    assert.equal(await page.locator("article").count(), 12);
    await page
      .getByRole("heading", { name: "Armas", exact: true })
      .waitFor();
    await expectText(
      page.locator('section[aria-labelledby="secao-arma"]'),
      "38 itens",
      "total da seção Armas",
    );
    await expectText(
      page.locator("aside").getByRole("button", { name: /^Armas/ }),
      "38",
      "contagem da categoria Armas",
    );
    assert.equal(
      await page.locator("#ordenar-equipamentos").inputValue(),
      "categoria",
    );
    assert.equal(
      await headerNav()
        .getByRole("link", { name: /^Equipamento/ })
        .getAttribute("aria-current"),
      "page",
    );
    await assertNoHorizontalOverflow("catálogo de equipamentos desktop");
    await page.screenshot({
      path: `${OUT}/09-equipment-desktop.png`,
      fullPage: false,
    });
  },
);

await step("Busca de equipamentos atualiza a URL e pode ser limpa", async () => {
  const search = page.getByRole("searchbox", {
    name: "Buscar equipamentos por nome, descrição ou categoria",
  });
  await search.fill("adaga");
  await search.press("Enter");
  await page.waitForURL(/\/equipamento\?q=adaga/);

  const result = await api("/api/equipamentos?q=adaga&limit=1");
  assert.equal(result.total, 1);
  await waitForBodyText("1 equipamento para a sua próxima aventura");
  await page
    .getByRole("heading", { name: "Adaga", exact: true })
    .waitFor();
  assert.equal(await page.locator("article").count(), 1);

  await page.getByRole("button", { name: "Limpar busca" }).click();
  await page.waitForURL(`${BASE}/equipamento`);
  await waitForBodyText("174 equipamentos para a sua próxima aventura");
  assert.equal(await search.inputValue(), "");
});

await step(
  "Filtros combinam categoria, tipo de arma e alcance com contagens reais",
  async () => {
    await page
      .locator("aside")
      .getByRole("button", { name: /^Armas/ })
      .click();
    await page.waitForURL(/tipo=arma/);

    const arms = await api("/api/equipamentos?tipo=arma&limit=1");
    assert.equal(arms.total, 38);
    await waitForBodyText("38 equipamentos para a sua próxima aventura");

    await page.locator('label[for="arma-marcial"]').click();
    await page.waitForURL(/arma=marcial/);
    const marcial = await api(
      "/api/equipamentos?tipo=arma&arma=marcial&limit=1",
    );
    assert.equal(marcial.total, 24);
    await waitForBodyText("24 equipamentos para a sua próxima aventura");

    await page.locator('label[for="alcance-distancia"]').click();
    await page.waitForURL(/alcance=distancia/);
    const ranged = await api(
      "/api/equipamentos?tipo=arma&arma=marcial&alcance=distancia&limit=50",
    );
    assert.equal(ranged.total, 6);
    await waitForBodyText("6 equipamentos para a sua próxima aventura");
    assert.equal(await page.locator("article").count(), 6);
    for (const article of await page.locator("article").all()) {
      const value = (await article.innerText()).toLocaleLowerCase("pt-BR");
      assert.ok(
        value.includes("marcial"),
        "card fora do filtro de arma marcial",
      );
      assert.ok(
        value.includes("à distância"),
        "card fora do filtro de alcance",
      );
    }

    await page
      .locator("aside")
      .getByRole("button", { name: "Limpar", exact: true })
      .click();
    await page.waitForURL(`${BASE}/equipamento`);
    await waitForBodyText("174 equipamentos para a sua próxima aventura");
  },
);

await step(
  "Ordenação e paginação de equipamentos preservam o estado na URL",
  async () => {
    const alphabetical = await api("/api/equipamentos?sort=nome-asc&limit=12");
    assert.equal(alphabetical.items.length, 12);

    await page.selectOption("#ordenar-equipamentos", "nome-asc");
    await page.waitForURL(/sort=nome-asc/);
    assert.equal(await page.locator("article").count(), 12);
    assert.equal(
      await page.getByRole("heading", { name: "Armas", exact: true }).count(),
      0,
    );
    assert.equal(
      await page.locator("article h3 a").first().innerText(),
      alphabetical.items[0].nome,
    );

    await page.getByRole("link", { name: /Próxima página/ }).click();
    await page.waitForURL(/page=2/);
    await waitForBodyText("Mostrando 13–24 de 174");
    const secondPage = await api(
      "/api/equipamentos?sort=nome-asc&page=2&limit=12",
    );
    assert.equal(
      await page.locator("article h3 a").first().innerText(),
      secondPage.items[0].nome,
    );

    await page.selectOption("#ordenar-equipamentos", "categoria");
    await page.waitForURL((url) => !url.searchParams.has("sort"));
    await waitForBodyText("174 equipamentos para a sua próxima aventura");
  },
);

await step(
  "Detalhes exibem os campos específicos de cada subtipo",
  async () => {
    const cases = [
      {
        slug: "adaga",
        heading: "Adaga",
        text: [
          "1d4",
          "Perfurante",
          "Ágil",
          "Acuidade",
          "Arremesso (Alcance 6/18)",
          "0,5 kg",
          "2 PO",
          "p. 215",
        ],
        screenshot: "10-equipment-detail-weapon.png",
      },
      {
        slug: "couro",
        heading: "Couro",
        text: [
          "11 + modificador de Des",
          "Sem requisito de Força",
          "Sem penalidade",
          "5 kg",
          "10 PO",
          "p. 219",
        ],
        screenshot: "11-equipment-detail-armor.png",
      },
      {
        slug: "ferramentas-de-carpinteiro",
        heading: "Ferramentas de Carpinteiro",
        text: [
          "Ferramentas de Artesão",
          "Força",
          "Selar ou abrir",
          "Aríete Portável",
          "3 kg",
          "8 PO",
          "p. 220",
        ],
        screenshot: "12-equipment-detail-tool.png",
      },
      {
        slug: "acido",
        heading: "Ácido",
        text: [
          "Equipamento de aventura",
          "2d6",
          "0,5 kg",
          "25 PO",
          "p. 222",
        ],
        screenshot: "13-equipment-detail-adventure.png",
      },
    ];

    for (const item of cases) {
      const from = `/equipamento?q=${item.slug}`;
      await goto(
        `/equipamento/${item.slug}?from=${encodeURIComponent(from)}`,
      );
      await page
        .getByRole("heading", {
          name: item.heading,
          exact: true,
          level: 1,
        })
        .waitFor();
      for (const needle of item.text) {
        await waitForBodyText(needle);
      }
      await page
        .getByRole("button", { name: "Salvar no Arsenal" })
        .waitFor();
      assert.equal(
        await page
          .getByRole("link", { name: "Voltar ao catálogo" })
          .getAttribute("href"),
        from,
        `retorno do detalhe de ${item.slug}`,
      );
      await assertNoHorizontalOverflow(`detalhe de ${item.slug}`);
      await page.screenshot({
        path: `${OUT}/${item.screenshot}`,
        fullPage: false,
      });
    }
  },
);

await step(
  "Salvar equipamento sem sessão leva ao login preservando o detalhe",
  async () => {
    const from = "/equipamento?tipo=arma&arma=marcial";
    const detail = `/equipamento/arco-longo?from=${encodeURIComponent(from)}`;
    await goto(detail);
    await page.getByRole("button", { name: "Salvar no Arsenal" }).click();
    await page.waitForURL(/\/login\?returnTo=/);
    assertSameInternalPath(
      decodeReturnTo(page.url()),
      detail,
      "retorno do equipamento",
    );
    await page
      .getByRole("heading", { name: "Bem-vindo de volta!", exact: true })
      .waitFor();
  },
);

await step("Equipamento inexistente e slug inválido não causam crash", async () => {
  for (const slug of ["nao-existe", "Slug Inválido"]) {
    await goto(
      `/equipamento/${encodeURIComponent(slug)}?from=%2Farsenal%3Fq%3Dadaga`,
    );
    await page
      .getByRole("heading", { name: "Este equipamento não foi encontrado." })
      .waitFor();
    await page
      .getByRole("link", { name: "Voltar ao Arsenal" })
      .waitFor();
  }
});

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
  "Layout estreito mantém navegação, login e catálogo de equipamentos utilizáveis",
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
      .getByRole("heading", {
        name: "Prepare-se para qualquer batalha.",
        exact: true,
      })
      .waitFor();
    await assertNoHorizontalOverflow("equipamento mobile");
    await page
      .getByRole("button", { name: /^Filtrar equipamentos/ })
      .click();
    const filterSheet = page.locator('[data-slot="sheet-content"]');
    await filterSheet.waitFor();
    await filterSheet
      .getByRole("button", { name: /^Armaduras/ })
      .click();
    await page.waitForURL(/tipo=armadura/);
    await waitForBodyText("13 equipamentos para a sua próxima aventura");
    await expectText(
      page.locator('section[aria-labelledby="secao-armadura"]'),
      "13 itens",
      "total da seção Armaduras",
    );
    await assertNoHorizontalOverflow("catálogo filtrado mobile");
    await page.screenshot({
      path: `${OUT}/14-equipment-mobile.png`,
      fullPage: false,
    });

    await goto("/equipamento/couro");
    await page
      .getByRole("heading", { name: "Couro", exact: true, level: 1 })
      .waitFor();
    await assertNoHorizontalOverflow("detalhe de equipamento mobile");
    await page.screenshot({
      path: `${OUT}/15-equipment-detail-mobile.png`,
      fullPage: false,
    });
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

      await errorPage.goto(`${ERROR_BASE}/equipamento`, {
        waitUntil: "domcontentloaded",
      });
      await errorPage
        .getByRole("heading", {
          name: "Não foi possível carregar os equipamentos.",
        })
        .waitFor({ timeout: 20000 });
      const equipmentBody = (
        await errorPage.locator("main").innerText()
      ).toLocaleLowerCase("pt-BR");
      assert.ok(equipmentBody.includes("catálogo indisponível"), equipmentBody);

      await errorPage.goto(`${ERROR_BASE}/equipamento/adaga`, {
        waitUntil: "domcontentloaded",
      });
      await errorPage
        .getByRole("heading", {
          name: "Não foi possível abrir este equipamento.",
        })
        .waitFor({ timeout: 20000 });
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

      for (const target of ["/magias-salvas", "/arsenal"]) {
        await errorPage.goto(`${ERROR_BASE}${target}`, {
          waitUntil: "domcontentloaded",
        });
        await errorPage.waitForURL(/\/login\?returnTo=/);
        assert.equal(
          decodeURIComponent(
            new URL(errorPage.url()).searchParams.get("returnTo") ?? "",
          ),
          target,
        );
      }
    },
  );
} finally {
  await errorBrowser.close();
}

const AUTH_STATE = process.env.E2E_AUTH_STORAGE_STATE;
if (AUTH_STATE) {
  const authBrowser = await launchBrowser();
  const authContext = await authBrowser.newContext({
    storageState: AUTH_STATE,
    viewport: { width: 1440, height: 1000 },
    locale: "pt-BR",
    reducedMotion: "reduce",
  });
  const authPage = await authContext.newPage();
  const authPageErrors = [];
  authPage.on("pageerror", (error) => authPageErrors.push(error.message));

  try {
    await step(
      "Arsenal autenticado salva, lista e remove equipamentos",
      async () => {
        await authPage.goto(`${BASE}/arsenal`, {
          waitUntil: "domcontentloaded",
        });
        await authPage
          .getByRole("heading", {
            name: "Seu Arsenal, pronto para a batalha.",
            exact: true,
          })
          .waitFor();

        const cleanup = await authPage.evaluate(async () => {
          const response = await fetch("/api/arsenal/adaga", {
            method: "DELETE",
            headers: { accept: "application/json" },
          });
          return { status: response.status, body: await response.json() };
        });
        assert.ok(
          cleanup.status === 200 || cleanup.status === 404,
          `limpeza do Arsenal respondeu ${cleanup.status}`,
        );

        await authPage.goto(`${BASE}/arsenal`, {
          waitUntil: "domcontentloaded",
        });
        await authPage
          .getByRole("heading", { name: "Itens salvos", exact: true })
          .waitFor();
        const beforeSave = await authPage.evaluate(async () => {
          const response = await fetch("/api/arsenal", {
            headers: { accept: "application/json" },
          });
          return { status: response.status, body: await response.json() };
        });
        assert.equal(beforeSave.status, 200);
        assert.equal(
          beforeSave.body.items.filter((item) => item.slug === "adaga").length,
          0,
        );

        await authPage.goto(
          `${BASE}/equipamento/adaga?from=%2Fequipamento%3Fq%3Dadaga`,
          { waitUntil: "domcontentloaded" },
        );
        const saveButton = authPage.getByRole("button", {
          name: "Salvar no Arsenal",
        });
        await saveButton.waitFor();
        await saveButton.click();
        await authPage
          .getByRole("button", { name: "Remover do Arsenal" })
          .waitFor();
        await authPage
          .getByText(/foi salvo no seu Arsenal/)
          .waitFor();

        const afterSave = await authPage.evaluate(async () => {
          const response = await fetch("/api/arsenal", {
            headers: { accept: "application/json" },
          });
          return { status: response.status, body: await response.json() };
        });
        assert.equal(afterSave.status, 200);
        assert.equal(
          afterSave.body.items.filter((item) => item.slug === "adaga").length,
          1,
        );

        await authPage.goto(`${BASE}/arsenal?q=adaga`, {
          waitUntil: "domcontentloaded",
        });
        await authPage
          .getByRole("heading", { name: "Adaga", exact: true })
          .waitFor();
        await authPage
          .getByRole("button", { name: /Remover .*Adaga.* do Arsenal/ })
          .click();
        await authPage
          .getByText(/foi removido do seu Arsenal/)
          .waitFor();
        await authPage
          .getByText(/Nenhum item encontrado no Arsenal|Seu Arsenal ainda está vazio/)
          .first()
          .waitFor();

        const afterRemove = await authPage.evaluate(async () => {
          const response = await fetch("/api/arsenal", {
            headers: { accept: "application/json" },
          });
          return { status: response.status, body: await response.json() };
        });
        assert.equal(afterRemove.status, 200);
        assert.equal(
          afterRemove.body.items.filter((item) => item.slug === "adaga").length,
          0,
        );
        assert.deepEqual(authPageErrors, []);
      },
    );
  } finally {
    await authBrowser.close();
  }
} else {
  console.log(
    "SKIP  fluxo autenticado do Arsenal (defina E2E_AUTH_STORAGE_STATE com um storageState do Playwright)",
  );
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
