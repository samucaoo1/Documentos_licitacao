(() => {
  const A = globalThis.LicitacaoAdapter;
  const kind = "cndt";
  let supplier = null;
  let submitted = false;
  let downloaded = false;

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
      "CNDT: CNPJ preenchido. Digite o CAPTCHA; a extensão acompanhará a emissão.",
      "warning"
    );

    await A.status(
      kind,
      "needs_human",
      "Digite os caracteres do CAPTCHA da CNDT."
    );

    A.watch(scan);
  }

  function captchaInput() {
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

    const captcha = captchaInput();

    const captchaLength = captcha?.value?.trim().length || 0;
    const expectedLength =
      captcha?.maxLength && captcha.maxLength > 0 && captcha.maxLength < 10
        ? captcha.maxLength
        : 4;

    if (
      captcha &&
      captchaLength >= expectedLength &&
      !submitted
    ) {
      submitted = A.clickText([
        "emitir certidão",
        "emitir",
        "consultar"
      ]);

      if (submitted) {
        await A.status(kind, "working", "Emitindo CNDT…");
      }
      return;
    }

    if (submitted && A.bodyHas("aguarde a emissão", "certidão emitida")) {
      await A.status(
        kind,
        "working",
        "Aguardando o documento gerado pelo TST."
      );
    }
  }

  prepare();
})();
