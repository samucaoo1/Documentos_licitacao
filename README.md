# Documentos de Licitação

Extensão de navegador para facilitar a emissão e o download de documentos de habilitação de licitantes.

## Objetivo

Informar o CNPJ uma única vez e deixar a extensão cuidar da navegação repetitiva nos portais oficiais.

Fluxo:

```text
CNPJ + UF
   │
   ├── CGU
   ├── CNDT / TST
   ├── Comprovante CNPJ / Receita
   └── CND Federal / RFB-PGFN
        │
        ├── sem CAPTCHA → extensão continua
        └── com CAPTCHA → você resolve e a extensão retoma
```

Não há servidor intermediário. Os portais são acessados diretamente pelo navegador do usuário.

## Estado atual — 0.5.0

O painel local da extensão:

- abre os quatro portais oficiais;
- mantém um checklist por certidão;
- preenche o CNPJ quando identifica o campo;
- identifica CAPTCHA ou confirmação humana;
- continua a acompanhar a página depois da intervenção;
- baixa PDFs quando encontra um endereço de arquivo;
- acompanha downloads iniciados pelo próprio portal;
- no Firefox, pode salvar páginas de comprovante como PDF usando a API do navegador.

### Portais iniciais

- CGU — Certidão Negativa Correcional;
- TST — CNDT;
- Receita Federal — Comprovante de Inscrição e Situação Cadastral no CNPJ;
- Receita Federal / PGFN — Certidão de Regularidade Fiscal Federal.

## Instalação temporária no Firefox

Clone ou baixe este repositório.

Abra:

```text
about:debugging#/runtime/this-firefox
```

Clique em **Carregar extensão temporária** e selecione:

```text
extension/manifest.json
```

Depois clique no ícone **Documentos de Licitação** e em **Abrir painel**.

## Chrome / Chromium

Abra:

```text
chrome://extensions
```

Ative **Modo do desenvolvedor** → **Carregar sem compactação** → escolha a pasta:

```text
extension/
```

O manifesto usa a configuração Manifest V3 compatível com Firefox e Chromium modernos.

## Uso

1. Abra o painel da extensão.
2. Informe CNPJ e UF.
3. Clique em **Emitir documentação**.
4. As abas dos órgãos são abertas em segundo plano.
5. O painel informa quais documentos estão sendo processados.
6. Quando aparecer **Precisa de você**, clique em **Resolver agora**.
7. Resolva apenas o CAPTCHA/validação do órgão.
8. A extensão continua acompanhando a emissão e registra o download.

Downloads controlados diretamente pela extensão são organizados, quando possível, em:

```text
Downloads/
└── Licitacoes/
    └── <CNPJ>/
        ├── 01-CGU-Correcional-<CNPJ>.pdf
        ├── 02-CNDT-<CNPJ>.pdf
        ├── 03-CNPJ-<CNPJ>.pdf
        └── 04-CND-Federal-<CNPJ>.pdf
```

Downloads disparados internamente pelo portal podem manter o nome definido pelo próprio órgão.

## Segurança e limites

A extensão **não resolve nem contorna CAPTCHA**.

Ela somente:

- preenche dados repetitivos;
- seleciona opções conhecidas;
- percebe quando a confirmação humana é necessária;
- retoma depois da confirmação;
- localiza e baixa documentos quando o portal os disponibiliza.

Nenhuma senha gov.br, certificado digital ou credencial é armazenada.

## Estrutura

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

Cada portal possui um adaptador separado para facilitar manutenção quando o órgão alterar sua página.

## Próximos adaptadores

- CRF / FGTS — CAIXA;
- certidão estadual, começando por Minas Gerais;
- outros documentos exigidos conforme o edital.

## Desenvolvimento

Requer Node.js 20+ somente para os testes do repositório. A extensão em si não precisa de Node.js para funcionar.

```bash
npm test
```
