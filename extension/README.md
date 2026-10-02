# Extensão WebExtension

Extensão complementar da Central de Habilitação.

## Objetivo

Permitir que o GitHub Pages faça operações que um site comum não pode fazer por restrições de CORS e de segurança entre domínios, sem usar um servidor intermediário.

## Estado atual

- ponte segura entre o GitHub Pages e a extensão;
- download direto do PDF consolidado do TCU;
- abertura dos portais oficiais;
- armazenamento temporário local do CNPJ;
- tentativa conservadora de preenchimento do campo CNPJ nos portais;
- nenhuma tentativa de resolver ou contornar CAPTCHA.

## Firefox

Abra:

```text
about:debugging#/runtime/this-firefox
```

Escolha **Carregar extensão temporária** e selecione `extension/manifest.json`.

## Chrome / Chromium

Abra:

```text
chrome://extensions
```

Ative **Modo do desenvolvedor**, clique em **Carregar sem compactação** e selecione a pasta `extension/`.

## Observação

A automação de cada portal será refinada com seletores específicos. A extensão apenas preenche campos quando encontra um input claramente identificado como CNPJ; ela não envia formulários automaticamente e não contorna CAPTCHA.
