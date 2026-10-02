const api = globalThis.browser ?? globalThis.chrome;

function formatCnpj(value = "") {
  const cnpj = String(value).replace(/\D/g, "").slice(0, 14);

  if (cnpj.length !== 14) return cnpj;

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

function candidateInputs() {
  return [
    'input[name="cnpj"]',
    'input[id="cnpj"]',
    'input[name*="cnpj" i]',
    'input[id*="cnpj" i]',
    'input[name*="cpfcnpj" i]',
    'input[id*="cpfcnpj" i]',
    'input[placeholder*="cnpj" i]'
  ];
}

function setNativeValue(input, value) {
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  );

  if (descriptor?.set) {
    descriptor.set.call(input, value);
  } else {
    input.value = value;
  }

  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

async function fill() {
  const stored = await api.storage.local.get("pendingCertificate");
  const pending = stored?.pendingCertificate;

  if (!pending?.cnpj) return;

  if (
    typeof pending.createdAt === "number" &&
    Date.now() - pending.createdAt > 15 * 60 * 1000
  ) {
    await api.storage.local.remove("pendingCertificate");
    return;
  }

  const value = formatCnpj(pending.cnpj);
  let input = null;

  for (const selector of candidateInputs()) {
    input = document.querySelector(selector);
    if (input) break;
  }

  if (!input) return;

  setNativeValue(input, value);
  input.focus();

  const notice = document.createElement("div");
  notice.textContent =
    "CNPJ preenchido pela extensão Documentos de Licitação. " +
    "Revise os dados e conclua a verificação exigida pelo órgão.";
  notice.style.cssText =
    "position:fixed;right:16px;bottom:16px;z-index:2147483647;" +
    "max-width:360px;padding:12px 14px;border-radius:10px;" +
    "background:#17212b;color:white;font:13px system-ui;" +
    "box-shadow:0 8px 30px rgba(0,0,0,.25)";

  document.documentElement.appendChild(notice);
  setTimeout(() => notice.remove(), 7000);
}

fill();
