import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";

const manifest = JSON.parse(
  await readFile(new URL("./extension/manifest.json", import.meta.url), "utf8")
);

test("manifesto contém somente os portais iniciais necessários", () => {
  const hosts = manifest.host_permissions;

  assert.ok(hosts.includes("https://certidoes.cgu.gov.br/*"));
  assert.ok(hosts.includes("https://cndt-certidao.tst.jus.br/*"));
  assert.ok(hosts.includes("https://solucoes.receita.fazenda.gov.br/*"));
  assert.ok(hosts.includes("https://servicos.receitafederal.gov.br/*"));
  assert.equal(manifest.manifest_version, 3);
});

test("adaptadores declarados no manifesto existem", async () => {
  const files = new Set();

  for (const entry of manifest.content_scripts || []) {
    for (const file of entry.js || []) files.add(file);
  }

  for (const file of files) {
    await access(new URL("./extension/" + file, import.meta.url));
  }
});

test("painel local existe", async () => {
  await access(new URL("./extension/dashboard/index.html", import.meta.url));
  await access(new URL("./extension/dashboard/app.js", import.meta.url));
  await access(new URL("./extension/dashboard/styles.css", import.meta.url));
});
