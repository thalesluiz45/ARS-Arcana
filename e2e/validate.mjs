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

async function navCount(name) {
  return page.evaluate((collectionName) => {
    const nav = document.querySelector(
      'nav[aria-label="Coleções de magias salvas"]',
    );
    if (!nav) return null;
    const buttons = [...nav.querySelectorAll("button")];
    const button = buttons.find((candidate) =>
      candidate.textContent?.trim().startsWith(collectionName),
    );
    return button ? button.textContent?.trim() : null;
  }, name);
}

async function waitForNavCount(name, count, timeout = 15000) {
  await page.waitForFunction(
    ({ name, count }) => {
      const nav = document.querySelector(
        'nav[aria-label="Coleções de magias salvas"]',
      );
      if (!nav) return false;
      const buttons = [...nav.querySelectorAll("button")];
      const button = buttons.find((candidate) =>
        candidate.textContent?.trim().startsWith(name),
      );
      return Boolean(
        button &&
        button.textContent?.replace(/\s+/g, " ").trim().endsWith(String(count)),
      );
    },
    { name, count },
    { timeout },
  );
}

async function goto(path, waitUntil = "networkidle") {
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

await step("Biblioteca carrega catálogo completo e facetas reais", async () => {
  await goto("/");
  assert.equal(await page.title(), "Biblioteca de magias");
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
await step("Detalhes exibem todos os campos e preservam a origem", async () => {
  await page
    .getByRole("link", { name: "Bola de Fogo", exact: true })
    .first()
    .click();
  await page.waitForURL(/\/magias\/[0-9a-f-]{36}\?from=/);
  bolaId = new URL(page.url()).pathname.split("/").at(-1);
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

await step("Salvar em Sem grimório funciona sem conta", async () => {
  await page.getByRole("button", { name: "Salvar em grimório" }).click();
  const dialog = page.getByRole("dialog", { name: "Organizar magia" });
  await dialog.waitFor();
  await dialog.getByRole("checkbox", { name: /Sem grimório/ }).click();
  await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
  await page
    .getByText(/foi salva em Sem grimório/)
    .first()
    .waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Nos seus grimórios" }).waitFor();
  await expectText(
    page.getByRole("link", { name: /Magias salvas/ }).first(),
    "1",
    "contador do cabeçalho",
  );
});

await step("Voltar preserva a busca da Biblioteca", async () => {
  await page.getByRole("link", { name: "Voltar à biblioteca" }).first().click();
  await page.waitForURL(/\/\?q=bola\+de\+fogo/);
  const search = page.getByRole("searchbox", {
    name: "Buscar magias por nome ou descrição",
  });
  assert.equal(await search.inputValue(), "bola de fogo");
  await page
    .getByRole("heading", { name: "Bola de Fogo", exact: true })
    .waitFor();
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

await step(
  "Magias salvas lista a coleção reservada e cria grimório nomeado",
  async () => {
    await goto("/magias-salvas");
    await page
      .getByRole("heading", { name: "Todas as magias salvas" })
      .waitFor();
    await page
      .getByRole("heading", { name: "Bola de Fogo", exact: true })
      .waitFor();
    await waitForNavCount("Todas as magias", 1);
    await waitForNavCount("Sem grimório", 1);

    await page
      .getByRole("button", { name: "Criar grimório", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Criar grimório" });
    await dialog.waitFor();
    await page.getByLabel("Nome do grimório").fill("Campanha da Floresta");
    await dialog.getByRole("button", { name: "Criar grimório" }).click();
    await page
      .getByText(/Grimório “Campanha da Floresta” criado/)
      .first()
      .waitFor();
    await page.waitForURL(/grimorio=/);
    await page.getByRole("heading", { name: "Campanha da Floresta" }).waitFor();
    await waitForNavCount("Campanha da Floresta", 0);
    await waitForBodyText("Este grimório ainda está vazio.");
  },
);

await step(
  "Mover de Sem grimório para grimório nomeado respeita exclusividade",
  async () => {
    await page.getByRole("button", { name: /^Sem grimório/ }).click();
    await page
      .getByRole("heading", { name: "Sem grimório", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Gerenciar grimórios de Bola de Fogo" })
      .click();
    const dialog = page.getByRole("dialog", { name: "Organizar magia" });
    await dialog.waitFor();
    await dialog
      .getByRole("checkbox", { name: /Campanha da Floresta/ })
      .click();
    const reserved = dialog.getByRole("checkbox", { name: /Sem grimório/ });
    assert.equal(
      await reserved.getAttribute("aria-checked"),
      "false",
      "Sem grimório continuou marcado",
    );
    await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
    await page
      .getByText(/foi salva em “Campanha da Floresta”/)
      .first()
      .waitFor();
    await waitForNavCount("Sem grimório", 0);
    await waitForNavCount("Campanha da Floresta", 1);
    await page
      .getByRole("heading", { name: "Sem grimório", exact: true })
      .waitFor();
    await waitForBodyText("Sem grimório está vazio.");
  },
);

await step("Renomear grimório persiste e atualiza a navegação", async () => {
  await page
    .getByRole("button", { name: "Gerenciar o grimório Campanha da Floresta" })
    .click();
  await page.getByRole("menuitem", { name: "Renomear" }).click();
  const dialog = page.getByRole("dialog", { name: "Renomear grimório" });
  await dialog.waitFor();
  await page.getByLabel("Nome do grimório").fill("Círculo Dourado");
  await dialog.getByRole("button", { name: "Salvar nome" }).click();
  await page
    .getByText(/Grimório renomeado para “Círculo Dourado”/)
    .first()
    .waitFor();
  await waitForNavCount("Círculo Dourado", 1);
  await page.getByRole("button", { name: /^Círculo Dourado/ }).click();
  await page.getByRole("heading", { name: "Círculo Dourado" }).waitFor();
  await page
    .getByRole("heading", { name: "Bola de Fogo", exact: true })
    .waitFor();
});

await step(
  "Excluir grimório confirma e move a magia para Sem grimório",
  async () => {
    await page
      .getByRole("button", { name: "Gerenciar o grimório Círculo Dourado" })
      .click();
    await page.getByRole("menuitem", { name: "Excluir" }).click();
    const alert = page.getByRole("alertdialog");
    await alert.waitFor();
    await expectText(alert, "Excluir grimório?");
    await expectText(alert, "Sem grimório");
    await alert.getByRole("button", { name: "Excluir grimório" }).click();
    await page
      .getByText(/excluído/)
      .first()
      .waitFor();
    await page
      .getByRole("heading", { name: "Todas as magias salvas" })
      .waitFor();
    await waitForNavCount("Sem grimório", 1);
    assert.equal(await navCount("Círculo Dourado"), null);
    assert.equal(await page.locator("article").count(), 1);
    await page.getByRole("button", { name: /^Sem grimório/ }).click();
    await page
      .getByRole("heading", { name: "Bola de Fogo", exact: true })
      .waitFor();
  },
);

const seedData = await api("/api/magias?limit=6&sort=circulo-desc");
const seedDataAsc = await api("/api/magias?limit=8&sort=circulo-asc");
const seedIds = [
  ...new Set(
    [...seedData.items, ...seedDataAsc.items]
      .map((spell) => spell.id)
      .filter((id) => id !== bolaId),
  ),
].slice(0, 10);
assert.equal(
  seedIds.length,
  10,
  "não foi possível obter 10 magias para semear paginação",
);

const fakeId = "11111111-1111-4111-8111-111111111111";

await step(
  "Preparar referências locais adicionais para paginação e offline",
  async () => {
    await page.evaluate(
      async ({ ids, fake, namedSpell }) => {
        const request = indexedDB.open("ars-arcana");
        const db = await new Promise((resolve, reject) => {
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        const tx = db.transaction(
          ["listas_salvas", "magias_salvas"],
          "readwrite",
        );
        const now = new Date().toISOString();
        tx.objectStore("listas_salvas").put({
          id: "grimorio-teste-local",
          nome: "Grimório de Teste",
          criadaEm: now,
          atualizadaEm: now,
          reservada: false,
        });
        const spells = tx.objectStore("magias_salvas");
        for (const id of ids) {
          spells.put({ listaId: "sem-grimorio", magiaId: id, salvaEm: now });
        }
        spells.put({ listaId: "sem-grimorio", magiaId: fake, salvaEm: now });
        spells.put({
          listaId: "grimorio-teste-local",
          magiaId: namedSpell,
          salvaEm: now,
        });
        await new Promise((resolve, reject) => {
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error);
        });
        db.close();
      },
      { ids: seedIds, fake: fakeId, namedSpell: seedIds[0] },
    );

    await page.reload({ waitUntil: "networkidle" });
    await page
      .getByRole("heading", { name: "Sem grimório", exact: true })
      .waitFor();
    await page.waitForTimeout(1500);
    await waitForBodyText("Mostrando 1–9 de 12 magias neste grimório");
    await waitForNavCount("Todas as magias", 12);
    await waitForNavCount("Grimório de Teste", 1);
    await waitForNavCount("Sem grimório", 12);
  },
);

await step(
  "Magia fora do catálogo permanece como referência sem snapshot",
  async () => {
    await waitForBodyText("Referências sem detalhes neste navegador");
    await waitForBodyText("1 magia salva não possui detalhes disponíveis");
    await page.getByRole("link", { name: /Página 2/ }).click();
    await page.waitForURL(/page=2/);
    await page
      .getByRole("heading", { name: "Magia não sincronizada" })
      .waitFor();
    await page.waitForFunction(
      (id) => document.body.innerText.includes(id),
      fakeId,
    );
    await page.reload({ waitUntil: "networkidle" });
    await page
      .getByRole("heading", { name: "Sem grimório", exact: true })
      .waitFor();
    const preserved = await page.evaluate(async (id) => {
      const request = indexedDB.open("ars-arcana");
      const db = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const tx = db.transaction("magias_salvas", "readonly");
      const row = await new Promise((resolve, reject) => {
        const get = tx.objectStore("magias_salvas").get(["sem-grimorio", id]);
        get.onsuccess = () => resolve(get.result);
        get.onerror = () => reject(get.error);
      });
      db.close();
      return Boolean(row);
    }, fakeId);
    assert.ok(preserved, "a referência sem snapshot foi removida");
  },
);

await step(
  "Busca local e ordenação por círculo funcionam no conjunto selecionado",
  async () => {
    const search = page.getByRole("searchbox", {
      name: "Pesquisar nas magias salvas",
    });
    await search.fill("bola de fogo");
    await waitForBodyText("Mostrando 1–1 de 1 magias neste grimório");
    assert.equal(await page.locator("article").count(), 1);
    await search.fill("termo-inexistente-xyz");
    await page
      .getByRole("heading", { name: "Nenhuma magia encontrada." })
      .waitFor();
    await page.getByRole("button", { name: "Limpar busca" }).last().click();
    await waitForBodyText("Mostrando 1–9 de 12 magias neste grimório");

    await page.selectOption("#ordenar-magias-salvas", "circulo-desc");
    await page.waitForURL(/sort=circulo-desc/);
    await expectText(page.locator("article").first(), "9º Círculo");
    await page.selectOption("#ordenar-magias-salvas", "circulo-asc");
    await page.waitForURL(/sort=circulo-asc/);
    await expectText(page.locator("article").first(), "Truque");
  },
);

await step(
  "Paginação local preserva o conjunto e mostra o intervalo correto",
  async () => {
    await page.selectOption("#ordenar-magias-salvas", "nome-asc");
    await page.waitForURL((url) => !url.searchParams.has("sort"));
    await page.getByRole("link", { name: /Próxima página/ }).click();
    await page.waitForURL(/page=2/);
    await waitForBodyText("Mostrando 10–12 de 12 magias neste grimório");
    assert.equal(await page.locator("article").count(), 3);
    await page.getByRole("link", { name: /Anterior/ }).click();
    await waitForBodyText("Mostrando 1–9 de 12 magias neste grimório");
  },
);

await step(
  "Snapshots locais aparecem quando o catálogo está indisponível",
  async () => {
    await page.route(/\/api\/magias\?ids=/, (route) =>
      route.abort("internetdisconnected"),
    );
    await goto("/magias-salvas?grimorio=sem-grimorio", "domcontentloaded");
    await page
      .getByRole("heading", { name: "Sem grimório", exact: true })
      .waitFor();
    await page
      .getByRole("heading", { name: "Bola de Fogo", exact: true })
      .waitFor({ timeout: 15000 });
    await page
      .getByText(/Não foi possível sincronizar os detalhes/)
      .first()
      .waitFor();
    await page
      .getByText(/cópias disponíveis continuam acessíveis/)
      .first()
      .waitFor();
    await page.unroute(/\/api\/magias\?ids=/);
  },
);

await step("Detalhe usa snapshot local quando a API falha", async () => {
  await page.route(`**/api/magias/${bolaId}`, (route) =>
    route.abort("internetdisconnected"),
  );
  await goto(
    `/magias/${bolaId}?from=%2Fmagias-salvas%3Fgrimorio%3Dsem-grimorio`,
    "domcontentloaded",
  );
  await page
    .getByRole("heading", { name: "Bola de Fogo", exact: true, level: 1 })
    .waitFor({ timeout: 15000 });
  await page.getByText("Cópia salva neste navegador").waitFor();
  await page
    .getByText(/Não foi possível atualizar os detalhes/)
    .first()
    .waitFor();
  await page.unroute(`**/api/magias/${bolaId}`);
});

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
  "Layout estreito mantém navegação, filtros e coleção utilizáveis",
  async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await goto("/");
    await assertNoHorizontalOverflow("biblioteca mobile");
    await page.getByRole("button", { name: "Abrir menu de navegação" }).click();
    await page
      .getByRole("navigation", { name: "Navegação principal" })
      .last()
      .waitFor();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: /Filtrar busca/ }).click();
    const sheet = page
      .locator('[data-slot="sheet-content"]')
      .filter({ hasText: "Refinar busca" });
    await sheet.waitFor();
    await sheet.getByRole("button", { name: "Círculo 0: truques" }).click();
    await page.waitForURL(/circulo=0/);
    await page.waitForTimeout(300);
    await page.keyboard.press("Escape");
    await assertNoHorizontalOverflow("biblioteca mobile filtrada");
    await page.screenshot({
      path: `${OUT}/03-library-mobile.png`,
      fullPage: false,
    });

    await goto("/magias-salvas?grimorio=sem-grimorio");
    await page
      .getByRole("heading", { name: "Sem grimório", exact: true })
      .waitFor();
    await page.getByRole("button", { name: /Minha coleção/ }).click();
    const mobileCollection = page.locator("#minha-colecao-mobile");
    await mobileCollection.waitFor();
    await mobileCollection
      .getByRole("button", { name: "Criar grimório", exact: true })
      .waitFor();
    await mobileCollection
      .getByRole("button", { name: /^Grimório de Teste/ })
      .click();
    await page.getByRole("heading", { name: "Grimório de Teste" }).waitFor();
    await assertNoHorizontalOverflow("magias salvas mobile");
    await page.screenshot({
      path: `${OUT}/04-saved-mobile.png`,
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
    "Falha do IndexedDB mostra erro explícito, não coleção vazia",
    async () => {
      await storagePage.goto(`${BASE}/magias-salvas`, {
        waitUntil: "networkidle",
      });
      await storagePage
        .getByRole("heading", {
          name: "Não foi possível abrir suas magias salvas.",
        })
        .waitFor({
          timeout: 15000,
        });
      const body = await storagePage.locator("main").innerText();
      assert.ok(body.includes("armazenamento local"), body);
      assert.ok(
        !body.includes("Sua coleção ainda está vazia."),
        "falha exibida como coleção vazia",
      );
      await storagePage
        .getByRole("button", { name: "Tentar novamente" })
        .first()
        .waitFor();
      await storagePage.screenshot({
        path: `${OUT}/05-storage-error.png`,
        fullPage: false,
      });
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
        path: `${OUT}/06-catalog-error.png`,
        fullPage: false,
      });
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
