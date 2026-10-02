(() => {
  const A = globalThis.LicitacaoAdapter;
  const kind = "cnpj";
  let supplier = null;

  async function prepare() {
    supplier = await A.init(kind);
    if (!supplier) return;

    const input = A.findInput([
      'input[name="cnpj"]',
      'input[id="cnpj"]',
      'input[name*="cnpj" i]',
      'input[id*="cnpj" i]'
    ]);

    if (input && !input.value) {
      A.setInput(input, supplier.cnpj);
    }

    await A.status(
      kind,
      "working",
      "CNPJ preenchido. Se houver hCaptcha, resolva-o e clique em Consultar."
    );

    A.watch(scan);
  }

  async function scan() {
    if (!supplier) return;

    const input = A.findInput([
      'input[name="cnpj"]',
      'input[id="cnpj"]',
      'input[name*="cnpj" i]',
      'input[id*="cnpj" i]'
    ]);

    if (input && !input.value) {
      A.setInput(input, supplier.cnpj);
    }

    if (
      A.bodyHas("número de inscrição") &&
      A.bodyHas("data de abertura")
    ) {
      A.banner(
        "Comprovante CNPJ pronto. Volte ao painel e use Salvar PDF.",
        "success"
      );
      await A.status(
        kind,
        "result_ready",
        "Comprovante emitido. Use Salvar PDF no painel."
      );
      return;
    }

    const captcha = A.captcha();

    if (captcha.present && !captcha.solved) {
      A.banner(
        "Receita: resolva o hCaptcha e clique em Consultar no portal.",
        "warning"
      );
      await A.status(
        kind,
        "needs_human",
        "Resolva o hCaptcha e clique em Consultar."
      );
      return;
    }

    await A.status(
      kind,
      "working",
      "Portal preparado; aguardando a consulta."
    );
  }

  prepare();
})();
