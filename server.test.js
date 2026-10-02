import test from "node:test";
import assert from "node:assert/strict";

import {
  cleanCnpj,
  formatCnpj,
  validNumericCnpj,
  acceptedCnpj
} from "./server.js";
import { classifyTcu, extractTcuPdf } from "./providers/tcu.js";

test("valida e formata CNPJ numérico", () => {
  assert.equal(cleanCnpj("19.131.243/0001-97"), "19131243000197");
  assert.equal(formatCnpj("19131243000197"), "19.131.243/0001-97");
  assert.equal(validNumericCnpj("19.131.243/0001-97"), true);
  assert.equal(acceptedCnpj("11.111.111/1111-11"), false);
});

test("aceita estrutura do CNPJ alfanumérico", () => {
  assert.equal(acceptedCnpj("00.000.000/E08G-12"), true);
});

test("classifica retorno consolidado do TCU", () => {
  assert.equal(
    classifyTcu({ certidoes: [{ situacao: "Nada consta" }] }).bad.length,
    0
  );
  assert.equal(
    classifyTcu({ certidoes: [{ situacao: "Consta registro" }] }).bad.length,
    1
  );
});

test("extrai PDF base64 retornado pelo TCU", () => {
  const expected = Buffer.from("%PDF-1.4\nmock");
  const actual = extractTcuPdf({
    certidaoPDF: expected.toString("base64")
  });

  assert.deepEqual(actual, expected);
});
