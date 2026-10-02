const api = globalThis.browser ?? globalThis.chrome;

const form = document.querySelector("#supplierForm");
const cnpjInput = document.querySelector("#cnpj");
const ufInput = document.querySelector("#uf");
const documentsEl = document.querySelector("#documents");
const template = document.querySelector("#documentCard");
const activeSupplier = document.querySelector("#activeSupplier");
const supplierCnpj = document.querySelector("#supplierCnpj");
const summaryText = document.querySelector("#summaryText");
const resetButton = document.querySelector("#resetButton");
const downloadsButton = document.querySelector("#downloadsButton");

const META = {
  cgu: { icon: "CG", source: "Controladoria-Geral da União" },
  cndt: { icon: "JT", source: "Tribunal Superior do Trabalho" },
  cnpj: { icon: "RF", source: "Receita Federal — CNPJ" },
  federal: { icon: "FN", source: "Receita Federal / PGFN" }
};

function cleanCnpj(value = "") {
  return String(value).replace(/\D/g, "").slice(0, 14);
}

function formatCnpj(value = "") {
  const c = cleanCnpj(value);

  if (c.length <= 2) return c;
  if (c.length <= 5) return c.slice(0, 2) + "." + c.slice(2);
  if (c.length <= 8) return c.slice(0, 2) + "." + c.slice(2, 5) + "." + c.slice(5);
  if (c.length <= 12) return c.slice(0, 2) + "." + c.slice(2, 5) + "." + c.slice(5, 8) + "/" + c.slice(8);

  return c.slice(0, 2) + "." + c.slice(2, 5) + "." + c.slice(5, 8) + "/" + c.slice(8, 12) + "-" + c.slice(12);
}

function statusLabel(status) {
  return {
    queued: "Na fila",
    idle: "Aguardando",
    opening: "Abrindo portal",
    working: "Automatizando",
    needs_human: "Precisa de você",
    result_ready: "Documento pronto",
    downloading: "Baixando",
    downloaded: "Baixado",
    error: "Erro"
  }[status] || status;
}

async function getState() {
  const response = await api.runtime.sendMessage({ type: "GET_STATE" });
  return response?.state || null;
}

async function render() {
  const state = await getState();
  if (!state) return;

  if (state.supplier) {
    activeSupplier.classList.remove("hidden");
    supplierCnpj.textContent = formatCnpj(state.supplier.cnpj) + (state.supplier.uf ? " · " + state.supplier.uf : "");
  } else {
    activeSupplier.classList.add("hidden");
  }

  const docs = Object.values(state.documents || {});
  const done = docs.filter((doc) => doc.status === "downloaded").length;
  const human = docs.filter((doc) => doc.status === "needs_human").length;

  summaryText.textContent = state.supplier
    ? done + "/" + docs.length + " baixados" + (human ? " · " + human + " aguardando CAPTCHA" : "")
    : "Aguardando";

  documentsEl.innerHTML = "";

  for (const doc of docs) {
    const node = template.content.cloneNode(true);
    const meta = META[doc.id] || { icon: "DOC", source: "Portal oficial" };
    const badge = node.querySelector(".statusBadge");
    const focus = node.querySelector(".focusButton");
    const openDownload = node.querySelector(".downloadButton");

    node.querySelector(".icon").textContent = meta.icon;
    node.querySelector(".title").textContent = doc.label;
    node.querySelector(".source").textContent = meta.source;
    badge.textContent = statusLabel(doc.status);
    badge.className = "statusBadge " + doc.status;
    node.querySelector(".message").textContent = doc.message || "";

    focus.textContent =
      doc.status === "needs_human"
        ? "Resolver agora"
        : doc.status === "queued"
          ? "Iniciar agora"
          : doc.status === "result_ready"
            ? "Abrir documento"
            : "Abrir portal";

    if (doc.status === "needs_human") {
      focus.classList.add("attention");
    }

    focus.addEventListener("click", async () => {
      await api.runtime.sendMessage({
        type: "FOCUS_DOCUMENT",
        kind: doc.id
      });
    });

    if (doc.id === "cnpj" && doc.status === "result_ready") {
      openDownload.classList.remove("hidden");
      openDownload.textContent = "Salvar PDF";
      openDownload.addEventListener("click", async () => {
        const response = await api.runtime.sendMessage({
          type: "SAVE_DOCUMENT_PDF",
          kind: "cnpj"
        });

        if (!response?.ok) {
          alert(
            response?.error ||
              "Este navegador não oferece salvamento direto. Use Imprimir > Salvar como PDF."
          );
        }
      });
    } else if (doc.downloadId) {
      openDownload.classList.remove("hidden");
      openDownload.textContent = "Abrir arquivo";
      openDownload.addEventListener("click", async () => {
        try {
          await api.downloads.open(doc.downloadId);
        } catch {
          await api.downloads.showDefaultFolder();
        }
      });
    }

    documentsEl.appendChild(node);
  }
}

cnpjInput.addEventListener("input", () => {
  cnpjInput.value = formatCnpj(cnpjInput.value);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const cnpj = cleanCnpj(cnpjInput.value);

  if (!/^\d{14}$/.test(cnpj)) {
    alert("Informe um CNPJ com 14 dígitos.");
    return;
  }

  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  button.textContent = "Abrindo CGU…";

  try {
    const response = await api.runtime.sendMessage({
      type: "START_WORKFLOW",
      cnpj,
      uf: ufInput.value
    });

    if (!response?.ok) {
      throw new Error(response?.error || "Não foi possível iniciar.");
    }

    await render();
  } catch (error) {
    alert(error?.message || "Falha ao iniciar emissão.");
  } finally {
    button.disabled = false;
    button.textContent = "Emitir documentação";
  }
});

resetButton.addEventListener("click", async () => {
  await api.runtime.sendMessage({ type: "RESET" });
  await render();
});

downloadsButton.addEventListener("click", () => {
  api.downloads.showDefaultFolder();
});

api.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.workflowState) {
    render();
  }
});

render();
