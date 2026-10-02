# Documentos de Licitação

Central web para consulta e organização de documentos de habilitação de fornecedores em licitações.

## Estado atual

Versão preliminar funcional em **HTML/CSS/JavaScript + Node.js 20+**, sem dependências externas.

Já possui:

- consulta cadastral de CNPJ por dados públicos;
- consulta consolidada de pessoa jurídica pela API pública do TCU;
- acesso aos portais oficiais de Receita Federal, CAIXA/FGTS, TST/CNDT, RFB/PGFN e SEF/MG;
- suporte estrutural ao CNPJ alfanumérico;
- testes com `node:test`;
- CI no GitHub Actions.

> Alguns documentos exigem CAPTCHA ou autenticação no portal do órgão. O projeto não tenta contornar esses mecanismos; nesses casos ele encaminha o usuário ao portal oficial.

## Executar localmente

Requer Node.js 20 ou superior.

```bash
npm start
```

Depois acesse:

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

## Deploy

O projeto inclui `render.yaml` para facilitar a publicação do backend no Render. GitHub Pages, sozinho, não executa o servidor Node.js.

## Próximos passos

- ampliar providers estaduais;
- integrar APIs oficiais autenticadas quando houver credenciais;
- armazenar PDFs emitidos manualmente;
- gerar pacote ZIP de habilitação;
- acompanhar validade e vencimentos das certidões.
