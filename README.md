# Documentos de Licitação

Central web para consulta e download de documentos de habilitação de fornecedores em licitações.

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
- geração e download do PDF da consulta consolidada do TCU.

### Assistido

- CAIXA / FGTS — fluxo público exige confirmação humana;
- TST / CNDT — fluxo público exige CAPTCHA;
- SEF/MG — fluxo público atual exige confirmação humana;
- RFB/PGFN — integração automática depende de acesso autenticado à API oficial.

## Arquitetura

```text
Frontend
├── index.html
├── styles.css
└── app.js

Backend
├── server.js
└── providers/
    ├── company.js
    ├── tcu.js
    └── documents.js
```

Os providers isolam cada fonte externa para que mudanças em um portal não obriguem a reescrever a aplicação inteira.

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

## GitHub Pages

O GitHub Pages só hospeda o frontend estático. A aplicação detecta esse modo automaticamente e tenta usar diretamente as APIs públicas compatíveis com navegador.

Para o funcionamento completo, inclusive downloads que precisam de backend, publique o servidor Node.js em um serviço como Render ou em uma VPS.

## API Federal

O backend reconhece as variáveis:

```text
FEDERAL_CND_API_URL
FEDERAL_CND_TOKEN
```

Elas são apenas pontos de configuração para a futura implementação do provider autenticado da CND federal. O contrato efetivo deve seguir as credenciais e documentação concedidas ao integrador; nenhuma credencial deve ser commitada no repositório.

## Próximos passos

- provider autenticado da CND federal;
- automação assistida por navegador para FGTS, CNDT e SEF/MG, parando no CAPTCHA para ação do usuário;
- armazenamento temporário seguro dos PDFs;
- geração de pacote ZIP;
- controle de validade e vencimento;
- novos providers estaduais.
