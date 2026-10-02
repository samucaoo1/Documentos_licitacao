const api = globalThis.browser ?? globalThis.chrome;

function sendToPage(payload) {
  window.postMessage(
    {
      source: "documentos-licitacao-extension",
      ...payload
    },
    window.location.origin
  );
}

async function callExtension(message) {
  try {
    const response = await api.runtime.sendMessage({
      source: "documentos-licitacao-site",
      ...message
    });

    return response ?? { ok: false, error: "Sem resposta da extensão." };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "Falha ao comunicar com a extensão."
    };
  }
}

window.addEventListener("message", async (event) => {
  if (event.source !== window) return;
  if (event.origin !== window.location.origin) return;

  const message = event.data;

  if (!message || message.source !== "documentos-licitacao-site") {
    return;
  }

  const requestId = message.requestId || null;
  const response = await callExtension(message);

  sendToPage({
    type: "RESPONSE",
    requestId,
    response
  });
});

sendToPage({
  type: "READY",
  version: api.runtime.getManifest().version
});
