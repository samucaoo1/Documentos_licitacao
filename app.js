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

const IS_GITHUB_PAGES = location.hostname.endsWith(".github.io");

const OFFICIAL = {
  cnpj: "https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/Cnpjreva_Solicitacao.asp",
  fgts: "https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf",
  cndt: "https://www.tst.jus.br/certidao1",
  federal: "https://solucoes.receita.fazenda.gov.br/Servicos/certidaointernet/PJ/Emitir",
  mg: "https://www.fazenda.mg.gov.br/empresas/certidao_debitos/",
  tcu: "https://certidoes-apf.apps.tcu.gov.br/"
};

const clean = (value) =>
  String(value || "")
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .slice(0, 14);

const format = (value) => {
  const cnpj = clean(value);

  if (cnpj.length <= 2) return cnpj;
  if (cnpj.length <= 5) return cnpj.slice(0, 2) + "." + cnpj.slice(2);
  if (cnpj.length <= 8)
    return cnpj.slice(0, 2) + "." + cnpj.slice(2, 5) + "." + cnpj.slice(5);
  if (cnpj.length <= 12)
    return (
      cnpj.slice(0, 2) +
      "." +
      cnpj.slice(2, 5) +
      "." +
      cnpj.slice(5, 8) +
      "/" +
      cnpj.slice(8)
    );

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
    node.querySelector(".badge").textContent = "Consultando";
    node.querySelector(".message").textContent = "Aguarde...";
    node.querySelector(".action").disabled = true;
    grid.appendChild(node);
  }
}

function renderDocuments(data) {
  grid.innerHTML = "";

  for (const doc of data.documents) {
    const node = template.content.cloneNode(true);
    const badge = node.querySelector(".badge");
    const action = node.querySelector(".action");

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

    if (doc.downloadUrl) {
      action.textContent = "Baixar PDF oficial";
      action.onclick = () => {
        location.href = doc.downloadUrl;
      };
    } else if (doc.officialUrl) {
      action.textContent = "Abrir portal oficial";
      action.onclick = () =>
        window.open(doc.officialUrl, "_blank", "noopener,noreferrer");
    } else {
      action.textContent = "Indisponível";
      action.disabled = true;
    }

    grid.appendChild(node);
  }
}

