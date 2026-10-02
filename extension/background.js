const api = globalThis.browser ?? globalThis.chrome;

const PORTALS = {
  cnpj:
    "https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/Cnpjreva_Solicitacao.asp",
  fgts:
    "https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf",
  cndt:
    "https://www.tst.jus.br/certidao1",
  federal:
    "https://solucoes.receita.fazenda.gov.br/Servicos/certidaointernet/PJ/Emitir",
  estadual_mg:
    "https://www.fazenda.mg.gov.br/empresas/certidao_debitos/",
  tcu:
    "https://certidoes-apf.apps.tcu.gov.br/"
};

function cleanCnpj(value = "") {
  return String(value).toUpperCase().replace(/[^0-9A-Z]/g, "");
}

async function downloadTcu(cnpj) {
  const clean = cleanCnpj(cnpj);

  if (!/^\d{14}$/.test(clean)) {
    throw new Error("A API pública do TCU aceita CNPJ numérico neste fluxo.");
  }

  const url =
    "https://certidoes-apf.apps.tcu.gov.br/api/rest/publico/certidoes/" +
    encodeURIComponent(clean) +
    "?seEmitirPDF=true";

  const response = await fetch(url, {
    headers: {
      accept: "application/json"
    }
  });

  const raw = await response.text();
  let data;

  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("O TCU retornou conteúdo não reconhecido.");
  }

  if (!response.ok) {
    throw new Error(data?.message || "TCU: HTTP " + response.status);
  }

  const base64 =
    data?.certidaoPDF ||
    data?.pdfBase64 ||
    data?.pdf ||
    data?.arquivo ||
    null;

  if (typeof base64 !== "string" || base64.length === 0) {
    throw new Error("O TCU não retornou o PDF.");
  }

  const normalized = base64.replace(
    /^data:application\/pdf;base64,/i,
    ""
  );

  const dataUrl = "data:application/pdf;base64," + normalized;

  const downloadId = await api.downloads.download({
    url: dataUrl,
    filename: "Documentos-Licitacao/06-TCU-Consulta-Consolidada-" + clean + ".pdf",
    saveAs: false,
    conflictAction: "uniquify"
  });

  return { ok: true, downloadId };
}

async function openPortal(kind, cnpj, uf) {
  const clean = cleanCnpj(cnpj);
  const key = kind === "estadual" && uf === "MG" ? "estadual_mg" : kind;
  const url = PORTALS[key];

  if (!url) {
    throw new Error("Portal ainda não configurado para este documento.");
  }

  await api.storage.local.set({
    pendingCertificate: {
      kind,
      cnpj: clean,
      uf,
      createdAt: Date.now()
    }
  });

  const tab = await api.tabs.create({ url, active: true });
  return { ok: true, tabId: tab?.id ?? null };
}

async function handle(message) {
  if (!message || message.source !== "documentos-licitacao-site") {
    return { ok: false, error: "Mensagem inválida." };
  }

  if (message.type === "PING") {
    return {
      ok: true,
      extension: true,
      version: api.runtime.getManifest().version
    };
  }

  if (message.type === "DOWNLOAD_TCU") {
    return downloadTcu(message.cnpj);
  }

  if (message.type === "OPEN_PORTAL") {
    return openPortal(message.kind, message.cnpj, message.uf);
  }

  return { ok: false, error: "Ação desconhecida." };
}

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  Promise.resolve(handle(message))
    .then(sendResponse)
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error?.message || "Erro na extensão."
      });
    });

  return true;
});
