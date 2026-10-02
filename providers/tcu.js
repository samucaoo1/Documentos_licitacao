const TCU_API =
  "https://certidoes-apf.apps.tcu.gov.br/api/rest/publico/certidoes/";

export async function fetchTcu(cnpj, { pdf = false, timeoutMs = 15000 } = {}) {
  if (!/^\d{14}$/.test(cnpj)) {
    const error = new Error("A API pública documentada do TCU recebe CNPJ numérico.");
    error.code = "TCU_CNPJ_FORMAT";
    throw error;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      TCU_API +
        encodeURIComponent(cnpj) +
        "?seEmitirPDF=" +
        String(Boolean(pdf)),
      {
        signal: controller.signal,
        headers: {
          accept: "application/json",
          "user-agent": "DocumentosLicitacao/0.3"
        }
      }
    );

    const text = await response.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("O TCU retornou conteúdo inválido.");
    }

    if (!response.ok) {
      throw new Error(data?.message || "TCU: HTTP " + response.status);
    }

    return data;
  } finally {
    clearTimeout(timer);
  }
}

export function classifyTcu(data) {
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

  return { count: items.length, bad, items };
}

export function extractTcuPdf(data) {
  const base64 =
    data?.certidaoPDF ||
    data?.pdfBase64 ||
    data?.pdf ||
    data?.arquivo ||
    null;

  if (typeof base64 !== "string" || base64.length === 0) {
    throw new Error("O TCU não retornou o PDF da certidão.");
  }

  const normalized = base64.replace(
    /^data:application\/pdf;base64,/i,
    ""
  );

  return Buffer.from(normalized, "base64");
}