function renderHeader(data) {
  company.classList.remove("hidden");
  companyName.textContent = data.company?.razaoSocial || "CNPJ consultado";

  companyMeta.textContent = [
    data.formattedCnpj,
    data.company?.nomeFantasia,
    [data.company?.municipio, data.company?.uf].filter(Boolean).join("/")
  ]
    .filter(Boolean)
    .join(" · ");

  const danger = data.documents.some((item) => item.tone === "danger");
  const warning = data.documents.some((item) => item.tone === "warning");

  overall.textContent = danger
    ? "Há ocorrência para revisar"
    : warning
      ? "Consulta parcial · ações manuais pendentes"
      : "Consultas concluídas";

  overall.className =
    "badge " + (danger ? "danger" : warning ? "warning" : "success");
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
    const contentType = response.headers.get("content-type") || "";
    throw new Error(
      "A consulta retornou " +
        (contentType || "conteúdo não JSON") +
        " em vez de JSON (HTTP " +
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

function manualDocument(id, title, source, officialUrl, message) {
  return {
    id,
    title,
    source,
    status: "Ação no portal oficial",
    tone: "warning",
    message,
    officialUrl
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
  /*
   * GitHub Pages é hospedagem estática e não executa server.js.
   * Aqui usamos diretamente apenas APIs públicas que aceitam chamadas do
   * navegador. Quando a fonte bloquear CORS, exigir CAPTCHA ou backend, o
   * usuário recebe o link para o portal oficial.
   */
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
        new Error("A API documentada do TCU ainda recebe CNPJ numérico.")
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
        situacao: companyData.descricao_situacao_cadastral || null
      }
    : null;

  const documents = [];

  if (companyData) {
    const status =
      companyData.descricao_situacao_cadastral || "Consulta concluída";

    documents.push({
      id: "cnpj",
      title: "Dados cadastrais do CNPJ",
      source: "BrasilAPI / Minha Receita",
      status,
      tone: String(status).toUpperCase() === "ATIVA" ? "success" : "warning",
      message:
        "Dados públicos consultados automaticamente. Para habilitação, emita também o comprovante oficial da Receita Federal.",
      officialUrl: OFFICIAL.cnpj
    });
  } else {
    documents.push({
      id: "cnpj",
      title: "Cartão / dados do CNPJ",
      source: "Receita Federal",
      status: "Consulta automática indisponível",
      tone: "warning",
      message:
        "Não foi possível consultar os dados cadastrais automaticamente. Você ainda pode abrir a emissão oficial.",
      officialUrl: OFFICIAL.cnpj
    });
  }

  documents.push(
    manualDocument(
      "fgts",
      "Regularidade do FGTS / CRF",
      "CAIXA",
      OFFICIAL.fgts,
      "A emissão deve ser concluída no portal oficial da CAIXA."
    ),
    manualDocument(
      "cndt",
      "CNDT Trabalhista",
      "TST",
      OFFICIAL.cndt,
      "A emissão oficial exige confirmação humana/CAPTCHA."
    ),
    manualDocument(
      "federal",
      "Regularidade Fiscal Federal",
      "RFB / PGFN",
      OFFICIAL.federal,
      "A emissão pública utiliza confirmação humana; conclua no portal oficial."
    )
  );

  if (uf === "MG") {
    documents.push(
      manualDocument(
        "estadual",
        "Certidão Estadual",
        "SEF/MG",
        OFFICIAL.mg,
        "A CDT de Minas Gerais pode ser emitida no portal oficial da SEF/MG."
      )
    );
  } else {
    documents.push({
      id: "estadual",
      title: "Certidão Estadual",
      source: "Fazenda Estadual / " + uf,
      status: "UF ainda não integrada",
      tone: "neutral",
      message: "O provider desta UF ainda não foi implementado."
    });
  }

  if (tcuResult.status === "fulfilled") {
    const result = classifyTcu(tcuResult.value);

    documents.push({
      id: "sancoes",
      title: "Consulta Consolidada de Pessoa Jurídica",
      source: "TCU — API pública oficial",
      status: result.bad.length
        ? "Revisar ocorrências"
        : "Consulta concluída",
      tone: result.bad.length ? "danger" : "success",
      message: result.bad.length
        ? result.bad.length + " retorno(s) merecem revisão."
        : result.items.length +
          " retorno(s) processado(s) na consulta consolidada.",
      officialUrl: OFFICIAL.tcu,
      details: result.items
    });
  } else {
    documents.push({
      id: "sancoes",
      title: "Consulta Consolidada de Pessoa Jurídica",
      source: "TCU",
      status: "Abrir consulta oficial",
      tone: "warning",
      message:
        "O navegador não conseguiu consultar diretamente a API do TCU. Isso pode ocorrer por política CORS da fonte; use a aplicação oficial.",
      officialUrl: OFFICIAL.tcu
    });
  }

  return {
    ok: true,
    cnpj,
    formattedCnpj: format(cnpj),
    uf,
    company: companyInfo,
    documents,
    consultedAt: new Date().toISOString(),
    mode: "github-pages"
  };
}

async function consultOnBackend(cnpj, uf) {
  const data = await fetchJson(
    "/api/consulta?cnpj=" +
      encodeURIComponent(cnpj) +
      "&uf=" +
      encodeURIComponent(uf)
  );

  if (!data.ok) {
    throw new Error(data.error || "Falha na consulta");
  }

  /*
   * O PDF do TCU precisa passar pelo backend. Em Pages, essa rota não existe.
   */
  for (const document of data.documents || []) {
    if (document.id === "sancoes" && document.downloadable) {
      document.downloadUrl =
        "/api/tcu/pdf?cnpj=" + encodeURIComponent(data.cnpj);
    }
  }

  return data;
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

  try {
    const data = IS_GITHUB_PAGES
      ? await consultOnGithubPages(cnpj, uf)
      : await consultOnBackend(cnpj, uf);

    renderHeader(data);
    renderDocuments(data);
    refresh.disabled = false;
  } catch (error) {
    renderError(
      error?.message ||
        "Não foi possível concluir a consulta. Tente novamente."
    );
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  consult();
});

refresh.addEventListener("click", consult);

skeleton();
