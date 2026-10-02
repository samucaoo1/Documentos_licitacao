(() => {
  const A = globalThis.LicitacaoAdapter;
  const kind = "cgu";
  let supplier = null;
  let downloaded = false;

  async function prepare() {
    supplier = await A.init(kind);
    if (!supplier) return;

    A.selectText(["ente privado", "entes privados"]) ||
      A.clickText(["ente privado", "entes privados"]);

    A.selectText([
      "certidão negativa correcional",
      "negativa correcional"
    ]) ||
      A.clickText([
        "certidão negativa correcional",
        "negativa correcional"
      ]);

    const input = A.findInput([
      'input[name*="cnpj" i]',
      'input[id*="cnpj" i]',
      'input[placeholder*="cnpj" i]'
    ]);

    if (input && !input.value) {
      A.setInput(input, A.formatCnpj(supplier.cnpj));
    }

    await A.status(
      kind,
      "working",
      "CNPJ preparado. Use o botão oficial Consultar; se houver CAPTCHA, resolva-o normalmente."
    );

    A.watch(scan);
  }

  async function scan() {
    if (!supplier || downloaded) return;

    const pdf = A.findPdfLink();

    if (pdf) {
      downloaded = true;
      await A.status(
        kind,
        "downloading",
        "PDF localizado; iniciando download."
      );
      await A.download(
        kind,
        pdf.href,
        "01-CGU-Correcional-" + supplier.cnpj + ".pdf"
      );
      return;
    }

    const captcha = A.captcha();

    if (captcha.present && !captcha.solved) {
      A.banner(
        "CGU: resolva o CAPTCHA e clique em Consultar no próprio portal.",
        "warning"
      );
      await A.status(
        kind,
        "needs_human",
        "Resolva o CAPTCHA da CGU e clique em Consultar."
      );
      return;
    }

    if (
      A.bodyHas(
        "resultado da consulta",
        "certidão negativa emitida",
        "certidão gerada"
      )
    ) {
      A.banner(
        "CGU: resultado pronto. Use o botão de download/impressão do portal; a extensão acompanhará o arquivo.",
        "success"
      );
      await A.status(
        kind,
        "result_ready",
        "Resultado pronto. Baixe pelo botão oficial da CGU."
      );
      return;
    }

    await A.status(
      kind,
      "working",
      "Portal preparado; aguardando sua consulta."
    );
  }

  prepare();
})();
