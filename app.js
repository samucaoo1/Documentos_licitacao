const $ = (selector) => document.querySelector(selector);

const form = $("#searchForm");
const cnpjInput = $("#cnpj");
const ufInput = $("#uf");
const grid = $("#documents");
const template = $("#card");
const company = $("#company");
const companyName = $("#companyName");
const companyMeta = $("#companyMeta");
const overall = $("#overall");
const refresh = $("#refresh");
const downloadAvailable = $("#downloadAvailable");
const environmentNotice = $("#environmentNotice");
const companyCnaes = $("#companyCnaes");
const primaryCnae = $("#primaryCnae");
const secondaryCnaesBox = $("#secondaryCnaesBox");
const secondaryCnaesSummary = $("#secondaryCnaesSummary");
const secondaryCnaes = $("#secondaryCnaes");

const IS_GITHUB_PAGES = location.hostname.endsWith(".github.io");
const API_BASE_URL = String(window.APP_CONFIG?.API_BASE_URL || "").replace(/\/$/, "");
const USE_BACKEND = !IS_GITHUB_PAGES || Boolean(API_BASE_URL);
let lastResult = null;

function backendUrl(path) {
  return API_BASE_URL + path;
}

const OFFICIAL = {
  cnpj:
    "https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/Cnpjreva_Solicitacao.asp",
  fgts:
    "https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf",
  cndt: "https://www.tst.jus.br/certidao1",
  federal:
    "https://solucoes.receita.fazenda.gov.br/Servicos/certidaointernet/PJ/Emitir",
  mg: "https://www.fazenda.mg.gov.br/empresas/certidao_debitos/",
  tcu: "https://certidoes-apf.apps.tcu.gov.br/"
};

if (IS_GITHUB_PAGES) {
  environmentNotice.classList.remove("hidden");

  environmentNotice.innerHTML = API_BASE_URL
    ? "<strong>GitHub Pages + backend:</strong> interface estática conectada ao servidor de emissão automática."
    : "<strong>Modo GitHub Pages:</strong> esta hospedagem é estática. Configure <code>API_BASE_URL</code> em <code>config.js</code> para habilitar o backend e os downloads automáticos.";
}

const clean = (value) =>
  String(value || "")
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .slice(0, 14);

const format = (value) => {
  const cnpj = clean(value);

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
};

cnpjInput.addEventListener("input", (event) => {
  event.target.value = format(event.target.value);
});

function skeleton() {
  grid.innerHTML = "";

  for (const [icon, title] of [
    ["C", "CNPJ"],
    ["F", "FGTS"],
    ["T", "CNDT"],
    ["U", "Federal"],
    ["E", "Estadual"],
    ["S", "Sanções"]
  ]) {
    const node = template.content.cloneNode(true);
    node.querySelector(".icon").textContent = icon;
    node.querySelector("h4").textContent = title;
    node.querySelector(".source").textContent = "Consulta em andamento";
    node.querySelector(".mode").textContent = "Verificando integração";
    node.querySelector(".badge").textContent = "Consultando";
    node.querySelector(".message").textContent = "Aguarde...";
    node.querySelector(".action").disabled = true;
    grid.appendChild(node);
  }
}

function setDownloadState() {
  const automatic =
    lastResult?.documents?.filter((item) => item.downloadable) || [];

  downloadAvailable.disabled = automatic.length === 0;
  downloadAvailable.textContent =
    automatic.length > 0
      ? "Baixar certidões disponíveis (" + automatic.length + ")"
      : "Nenhuma certidão automática disponível";
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.headers || {})
    }
  });

  const raw = await response.text();
  let data;

  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(
      "A fonte retornou conteúdo não esperado (HTTP " +
        response.status +
        ")."
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.message || data?.error || "Falha HTTP " + response.status
    );
  }

  return data;
}

function modeClass(mode) {
  if (mode === "automatic") return "automatic";
  if (mode === "captcha") return "captcha";
  if (mode === "credentials") return "credentials";
  return "manual";
}

