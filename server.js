import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

import { fetchCompany } from "./providers/company.js";
import { fetchTcu, classifyTcu, extractTcuPdf } from "./providers/tcu.js";
import {
  OFFICIAL_URLS,
  captchaDocument,
  configuredApiDocument,
  unavailableStateDocument
} from "./providers/documents.js";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || "0.0.0.0";

export function cleanCnpj(value = "") {
  return String(value).toUpperCase().replace(/[^0-9A-Z]/g, "");
}

export function formatCnpj(value) {
  const cnpj = cleanCnpj(value).slice(0, 14);

  if (cnpj.length <= 2) return cnpj;
  if (cnpj.length <= 5) return cnpj.slice(0, 2) + "." + cnpj.slice(2);
  if (cnpj.length <= 8) {
    return (
      cnpj.slice(0, 2) +
      "." +
      cnpj.slice(2, 5) +
      "." +
      cnpj.slice(5)
    );
  }
  if (cnpj.length <= 12) {
    return (
      cnpj.slice(0, 2) +
      "." +
      cnpj.slice(2, 5) +
      "." +
      cnpj.slice(5, 8) +
      "/" +
      cnpj.slice(8)
    );
  }

  return (
    cnpj.slice(0, 2) +
    "." +
    cnpj.slice(2, 5) +
    "." +
    cnpj.slice(5, 8) +
    "/" +
    cnpj.slice(8, 12) +
    "-" +
    cnpj.slice(12)
  );
}

export function validNumericCnpj(value) {
  const cnpj = cleanCnpj(value);

  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) {
    return false;
  }

  const digit = (length) => {
    let factor = length - 7;
    let total = 0;

    for (const char of cnpj.slice(0, length)) {
      total += Number(char) * factor--;
      if (factor === 1) factor = 9;
    }

    const remainder = total % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  return digit(12) === Number(cnpj[12]) && digit(13) === Number(cnpj[13]);
}

export function acceptedCnpj(value) {
  const cnpj = cleanCnpj(value);

  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(cnpj)) {
    return false;
  }

  return /^\d{14}$/.test(cnpj) ? validNumericCnpj(cnpj) : true;
}

function companyDocument(company) {
  if (!company) {
    return {
      id: "cnpj",
      title: "Cartão / dados do CNPJ",
      source: "Receita Federal",
      mode: "manual",
      modeLabel: "Portal oficial",
      status: "Consulta cadastral indisponível",
      tone: "warning",
      message:
        "Não foi possível obter os dados cadastrais automaticamente. O comprovante oficial continua disponível na Receita Federal.",
      officialUrl: OFFICIAL_URLS.cnpj,
      downloadable: false
    };
  }

  const status = company.situacao || "Consultado";

  return {
    id: "cnpj",
    title: "Dados cadastrais do CNPJ",
    source: "BrasilAPI / Minha Receita",
    mode: "automatic",
    modeLabel: "Consulta automática",
    status,
    tone: String(status).toUpperCase() === "ATIVA" ? "success" : "warning",
    message:
      "Os dados cadastrais são consultados automaticamente. O cartão oficial da Receita ainda é emitido pelo portal oficial.",
    officialUrl: OFFICIAL_URLS.cnpj,
    downloadable: false
  };
}

function federalDocument() {
  const configured = Boolean(
    process.env.FEDERAL_CND_API_URL && process.env.FEDERAL_CND_TOKEN
  );

  if (!configured) {
    return configuredApiDocument(
      "federal",
      "Regularidade Fiscal Federal",
      "RFB / PGFN",
      OFFICIAL_URLS.federal,
      "Existe integração oficial autenticada, mas ela precisa ser configurada no servidor. Enquanto isso, a emissão pública exige confirmação humana."
    );
  }

  return {
    id: "federal",
    title: "Regularidade Fiscal Federal",
    source: "RFB / PGFN",
    mode: "credentials",
    modeLabel: "API configurável",
    status: "Credencial detectada",
    tone: "neutral",
    message:
      "As credenciais foram detectadas, mas o adaptador da API federal ainda precisa ser ajustado ao contrato de acesso disponibilizado ao órgão.",
    officialUrl: OFFICIAL_URLS.federal,
    downloadable: false
  };
}

