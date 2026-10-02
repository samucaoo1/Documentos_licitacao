(() => {
  const A = globalThis.LicitacaoAdapter;
  const kind = "federal";
  let supplier = null;
  let downloaded = false;

  async function prepare() {
    supplier = await A.init(kind);
    if (!supplier) return;

    await A.status(
      kind,
      "working",
      "Preparando a certidão federal."
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
        "04-CND-Federal-" + supplier.cnpj + ".pdf"
      );
      return;
    }

    const input = A.findInput([
      'input[name*="cnpj" i]',
      'input[id*="cnpj" i]',
      'input[placeholder*="cnpj" i]'
    ]);

    if (input && !input.value) {
      A.setInput(input, supplier.cnpj);
    }

    const captcha = A.captcha();

    if (captcha.present && !captcha.solved) {
      A.banner(
        "Certidão Federal: resolva a confirmação humana e clique em Emitir/Consultar.",
        "warning"
      );
      await A.status(
        kind,
        "needs_human",
        "Resolva a confirmação humana e clique no botão oficial."
      );
      return;
    }

    if (
      A.bodyHas(
        "certidão negativa de débitos",
        "certidão positiva com efeitos de negativa",
        "certidão emitida",
        "segunda via"
      )
    ) {
      A.banner(
        "Certidão Federal: resultado encontrado. Use o botão oficial de emissão/download.",
        "success"
      );
      await A.status(
        kind,
        "result_ready",
        "Resultado pronto; use o botão oficial de emissão/download."
      );
      return;
    }

    await A.status(
      kind,
      "working",
      "CNPJ preparado; aguardando sua ação no portal."
    );
  }

  prepare();
})();
