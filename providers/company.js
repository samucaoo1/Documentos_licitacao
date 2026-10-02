export async function fetchCompany(cnpj, { timeoutMs = 12000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      "https://brasilapi.com.br/api/cnpj/v1/" + encodeURIComponent(cnpj),
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
      throw new Error("A consulta cadastral retornou conteúdo inválido.");
    }

    if (!response.ok) {
      throw new Error(data?.message || "Falha HTTP " + response.status);
    }

    return {
      razaoSocial: data.razao_social || null,
      nomeFantasia: data.nome_fantasia || null,
      municipio: data.municipio || null,
      uf: data.uf || null,
      situacao: data.descricao_situacao_cadastral || null
    };
  } finally {
    clearTimeout(timer);
  }
}