function renderDocuments(data) {
  grid.innerHTML = "";

  for (const doc of data.documents) {
    const node = template.content.cloneNode(true);
    const badge = node.querySelector(".badge");
    const mode = node.querySelector(".mode");
    const downloadAction = node.querySelector(".downloadAction");
    const portalAction = node.querySelector(".portalAction");

    node.querySelector(".icon").textContent =
      {
        cnpj: "C",
        fgts: "F",
        cndt: "T",
        federal: "U",
        estadual: "E",
        sancoes: "S"
      }[doc.id] || "D";

    node.querySelector("h4").textContent = doc.title;
    node.querySelector(".source").textContent = doc.source;

    mode.textContent = doc.modeLabel || "Integração";
    mode.className = "mode " + modeClass(doc.mode);

    badge.textContent = doc.status;
    badge.className = "badge " + (doc.tone || "neutral");

    node.querySelector(".message").textContent = doc.message;

    if (Array.isArray(doc.details) && doc.details.length) {
      const details = node.querySelector(".details");
      const body = node.querySelector(".detailsBody");

      details.classList.remove("hidden");

      for (const item of doc.details) {
        const row = window.document.createElement("div");
        row.className = "detail";
        row.textContent =
          (item.emissor || item.orgaoEmissor || "Órgão") +
          " — " +
          (item.situacao || item.descricao || "Retorno");
        body.appendChild(row);
      }
    }

    if (doc.clientDownload === "tcu") {
      downloadAction.classList.remove("hidden");
      downloadAction.textContent = "Gerar e baixar certidão";
      downloadAction.classList.add("primaryAction");
      downloadAction.onclick = () =>
        downloadTcuOnBrowser(data.cnpj, downloadAction);
    } else if (doc.downloadUrl) {
      downloadAction.classList.remove("hidden");
      downloadAction.textContent = "Baixar certidão";
      downloadAction.classList.add("primaryAction");
      downloadAction.onclick = () => {
        location.href = doc.downloadUrl.startsWith("/")
          ? backendUrl(doc.downloadUrl)
          : doc.downloadUrl;
      };
    }

    if (doc.officialUrl) {
      portalAction.classList.remove("hidden");

      if (doc.id === "cnpj") {
        portalAction.textContent = "Emitir cartão oficial";
      } else if (doc.mode === "captcha") {
        portalAction.textContent = "Emitir / baixar no portal";
      } else {
        portalAction.textContent = "Abrir portal oficial";
      }

      portalAction.onclick = () =>
        window.open(doc.officialUrl, "_blank", "noopener,noreferrer");
    }

    if (
      downloadAction.classList.contains("hidden") &&
      portalAction.classList.contains("hidden")
    ) {
      portalAction.classList.remove("hidden");
      portalAction.textContent = "Indisponível";
      portalAction.disabled = true;
    }

    grid.appendChild(node);
  }

  setDownloadState();
}

function renderCompanyCnaes(companyData) {
  const main = companyData?.cnaePrincipal;
  const secondary = Array.isArray(companyData?.cnaesSecundarios)
    ? companyData.cnaesSecundarios
    : [];

  const hasMain = Boolean(main?.codigo || main?.descricao);

  if (!hasMain && secondary.length === 0) {
    companyCnaes.classList.add("hidden");
    primaryCnae.textContent = "—";
    secondaryCnaesBox.classList.add("hidden");
    secondaryCnaes.innerHTML = "";
    return;
  }

  companyCnaes.classList.remove("hidden");

  primaryCnae.textContent = hasMain
    ? [main.codigo, main.descricao].filter(Boolean).join(" — ")
    : "Não informado";

  secondaryCnaes.innerHTML = "";

  if (secondary.length > 0) {
    secondaryCnaesBox.classList.remove("hidden");
    secondaryCnaesSummary.textContent =
      "CNAEs secundários (" + secondary.length + ")";

    for (const cnae of secondary) {
      const row = window.document.createElement("div");
      row.className = "cnaeItem";
      row.textContent = [cnae.codigo, cnae.descricao]
        .filter(Boolean)
        .join(" — ");
      secondaryCnaes.appendChild(row);
    }
  } else {
    secondaryCnaesBox.classList.add("hidden");
  }
}

function renderHeader(data) {
  company.classList.remove("hidden");
  companyName.textContent = data.company?.razaoSocial || "CNPJ consultado";
  renderCompanyCnaes(data.company);

  companyMeta.textContent = [
    data.formattedCnpj,
    data.company?.nomeFantasia,
    [data.company?.municipio, data.company?.uf].filter(Boolean).join("/")
  ]
    .filter(Boolean)
    .join(" · ");

  const danger = data.documents.some((item) => item.tone === "danger");
  const captcha = data.documents.some((item) => item.mode === "captcha");
  const automatic = data.documents.filter((item) => item.downloadable).length;

  overall.textContent = danger
    ? "Há ocorrência para revisar"
    : automatic > 0
      ? automatic +
        " automático(s)" +
        (captcha ? " · confirmações pendentes" : "")
      : "Ações manuais pendentes";

  overall.className =
    "badge " + (danger ? "danger" : automatic > 0 ? "success" : "warning");
}

function renderError(message) {
  grid.innerHTML = "";

  const box = window.document.createElement("div");
  box.className = "error";

  const strong = window.document.createElement("strong");
  strong.textContent = "Erro: ";

  box.appendChild(strong);
  box.appendChild(window.document.createTextNode(message));
  grid.appendChild(box);

  overall.textContent = "Erro de consulta";
  overall.className = "badge danger";
  downloadAvailable.disabled = true;
}

