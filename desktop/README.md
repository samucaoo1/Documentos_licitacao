# Desktop MVP — PySide6 + Qt WebEngine

Primeira implementação do fluxo desktop, sem servidor e sem extensão.

## Estado atual

O MVP já possui:

- interface única para CNPJ e UF;
- Chromium/Qt WebEngine embutido;
- processamento sequencial: CGU → CNDT → CNPJ → Federal;
- preenchimento conservador do campo CNPJ;
- detecção de CAPTCHA sem tentar resolvê-lo;
- monitor leve a cada 2,2 segundos;
- interceptação de downloads pelo perfil do Qt WebEngine;
- arquivos organizados em Downloads/Licitacoes/<CNPJ>/;
- exportação da página atual diretamente para PDF;
- perfil persistente do navegador para cookies e sessão.

O Qt WebEngine emite downloadRequested sempre que uma página inicia um
download. O aplicativo define o diretório e o nome do arquivo e então aceita
a solicitação.

## Executar no checkout

Linux:

    cd desktop
    python -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
    PYTHONPATH=src python -m documentos_licitacao

Windows PowerShell:

    cd desktop
    py -m venv .venv
    .\.venv\Scripts\Activate.ps1
    pip install -r requirements.txt
    $env:PYTHONPATH="src"
    python -m documentos_licitacao

## Testes

    cd desktop
    pip install pytest
    PYTHONPATH=src pytest

## Compilar com Nuitka

Windows:

    cd desktop
    .\build_windows.ps1

Linux:

    cd desktop
    chmod +x build_linux.sh
    ./build_linux.sh

O primeiro build é standalone, não onefile. Qt WebEngine distribui processos,
recursos e bibliotecas próprias; validar primeiro a pasta standalone torna a
depuração dos portais muito mais simples.

## Filosofia do fluxo

Cada portal é aberto sozinho. O app pode preencher o CNPJ e observar o
resultado, mas não fica clicando continuamente em controles do órgão.

Quando há CAPTCHA:

1. o estado muda para intervenção necessária;
2. você resolve o CAPTCHA dentro do navegador embutido;
3. usa o botão oficial do órgão;
4. o aplicativo detecta o resultado ou o download;
5. a próxima certidão é aberta.

## Providers iniciais

- CGU — Certidão Negativa Correcional;
- CNDT — TST;
- Comprovante CNPJ — Receita Federal;
- Regularidade Fiscal Federal — RFB/PGFN.

A próxima etapa é calibrar os seletores com o DOM real desses quatro portais e,
depois, acrescentar FGTS/CAIXA e certidão estadual de Minas Gerais.
