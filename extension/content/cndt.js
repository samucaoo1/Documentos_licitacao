(() => {
  const A = globalThis.LicitacaoAdapter;
  const kind = "cndt";
  let supplier = null;
  let downloaded = false;

  function findCaptchaInput() {
    const inputs = [
      ...document.querySelectorAll("input:not([type=hidden])")
    ];

    return (
      inputs.find((input) => {
        const text = [
          input.name,
          input.id,
          input.placeholder,
          input.getAttribute("aria-label")
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return (
          text.includes("captcha") ||
          text.includes("caracter") ||
          text.includes("código") ||
          text.includes("codigo")
        );
      }) || null
    );
  }

  async function prepare() {
    supplier = await A.init(kind);
    if (!supplier) return;

    const input = A.findInput([
      'input[name*="cpfCnpj" i]',
      'input[id*="cpfCnpj" i]',
      'input[name*="cnpj" i]',
      'input[id*="cnpj" i]'
    ]);

    if (input && !input.value) {
      A.setInput(input, supplier.cnpj);
    }

    A.banner(
      "CNDT: CNPJ preenchido. Digite o CAPTCHA e clique em Emitir Certidão.",
      "warning"
    );

    await A.status(
      kind,
      "needs_human",
      "Digite o CAPTCHA e clique no botão oficial Emitir Certidão."
    );

    A.watch(scan);
  }

  async function scan() {
    if (!supplier || downloaded) return;

    const pdf = A.findPdfLink();

    if (pdf) {
      downloaded = true;
      await A.download(
        kind,
        pdf.href,
        "02-CNDT-" + supplier.cnpj + ".pdf"
      );
      return;
    }

    if (
      A.bodyHas(
        "certidão emitida",
        "certidão negativa de débitos trabalhistas"
      ) &&
      !findCaptchaInput()
    ) {
      A.banner(
        "CNDT: resultado pronto. Use o botão oficial de download caso o arquivo ainda não tenha iniciado.",
        "success"
      );
      await A.status(
        kind,
        "result_ready",
        "CNDT pronta; aguardando o download oficial."
      );
      return;
    }

    const captcha = findCaptchaInput();

    if (captcha) {
      await A.status(
        kind,
        "needs_human",
        "Digite o CAPTCHA e clique em Emitir Certidão."
      );
    } else {
      await A.status(
        kind,
        "working",
        "Aguardando a resposta do TST."
      );
    }
  }

  prepare();
})();