function manualDocument(id, title, source, mode, label, officialUrl, message) {
  return {
    id,
    title,
    source,
    mode,
    modeLabel: label,
    status:
      mode === "captcha"
        ? "Confirmação humana necessária"
        : "Ação no portal oficial",
    tone: "warning",
    message,
    officialUrl,
    downloadable: false
  };
}

function classifyTcu(data) {
  const items = Array.isArray(data?.certidoes) ? data.certidoes : [];

  const bad = items.filter((item) => {
    const text = [
      item?.situacao,
      item?.descricao,
      item?.observacao
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return !(
      text.includes("nada consta") ||
      text.includes("não consta") ||
      text.includes("nao consta") ||
      text.includes("regular") ||
      text.includes("negativa")
    );
  });

  return { items, bad };
}

async function consultOnGithubPages(cnpj, uf) {
  const companyRequest = fetchJson(
    "https://brasilapi.com.br/api/cnpj/v1/" + encodeURIComponent(cnpj)
  );

  const tcuRequest = /^\d{14}$/.test(cnpj)
    ? fetchJson(
        "https://certidoes-apf.apps.tcu.gov.br/api/rest/publico/certidoes/" +
          encodeURIComponent(cnpj) +
          "?seEmitirPDF=false"
      )
    : Promise.reject(
        new Error("A API pública do TCU ainda recebe CNPJ numérico.")
      );

  const [companyResult, tcuResult] = await Promise.allSettled([
    companyRequest,
    tcuRequest
  ]);

  const companyData =
    companyResult.status === "fulfilled" ? companyResult.value : null;

  const companyInfo = companyData
    ? {
        razaoSocial: companyData.razao_social || null,
        nomeFantasia: companyData.nome_fantasia || null,
        municipio: companyData.municipio || null,
        uf: companyData.uf || null,
        situacao: companyData.descricao_situacao_cadastral || null,
        cnaePrincipal: {
          codigo: String(companyData.cnae_fiscal || ""),
          descricao: companyData.cnae_fiscal_descricao || ""
        },
        cnaesSecundarios: Array.isArray(companyData.cnaes_secundarios)
          ? companyData.cnaes_secundarios.map((item) => ({
              codigo: String(item?.codigo ?? item?.code ?? ""),
              descricao: item?.descricao || item?.description || ""
            }))
          : []
      }
    : null;

  const documents = [];

  documents.push({
    id: "cnpj",
    title: "Dados cadastrais do CNPJ",
    source: companyData ? "BrasilAPI / Minha Receita" : "Receita Federal",
    mode: companyData ? "automatic" : "manual",
    modeLabel: companyData ? "Consulta automática" : "Portal oficial",
    status:
      companyData?.descricao_situacao_cadastral ||
      "Consulta cadastral indisponível",
    tone:
      String(companyData?.descricao_situacao_cadastral || "").toUpperCase() ===
      "ATIVA"
        ? "success"
        : "warning",
    message: companyData
      ? "Dados cadastrais obtidos automaticamente; o cartão oficial ainda é emitido pela Receita."
      : "Não foi possível consultar os dados cadastrais automaticamente.",
    officialUrl: OFFICIAL.cnpj,
    downloadable: false
  });

  documents.push(
    manualDocument(
      "fgts",
      "Regularidade do FGTS / CRF",
      "CAIXA",
      "captcha",
      "CAPTCHA",
      OFFICIAL.fgts,
      "A emissão pública exige verificação humana."
    ),
    manualDocument(
      "cndt",
      "CNDT Trabalhista",
      "TST",
      "captcha",
      "CAPTCHA",
      OFFICIAL.cndt,
      "A emissão pública exige confirmação humana/CAPTCHA."
    ),
    manualDocument(
      "federal",
      "Regularidade Fiscal Federal",
      "RFB / PGFN",
      "credentials",
      "Credencial necessária",
      OFFICIAL.federal,
      "A integração automática depende de acesso autenticado à API oficial."
    )
  );

  if (uf === "MG") {
    documents.push(
      manualDocument(
        "estadual",
        "Certidão Estadual",
        "SEF/MG",
        "captcha",
        "CAPTCHA",
        OFFICIAL.mg,
        "A emissão pública atual exige confirmação humana."
      )
    );
  } else {
    documents.push({
      id: "estadual",
      title: "Certidão Estadual",
      source: "Fazenda Estadual / " + uf,
      mode: "unavailable",
      modeLabel: "Não integrado",
      status: "UF ainda não integrada",
      tone: "neutral",
      message: "O provider desta UF ainda não foi implementado.",
      downloadable: false
    });
  }

  if (tcuResult.status === "fulfilled") {
    const result = classifyTcu(tcuResult.value);

    documents.push({
      id: "sancoes",
      title: "Consulta Consolidada de Pessoa Jurídica",
      source: "TCU — API pública oficial",
      mode: "automatic",
      modeLabel: "Download automático",
      status: result.bad.length
        ? "Revisar ocorrências"
        : "Consulta concluída",
      tone: result.bad.length ? "danger" : "success",
      message: result.bad.length
        ? result.bad.length + " retorno(s) merecem revisão."
        : result.items.length +
          " retorno(s) processado(s). O PDF pode ser gerado automaticamente.",
      officialUrl: OFFICIAL.tcu,
      downloadable: true,
      clientDownload: "tcu",
      details: result.items
    });
  } else {
    documents.push({
      id: "sancoes",
      title: "Consulta Consolidada de Pessoa Jurídica",
      source: "TCU",
      mode: "automatic",
      modeLabel: "Automático",
      status: "Consulta direta indisponível",
      tone: "warning",
      message:
        "O navegador não conseguiu acessar diretamente a API do TCU. Rode o backend para habilitar esse download.",
      officialUrl: OFFICIAL.tcu,
      downloadable: false
    });
  }

  return {
    ok: true,
    cnpj,
    formattedCnpj: format(cnpj),
    uf,
    company: companyInfo,
    documents,
    capabilities: {
      backend: false,
      automaticDownloads: documents
        .filter((item) => item.downloadable)
        .map((item) => item.id)
    }
  };
}

async function consultOnBackend(cnpj, uf) {
  const data = await fetchJson(
    backendUrl("/api/consulta?cnpj=") +
      encodeURIComponent(cnpj) +
      "&uf=" +
      encodeURIComponent(uf)
  );

  if (!data.ok) {
    throw new Error(data.error || "Falha na consulta");
  }

  return data;
}

async function downloadTcuOnBrowser(cnpj, button) {
  const original = button.textContent;

  try {
    button.disabled = true;
    button.textContent = "Gerando PDF...";

    const data = await fetchJson(
      "https://certidoes-apf.apps.tcu.gov.br/api/rest/publico/certidoes/" +
        encodeURIComponent(cnpj) +
        "?seEmitirPDF=true"
    );

    const base64 =
      data?.certidaoPDF || data?.pdfBase64 || data?.pdf || data?.arquivo;

    if (typeof base64 !== "string" || base64.length === 0) {
      throw new Error("O TCU não retornou o PDF.");
    }

    const normalized = base64.replace(
      /^data:application\/pdf;base64,/i,
      ""
    );

    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");

    anchor.href = url;
    anchor.download = "06-TCU-Consulta-Consolidada-" + cnpj + ".pdf";
    window.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    alert(
      "Não foi possível gerar o PDF diretamente no navegador: " +
        error.message +
        "\n\nRode a versão com backend para evitar limitações de CORS."
    );
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

async function consult() {
  const cnpj = clean(cnpjInput.value);
  const uf = ufInput.value;

  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(cnpj)) {
    alert("Informe um CNPJ válido.");
    return;
  }

  if (!uf) {
    alert("Selecione a UF.");
    return;
  }

  skeleton();
  company.classList.remove("hidden");
  companyName.textContent = "Consultando...";
  companyMeta.textContent = format(cnpj) + " · " + uf;
  overall.textContent = "Consultando fontes";
  overall.className = "badge neutral";
  refresh.disabled = true;
  downloadAvailable.disabled = true;

  try {
    const data = USE_BACKEND
      ? await consultOnBackend(cnpj, uf)
      : await consultOnGithubPages(cnpj, uf);

    lastResult = data;
    renderHeader(data);
    renderDocuments(data);
    refresh.disabled = false;
  } catch (error) {
    lastResult = null;
    renderError(
      error?.message ||
        "Não foi possível concluir a consulta. Tente novamente."
    );
  }
}

downloadAvailable.addEventListener("click", async () => {
  if (!lastResult) return;

  const automatic = lastResult.documents.filter((item) => item.downloadable);

  for (const doc of automatic) {
    if (doc.clientDownload === "tcu") {
      const cardButtons = [
        ...document.querySelectorAll(".card .downloadAction")
      ];
      const button =
        cardButtons.find((item) => item.textContent.includes("Gerar")) ||
        downloadAvailable;
      await downloadTcuOnBrowser(lastResult.cnpj, button);
    } else if (doc.downloadUrl) {
      const anchor = window.document.createElement("a");
      anchor.href = doc.downloadUrl.startsWith("/")
        ? backendUrl(doc.downloadUrl)
        : doc.downloadUrl;
      anchor.download = "";
      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    }
  }
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  consult();
});

refresh.addEventListener("click", consult);

skeleton();
setDownloadState();
