(() => {
  const A = globalThis.LicitacaoAdapter;
  const kind = "cgu";
  let supplier = null;
  let consulted = false;
  let downloaded = false;

  async function prepare() {
    supplier = await A.init(kind);
    if (!supplier) return;

    A.selectText(["ente privado", "entes privados"]);
    A.selectText([
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
      "CNPJ preenchido. Verificando confirmação humana."
    );

    A.watch(scan);
  }

  async function scan() {
    if (!supplier || downloaded) return;

    const pdf = A.findPdfLink();

    if (pdf) {
      downloaded = true;
      await A.status(kind, "downloading", "Certidão localizada; iniciando download.");
      await A.download(
        kind,
        pdf.href,
        "01-CGU-Correcional-" + supplier.cnpj + ".pdf"
      );
      return;
    }

    if (
      A.bodyHas(
        "certidão negativa emitida",
        "resultado da consulta",
        "certidão negativa correcional"
      ) &&
      A.clickText(["certidão", "baixar", "imprimir"])
    ) {
      await A.status(
        kind,
        "result_ready",
        "Resultado localizado; abrindo a certidão."
      );
      return;
    }

    const captcha = A.captcha();

    if (captcha.present && !captcha.solved) {
      A.banner(
        "CGU: resolva o CAPTCHA. Depois a extensão continua a acompanhar a emissão.",
        "warning"
      );
      await A.status(
        kind,
        "needs_human",
        "Resolva o CAPTCHA da CGU e conclua a consulta."
      );
      return;
    }

    if (captcha.present && captcha.solved && !consulted) {
      consulted = A.clickText(["consultar"]);
      if (consulted) {
        await A.status(kind, "working", "CAPTCHA resolvido; consultando CGU…");
      }
    }
  }

  prepare();
})();
