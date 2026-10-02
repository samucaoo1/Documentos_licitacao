const api = globalThis.browser ?? globalThis.chrome;

globalThis.LicitacaoAdapter = {
  async init(kind) {
    const response = await api.runtime.sendMessage({
      type: "PORTAL_READY",
      kind
    });

    if (!response?.ok) return null;
    return response.supplier;
  },

  async status(kind, status, message) {
    return api.runtime.sendMessage({
      type: "ADAPTER_STATUS",
      kind,
      status,
      message
    });
  },

  async download(kind, url, filename) {
    return api.runtime.sendMessage({
      type: "DOWNLOAD_URL",
      kind,
      url,
      filename
    });
  },

  async savePageAsPdf(kind) {
    return api.runtime.sendMessage({
      type: "SAVE_PAGE_PDF",
      kind
    });
  },

  setInput(input, value) {
    if (!input) return false;

    const descriptor =
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      ) ||
      Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value"
      );

    if (descriptor?.set) descriptor.set.call(input, value);
    else input.value = value;

    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new Event("blur", { bubbles: true }));
    return true;
  },

  findInput(selectors = []) {
    for (const selector of selectors) {
      const input = document.querySelector(selector);
      if (input) return input;
    }

    const candidates = [
      ...document.querySelectorAll("input:not([type=hidden])")
    ];

    return (
      candidates.find((input) => {
        const text = [
          input.name,
          input.id,
          input.placeholder,
          input.getAttribute("aria-label")
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return text.includes("cnpj") || text.includes("cpf/cnpj");
      }) || null
    );
  },

  formatCnpj(value = "") {
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
  },

  clickText(patterns = []) {
    const normalized = patterns.map((x) => x.toLowerCase());
    const elements = [
      ...document.querySelectorAll(
        "button, input[type=submit], input[type=button], a, [role=button]"
      )
    ];

    const element = elements.find((item) => {
      const text = (
        item.innerText ||
        item.value ||
        item.getAttribute("aria-label") ||
        ""
      )
        .trim()
        .toLowerCase();

      return normalized.some((pattern) => text.includes(pattern));
    });

    if (!element) return false;
    element.click();
    return true;
  },

  selectText(patterns = []) {
    const normalized = patterns.map((x) => x.toLowerCase());

    for (const select of document.querySelectorAll("select")) {
      const option = [...select.options].find((item) => {
        const text = String(item.textContent || "").toLowerCase();
        return normalized.some((pattern) => text.includes(pattern));
      });

      if (!option) continue;

      select.value = option.value;
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }

    return false;
  },

  captcha() {
    const frames = [
      ...document.querySelectorAll(
        'iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[title*="captcha" i]'
      )
    ];

    const token =
      document.querySelector('[name="h-captcha-response"]') ||
      document.querySelector('[name="g-recaptcha-response"]');

    const text = document.body?.innerText?.toLowerCase() || "";

    const present =
      frames.length > 0 ||
      Boolean(token) ||
      text.includes("não sou um robô") ||
      text.includes("sou humano") ||
      text.includes("captcha");

    const solved =
      Boolean(token?.value && token.value.trim().length > 10);

    return { present, solved };
  },

  findPdfLink() {
    const links = [...document.querySelectorAll("a[href]")];

    return (
      links.find((link) => {
        const href = link.href || "";
        const text = (link.innerText || "").toLowerCase();

        return (
          /\.pdf(?:$|[?#])/i.test(href) ||
          text.includes("baixar pdf") ||
          text.includes("certidão") && href.startsWith("http")
        );
      }) || null
    );
  },

  bodyHas(...patterns) {
    const text = document.body?.innerText?.toLowerCase() || "";
    return patterns.some((pattern) =>
      text.includes(String(pattern).toLowerCase())
    );
  },

  banner(message, tone = "info") {
    const old = document.getElementById("__licitacao_helper");
    if (old) old.remove();

    const box = document.createElement("div");
    box.id = "__licitacao_helper";
    box.textContent = message;

    const background =
      tone === "success"
        ? "#16794b"
        : tone === "warning"
          ? "#9a5b00"
          : tone === "danger"
            ? "#b42318"
            : "#17212b";

    box.style.cssText =
      "position:fixed;right:16px;bottom:16px;z-index:2147483647;" +
      "max-width:390px;padding:13px 15px;border-radius:11px;" +
      "background:" +
      background +
      ";color:white;font:13px/1.45 system-ui;" +
      "box-shadow:0 10px 32px rgba(0,0,0,.28)";

    document.documentElement.appendChild(box);
    return box;
  },

  watch(callback, interval = 900) {
    let stopped = false;

    const run = async () => {
      if (stopped) return;
      try {
        await callback();
      } catch {}
    };

    const observer = new MutationObserver(run);
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true
    });

    const timer = setInterval(run, interval);
    run();

    return () => {
      stopped = true;
      observer.disconnect();
      clearInterval(timer);
    };
  }
};
