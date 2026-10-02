# Extensão — Documentos de Licitação

Esta pasta contém a aplicação principal.

## Fluxo

O painel recebe CNPJ e UF e inicia quatro adaptadores:

| Adaptador | Portal |
| --- | --- |
| `cgu.js` | Certidão Negativa Correcional da CGU |
| `cndt.js` | CNDT do TST |
| `cnpj.js` | Comprovante de Inscrição e Situação Cadastral |
| `federal.js` | Certidão de Regularidade Fiscal RFB/PGFN |

Cada adaptador tenta somente ações repetitivas e previsíveis, como localizar o campo de CNPJ, preencher o valor, selecionar o tipo de certidão e identificar o documento final.

Quando há CAPTCHA, o estado muda para **Precisa de você**. O usuário resolve a confirmação no portal oficial e o adaptador continua observando a página.

## Arquivos

```text
extension/
├── manifest.json
├── background.js
├── popup.html
├── popup.js
├── popup.css
├── dashboard/
│   ├── index.html
│   ├── app.js
│   └── styles.css
└── content/
    ├── common.js
    ├── cgu.js
    ├── cndt.js
    ├── cnpj.js
    └── federal.js
```

## Firefox

```text
about:debugging#/runtime/this-firefox
→ Carregar extensão temporária
→ selecionar manifest.json
```

O Firefox possui `tabs.saveAsPDF()`, então o adaptador do comprovante CNPJ pode abrir o salvamento em PDF depois da emissão.

## Chromium

```text
chrome://extensions
→ Modo do desenvolvedor
→ Carregar sem compactação
→ selecionar a pasta extension/
```

Quando o navegador não oferece salvamento direto de página como PDF, a extensão pede o uso de **Imprimir → Salvar como PDF** apenas naquele documento.

## Regra de segurança

CAPTCHA nunca é resolvido ou contornado pela extensão. O código somente detecta a etapa, aguarda o usuário concluí-la e retoma o fluxo depois.
