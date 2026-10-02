# Documentos de Licitação

Ferramenta para facilitar a emissão e o download de documentos de habilitação
de licitantes.

## Nova implementação desktop

A branch \`desktop-pyside6\` inicia a migração para um aplicativo desktop em
Python + PySide6 + Qt WebEngine.

Objetivo do fluxo:

    CNPJ + UF
       |
       v
    navegador embutido
       |
       +-- CGU
       +-- CNDT
       +-- Comprovante CNPJ
       +-- CND Federal
       |
       v
    Downloads/Licitacoes/<CNPJ>/

O processamento é sequencial, um portal por vez. O aplicativo preenche o CNPJ,
detecta quando existe CAPTCHA e deixa a intervenção humana acontecer no próprio
navegador incorporado. Depois acompanha o resultado e intercepta o download.

A extensão WebExtension existente continua no repositório durante a transição,
mas não é a arquitetura alvo desta branch.

## Executar o MVP

Veja [desktop/README.md](desktop/README.md).

Resumo no Linux:

    cd desktop
    python -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
    PYTHONPATH=src python -m documentos_licitacao

No Windows PowerShell:

    cd desktop
    py -m venv .venv
    .\.venv\Scripts\Activate.ps1
    pip install -r requirements.txt
    $env:PYTHONPATH="src"
    python -m documentos_licitacao

## Compilação

O projeto usa Nuitka em modo standalone na primeira fase. Scripts de build estão
em:

- \`desktop/build_windows.ps1\`
- \`desktop/build_linux.sh\`

O modo onefile fica para depois da validação do Qt WebEngine e dos quatro
portais reais.

## Segurança

CAPTCHA não é resolvido nem contornado pelo aplicativo.

A automação é limitada a tarefas repetitivas e previsíveis, como preencher CNPJ,
acompanhar a página, organizar downloads e exportar o comprovante em PDF.
