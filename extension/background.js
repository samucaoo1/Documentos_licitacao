const api = globalThis.browser ?? globalThis.chrome;

const DOCUMENTS = {
  cgu: {
    label: "CGU — Certidão Negativa Correcional",
    url: "https://certidoes.cgu.gov.br/consulta-certidao",
    order: "01"
  },
  cndt: {
    label: "CNDT — Débitos Trabalhistas",
    url: "https://cndt-certidao.tst.jus.br/gerarCertidao",
    order: "02"
  },
  cnpj: {
    label: "Receita — Comprovante CNPJ",
    url: "https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/",
    order: "03"
  },
  federal: {
    label: "RFB/PGFN — Regularidade Fiscal Federal",
    url: "https://servicos.receitafederal.gov.br/servico/certidoes/#/home/cnpj",
    order: "04"
  }
};

function cleanCnpj(value = "") {
  return String(value).replace(/\D/g, "").slice(0, 14);
}

function makeDocuments() {
  return Object.fromEntries(
    Object.entries(DOCUMENTS).map(([id, item]) => [
      id,
      {
        id,
        label: item.label,
        url: item.url,
        status: "idle",
        message: "Aguardando",
        tabId: null,
        downloadId: null,
        filename: null,
        updatedAt: Date.now()
      }
    ])
  );
}

async function getState() {
  const stored = await api.storage.local.get("workflowState");
  return stored.workflowState || {
    supplier: null,
    running: false,
    startedAt: null,
    documents: makeDocuments()
  };
}

async function setState(state) {
  await api.storage.local.set({ workflowState: state });
  return state;
}

async function patchDocument(id, patch) {
  const state = await getState();
  if (!state.documents[id]) return state;

  state.documents[id] = {
    ...state.documents[id],
    ...patch,
    updatedAt: Date.now()
  };

  await setState(state);
  return state;
}

async function resetWorkflow() {
  return setState({
    supplier: null,
    running: false,
    startedAt: null,
    documents: makeDocuments()
  });
}

async function openDocument(id, active = false) {
  const state = await getState();
  const doc = state.documents[id];

  if (!doc) throw new Error("Documento desconhecido.");

  if (doc.tabId) {
    try {
      const existing = await api.tabs.get(doc.tabId);
      if (existing) {
        if (active) await api.tabs.update(doc.tabId, { active: true });
        return existing;
      }
    } catch {}
  }

  const tab = await api.tabs.create({
    url: DOCUMENTS[id].url,
    active
  });

  await patchDocument(id, {
    status: "opening",
    message: "Abrindo portal oficial…",
    tabId: tab?.id ?? null
  });

  return tab;
}

async function startWorkflow(cnpj, uf) {
  const clean = cleanCnpj(cnpj);

  if (!/^\d{14}$/.test(clean)) {
    throw new Error("Informe um CNPJ numérico com 14 dígitos.");
  }

  const state = {
    supplier: {
      cnpj: clean,
      uf: String(uf || "").toUpperCase()
    },
    running: true,
    startedAt: Date.now(),
    documents: makeDocuments()
  };

  await setState(state);

  for (const id of Object.keys(DOCUMENTS)) {
    await openDocument(id, false);
  }

  return getState();
}

async function focusDocument(id) {
  const state = await getState();
  const doc = state.documents[id];

  if (!doc) throw new Error("Documento desconhecido.");

  if (doc.tabId) {
    try {
      return await api.tabs.update(doc.tabId, { active: true });
    } catch {}
  }

  return openDocument(id, true);
}

async function portalReady(kind, sender) {
  const state = await getState();
  const doc = state.documents[kind];

  if (!state.supplier || !doc) {
    return { ok: false, inactive: true };
  }

  await patchDocument(kind, {
    status: "working",
    message: "Portal carregado; preparando consulta…",
    tabId: sender?.tab?.id ?? doc.tabId ?? null
  });

  return {
    ok: true,
    supplier: state.supplier,
    document: state.documents[kind]
  };
}

