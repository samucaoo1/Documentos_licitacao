# Documentos de Licitação

Central web para consulta e **download** de documentos de habilitação de fornecedores em licitações.

## Objetivo

Informar o CNPJ uma vez e automatizar o máximo possível da coleta documental.

A aplicação distingue quatro tipos de integração:

- **Automático** — consulta e/ou PDF obtidos sem intervenção humana.
- **CAPTCHA** — o órgão exige confirmação humana.
- **Credencial necessária** — existe integração oficial autenticada, mas o acesso precisa ser configurado.
- **Não integrado** — provider ainda não implementado.

O projeto não tenta contornar CAPTCHA ou outros mecanismos anti-automação.

## Estado atual

### Automático

- consulta cadastral de CNPJ por dados públicos;
- Consulta Consolidada de Pessoa Jurídica do TCU;
- geração e download do PDF consolidado do TCU pelo backend.

### Assistido

- **CAIXA / FGTS** — o fluxo público exige confirmação humana;
- **TST / CNDT** — o fluxo público exige CAPTCHA;
- **SEF/MG** — o fluxo público atual exige confirmação humana;
- **RFB/PGFN** — a integração automática depende de acesso autenticado à API oficial.

## Arquitetura

```text
GitHub Pages
  └── frontend
       │
       ▼
Backend Node.js
  ├── /api/consulta
  ├── /api/documents/tcu.pdf
  └── providers/
      ├── company.js
      ├── tcu.js
      └── documents.js
```

Os providers isolam cada fonte externa. Se um órgão alterar sua API ou portal, o ajuste fica concentrado no provider correspondente.

## Executar localmente

Requer Node.js 20 ou superior.

```bash
npm start
```

Abra:

```text
http://127.0.0.1:8080
```

Para desenvolvimento:

```bash
npm run dev
```

Testes:

```bash
npm test
```

## GitHub Pages + backend

O GitHub Pages não executa Node.js. Por isso o frontend pode ser publicado no Pages e apontar para um backend hospedado separadamente.

O arquivo `config.js` possui:

```js
window.APP_CONFIG = {
  API_BASE_URL: ""
};
```

Depois de publicar o backend, coloque sua URL:

```js
window.APP_CONFIG = {
  API_BASE_URL: "https://SEU-BACKEND.onrender.com"
};
```

Com isso, o site do GitHub Pages passa a usar:

```text
GET /api/consulta
GET /api/documents/tcu.pdf
GET /api/health
```

Se `API_BASE_URL` ficar vazio, o Pages entra em modo estático e tenta apenas as consultas compatíveis diretamente pelo navegador.

## Deploy no Render

O repositório contém `render.yaml`.

No Render:

1. crie um **Blueprint** apontando para este repositório;
2. deixe o Render ler o `render.yaml`;
3. aguarde o deploy;
4. copie a URL pública do serviço;
5. coloque essa URL em `config.js`;
6. faça commit/push.

O backend já permite requisições do domínio `https://samucaoo1.github.io` por CORS.

## API Federal

O backend reserva as variáveis:

```text
FEDERAL_CND_API_URL
FEDERAL_CND_TOKEN
```

Elas são pontos de configuração para o futuro provider autenticado da CND federal. O contrato real deve seguir as credenciais/documentação concedidas ao integrador.

**Nunca commite credenciais reais.**

## Próximos passos

- provider autenticado da CND federal;
- automação assistida por navegador para FGTS, CNDT e SEF/MG, parando no CAPTCHA;
- armazenamento temporário seguro dos PDFs;
- geração de pacote ZIP;
- controle de validade e vencimento;
- novos providers estaduais.
