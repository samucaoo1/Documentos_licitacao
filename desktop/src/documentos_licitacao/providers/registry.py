from .base import Provider

PROVIDERS = (
    Provider(
        id="cgu",
        title="CGU — Certidão Negativa Correcional",
        url="https://certidoes.cgu.gov.br/consulta-certidao",
        prefix="01",
        input_selectors=(
            'input[name*="cnpj" i]',
            'input[id*="cnpj" i]',
            'input[placeholder*="cnpj" i]',
        ),
        result_phrases=("resultado",),
    ),
    Provider(
        id="cndt",
        title="CNDT — Débitos Trabalhistas",
        url="https://cndt-certidao.tst.jus.br/gerarCertidao",
        prefix="02",
        input_selectors=(
            'input[name*="cpfCnpj" i]',
            'input[id*="cpfCnpj" i]',
            'input[name*="cnpj" i]',
        ),
        result_phrases=("certidão", "trabalhista"),
    ),
    Provider(
        id="cnpj",
        title="Receita — Comprovante CNPJ",
        url="https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/",
        prefix="03",
        input_selectors=(
            'input[name="cnpj"]',
            'input[id="cnpj"]',
            'input[name*="cnpj" i]',
        ),
        result_phrases=("número de inscrição", "data de abertura"),
        printable_result=True,
    ),
    Provider(
        id="federal",
        title="RFB/PGFN — Regularidade Fiscal Federal",
        url="https://servicos.receitafederal.gov.br/servico/certidoes/#/home/cnpj",
        prefix="04",
        input_selectors=(
            'input[name*="cnpj" i]',
            'input[id*="cnpj" i]',
            'input[placeholder*="cnpj" i]',
        ),
        result_phrases=("certidão",),
    ),
)


def by_id(provider_id: str) -> Provider:
    return next(provider for provider in PROVIDERS if provider.id == provider_id)