async function downloadUrl(kind, url, filename) {
  const state = await getState();
  const cnpj = state.supplier?.cnpj;

  if (!cnpj) throw new Error("Nenhum licitante ativo.");

  const order = DOCUMENTS[kind]?.order || "99";
  const safeName =
    filename || order + "-" + kind.toUpperCase() + "-" + cnpj + ".pdf";

  const downloadId = await api.downloads.download({
    url,
    filename:
      "Licitacoes/" +
      cnpj +
      "/" +
      safeName.replace(/[\\/:*?"<>|]+/g, "-"),
    saveAs: false,
    conflictAction: "uniquify"
  });

  await patchDocument(kind, {
    status: "downloading",
    message: "Baixando certidão…",
    downloadId,
    filename: safeName
  });

  const stored = await api.storage.local.get("downloadMap");
  const map = stored.downloadMap || {};
  map[String(downloadId)] = kind;
  await api.storage.local.set({ downloadMap: map });

  return { ok: true, downloadId };
}

async function saveCurrentPageAsPdf(kind, sender) {
  const state = await getState();
  const cnpj = state.supplier?.cnpj;
  const tabId = sender?.tab?.id;

  if (!cnpj || !tabId) {
    throw new Error("Não foi possível identificar a aba.");
  }

  if (typeof api.tabs.saveAsPDF !== "function") {
    return {
      ok: false,
      unsupported: true,
      error: "Seu navegador não oferece salvamento direto da página em PDF."
    };
  }

  await api.tabs.update(tabId, { active: true });

  const name =
    DOCUMENTS[kind].order +
    "-" +
    kind.toUpperCase() +
    "-" +
    cnpj +
    ".pdf";

  const result = await api.tabs.saveAsPDF({
    toFileName: name,
    showBackgroundColors: true,
    showBackgroundImages: true,
    shrinkToFit: true
  });

  await patchDocument(kind, {
    status:
      result === "saved" || result === "replaced"
        ? "downloaded"
        : "result_ready",
    message:
      result === "saved" || result === "replaced"
        ? "PDF salvo."
        : "Comprovante pronto; salvamento do PDF não foi concluído.",
    filename: name
  });

  return { ok: true, result };
}

async function handleMessage(message, sender) {
  if (!message || typeof message.type !== "string") {
    return { ok: false, error: "Mensagem inválida." };
  }

  switch (message.type) {
    case "GET_STATE":
      return { ok: true, state: await getState() };

    case "RESET":
      return { ok: true, state: await resetWorkflow() };

    case "START_WORKFLOW":
      return {
        ok: true,
        state: await startWorkflow(message.cnpj, message.uf)
      };

    case "OPEN_DASHBOARD":
      await api.tabs.create({
        url: api.runtime.getURL("dashboard/index.html"),
        active: true
      });
      return { ok: true };

    case "FOCUS_DOCUMENT":
      await focusDocument(message.kind);
      return { ok: true };

    case "PORTAL_READY":
      return portalReady(message.kind, sender);

    case "ADAPTER_STATUS":
      await patchDocument(message.kind, {
        status: message.status,
        message: message.message || "",
        tabId: sender?.tab?.id ?? null
      });
      return { ok: true };

    case "DOWNLOAD_URL":
      return downloadUrl(message.kind, message.url, message.filename);

    case "SAVE_PAGE_PDF":
      return saveCurrentPageAsPdf(message.kind, sender);

    default:
      return { ok: false, error: "Ação desconhecida." };
  }
}

api.runtime.onInstalled.addListener(() => {
  resetWorkflow().catch(() => {});
});

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  Promise.resolve(handleMessage(message, sender))
    .then(sendResponse)
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error?.message || "Erro interno da extensão."
      });
    });

  return true;
});


function inferKindFromDownload(item) {
  const text = [
    item?.url,
    item?.finalUrl,
    item?.referrer,
    item?.filename
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (text.includes("certidoes.cgu.gov.br")) return "cgu";
  if (text.includes("cndt-certidao.tst.jus.br")) return "cndt";
  if (text.includes("cnpjreva")) return "cnpj";
  if (text.includes("servicos.receitafederal.gov.br")) return "federal";

  return null;
}

api.downloads.onCreated.addListener(async (item) => {
  const kind = inferKindFromDownload(item);
  if (!kind) return;

  const state = await getState();
  const doc = state.documents?.[kind];

  if (!doc || doc.status === "downloaded") return;

  const stored = await api.storage.local.get("downloadMap");
  const map = stored.downloadMap || {};

  map[String(item.id)] = kind;
  await api.storage.local.set({ downloadMap: map });

  await patchDocument(kind, {
    status: "downloading",
    message: "Download iniciado pelo portal oficial.",
    downloadId: item.id,
    filename: item.filename || null
  });
});

api.downloads.onChanged.addListener(async (delta) => {
  if (!delta?.id || delta.state?.current !== "complete") return;

  const stored = await api.storage.local.get("downloadMap");
  const map = stored.downloadMap || {};
  const kind = map[String(delta.id)];

  if (!kind) return;

  const items = await api.downloads.search({ id: delta.id });
  const item = items?.[0];

  await patchDocument(kind, {
    status: "downloaded",
    message: "Certidão baixada.",
    filename: item?.filename || null
  });

  delete map[String(delta.id)];
  await api.storage.local.set({ downloadMap: map });
});