async function consultation(cnpj, uf) {
  const [companyResult, tcuResult] = await Promise.allSettled([
    fetchCompany(cnpj),
    fetchTcu(cnpj, { pdf: false })
  ]);

  const company =
    companyResult.status === "fulfilled" ? companyResult.value : null;

  const documents = [companyDocument(company)];

  documents.push(
    captchaDocument(
      "fgts",
      "Regularidade do FGTS / CRF",
      "CAIXA",
      OFFICIAL_URLS.fgts,
      "A CAIXA exige verificação humana no fluxo público. O sistema pode automatizar a navegação antes e depois dessa etapa em uma fase futura."
    ),
    captchaDocument(
      "cndt",
      "CNDT Trabalhista",
      "TST",
      OFFICIAL_URLS.cndt,
      "A emissão pública da CNDT exige CAPTCHA. O sistema não tenta contornar essa verificação."
    ),
    federalDocument()
  );

  documents.push(
    uf === "MG"
      ? captchaDocument(
          "estadual",
          "Certidão Estadual",
          "SEF/MG",
          OFFICIAL_URLS.mg,
          "A emissão pública da CDT em Minas Gerais usa confirmação humana no fluxo atual."
        )
      : unavailableStateDocument(uf)
  );

  if (tcuResult.status === "fulfilled") {
    const result = classifyTcu(tcuResult.value);

    documents.push({
      id: "sancoes",
      title: "Consulta Consolidada de Pessoa Jurídica",
      source: "TCU — API pública oficial",
      mode: "automatic",
      modeLabel: "Download automático",
      status: result.bad.length ? "Revisar ocorrências" : "Consulta concluída",
      tone: result.bad.length ? "danger" : "success",
      message: result.bad.length
        ? result.bad.length + " retorno(s) merecem revisão."
        : result.count + " retorno(s) processado(s). O PDF pode ser gerado automaticamente.",
      officialUrl: OFFICIAL_URLS.tcu,
      downloadable: true,
      downloadUrl: "/api/documents/tcu.pdf?cnpj=" + encodeURIComponent(cnpj),
      details: result.items
    });
  } else {
    documents.push({
      id: "sancoes",
      title: "Consulta Consolidada de Pessoa Jurídica",
      source: "TCU",
      mode: "automatic",
      modeLabel: "Automático",
      status:
        tcuResult.reason?.code === "TCU_CNPJ_FORMAT"
          ? "Formato ainda não suportado pela API"
          : "Consulta indisponível",
      tone: "warning",
      message:
        tcuResult.reason?.message ||
        "Não foi possível consultar a API pública do TCU.",
      officialUrl: OFFICIAL_URLS.tcu,
      downloadable: false
    });
  }

  return {
    ok: true,
    cnpj,
    formattedCnpj: formatCnpj(cnpj),
    uf,
    company,
    documents,
    capabilities: {
      backend: true,
      automaticDownloads: documents
        .filter((document) => document.downloadable)
        .map((document) => document.id)
    },
    consultedAt: new Date().toISOString()
  };
}

async function sendTcuPdf(cnpj, response) {
  if (!acceptedCnpj(cnpj)) {
    response.writeHead(400, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: false, error: "CNPJ inválido" }));
    return;
  }

  const data = await fetchTcu(cnpj, { pdf: true });
  const pdf = extractTcuPdf(data);

  response.writeHead(200, {
    "content-type": "application/pdf",
    "content-length": String(pdf.length),
    "content-disposition":
      'attachment; filename="06-TCU-Consulta-Consolidada-' + cnpj + '.pdf"',
    "cache-control": "no-store"
  });
  response.end(pdf);
}

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

async function serveStatic(pathname, response) {
  const relative = pathname === "/" ? "index.html" : pathname.slice(1);
  const safe = normalize(relative).replace(/^(\.\.(\/|\\|$))+/, "");
  const file = join(ROOT, safe);
  const data = await readFile(file);

  response.writeHead(200, {
    "content-type": mime[extname(file)] || "application/octet-stream"
  });
  response.end(data);
}

async function handler(request, response) {
  const url = new URL(request.url, "http://localhost");
  const allowedOrigin = process.env.CORS_ORIGIN || "*";

  response.setHeader("access-control-allow-origin", allowedOrigin);
  response.setHeader("access-control-allow-methods", "GET, OPTIONS");
  response.setHeader("access-control-allow-headers", "Accept, Content-Type");
  response.setHeader("vary", "Origin");

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  try {
    if (url.pathname === "/api/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          ok: true,
          service: "documentos-licitacao",
          version: "0.4.0"
        })
      );
      return;
    }

    if (url.pathname === "/api/consulta") {
      const cnpj = cleanCnpj(url.searchParams.get("cnpj"));
      const uf = String(url.searchParams.get("uf") || "").toUpperCase();

      if (!acceptedCnpj(cnpj)) {
        response.writeHead(400, { "content-type": "application/json" });
        response.end(JSON.stringify({ ok: false, error: "CNPJ inválido" }));
        return;
      }

      if (!/^[A-Z]{2}$/.test(uf)) {
        response.writeHead(400, { "content-type": "application/json" });
        response.end(JSON.stringify({ ok: false, error: "UF inválida" }));
        return;
      }

      const result = await consultation(cnpj, uf);
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(result));
      return;
    }

    if (url.pathname === "/api/documents/tcu.pdf") {
      await sendTcuPdf(cleanCnpj(url.searchParams.get("cnpj")), response);
      return;
    }

    await serveStatic(url.pathname, response);
  } catch (error) {
    const status = error?.code === "ENOENT" ? 404 : 500;

    response.writeHead(status, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        ok: false,
        error:
          status === 404
            ? "Recurso não encontrado"
            : error?.message || "Erro interno"
      })
    );
  }
}

export const server = createServer(handler);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(PORT, HOST, () => {
    console.log("Documentos de Licitação: http://" + HOST + ":" + PORT);
  });
}
