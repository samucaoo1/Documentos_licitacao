export const OFFICIAL_URLS = {
  cnpj:
    "https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/Cnpjreva_Solicitacao.asp",
  fgts:
    "https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf",
  cndt: "https://www.tst.jus.br/certidao1",
  federal:
    "https://solucoes.receita.fazenda.gov.br/Servicos/certidaointernet/PJ/Emitir",
  mg: "https://www.fazenda.mg.gov.br/empresas/certidao_debitos/",
  tcu: "https://certidoes-apf.apps.tcu.gov.br/"
};

export function captchaDocument(id, title, source, officialUrl, message) {
  return {
    id,
    title,
    source,
    mode: "captcha",
    modeLabel: "CAPTCHA",
    status: "Confirmação humana necessária",
    tone: "warning",
    message,
    officialUrl,
    downloadable: false
  };
}

export function configuredApiDocument(
  id,
  title,
  source,
  officialUrl,
  message
) {
  return {
    id,
    title,
    source,
    mode: "credentials",
    modeLabel: "Credencial necessária",
    status: "API oficial não configurada",
    tone: "warning",
    message,
    officialUrl,
    downloadable: false
  };
}

export function unavailableStateDocument(uf) {
  return {
    id: "estadual",
    title: "Certidão Estadual",
    source: "Fazenda Estadual / " + uf,
    mode: "unavailable",
    modeLabel: "Não integrado",
    status: "UF ainda não integrada",
    tone: "neutral",
    message: "O provider desta UF ainda não foi implementado.",
    downloadable: false
  };
}
