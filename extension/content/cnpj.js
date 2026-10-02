(() => {
  const A = globalThis.LicitacaoAdapter;
  const kind = "cnpj";
  let supplier = null;
  let submitted = false;
  let saveAsked = false;

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
      "CNPJ preenchido. Verificando hCaptcha."
    );

    A.watch(scan);
  }

  async function scan() {
    if (!supplier) return;

    if (
      A.bodyHas(
        "comprovante de inscrição e de situação cadastral",
        "número de inscrição",
        "data de abertura"
      )
    ) {
      if (!saveAsked) {
        saveAsked = true;
        A.banner(
          "Comprovante CNPJ pronto. A extensão abrirá o salvamento em PDF.",
          "success"
        );
        await A.status(
          kind,
          "result_ready",
          "Comprovante emitido; salvando em PDF."
        );
        const result = await A.savePageAsPdf(kind);

        if (!result?.ok && result?.unsupported) {
          A.banner(
            "Comprovante pronto. Use Imprimir > Salvar como PDF neste navegador.",
            "warning"
          );
          await A.status(
            kind,
            "needs_human",
            "Comprovante pronto. Use Imprimir > Salvar como PDF."
          );
        }
      }
      return;
    }

    const captcha = A.captcha();

    if (captcha.present && !captcha.solved) {
      A.banner(
        "Receita CNPJ: resolva o hCaptcha. A extensão enviará a consulta depois.",
        "warning"
      );
      await A.status(
        kind,
        "needs_human",
        "Resolva o hCaptcha da Receita Federal."
      );
      return;
    }

    if (captcha.present && captcha.solved && !submitted) {
      submitted = A.clickText(["consultar"]);
      if (submitted) {
        await A.status(kind, "working", "Consultando CNPJ na Receita…");
      }
    }
  }

  prepare();
})();
