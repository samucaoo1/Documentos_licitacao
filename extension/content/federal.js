(() => {
  const A = globalThis.LicitacaoAdapter;
  const kind = "federal";
  let supplier = null;
  let submitted = false;
  let downloaded = false;

  async function prepare() {
    supplier = await A.init(kind);
    if (!supplier) return;

    await A.status(kind, "working", "Preparando certidão federal.");
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

    if (
      A.bodyHas(
        "certidão negativa de débitos",
        "certidão positiva com efeitos de negativa",
        "segunda via",
        "certidão emitida"
      )
    ) {
      if (A.clickText(["baixar", "2ª via", "segunda via", "emitir"])) {
        await A.status(
          kind,
          "result_ready",
          "Certidão federal localizada; abrindo documento."
        );
      }
      return;
    }

    const captcha = A.captcha();

    if (captcha.present && !captcha.solved) {
      A.banner(
        "Certidão Federal: resolva a confirmação humana para continuar.",
        "warning"
      );
      await A.status(
        kind,
        "needs_human",
        "Resolva a confirmação humana da Receita/PGFN."
      );
      return;
    }

    if (input?.value && !submitted && (!captcha.present || captcha.solved)) {
      submitted = A.clickText([
        "emitir certidão",
        "emitir",
        "consultar"
      ]);

      if (submitted) {
        await A.status(kind, "working", "Emitindo certidão federal…");
      }
    }
  }

  prepare();
})();
