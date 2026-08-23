---
title: Contrato de API Padronizado
aliases:
  - Envelope de Resposta
  - API Response Contract
tags:
  - api
  - architecture
  - frontend
  - backend
type: practice
status: evergreen
source: Integrated Architecture Guide (PWA + AWS Serverless); RFC 9457 (Problem Details)
author: Heitor Rapcinski; IETF
created: 2026-07-25
---
Definir, em um único documento, o formato exato de requisição e resposta de **todo** endpoint do produto — e tratá-lo como fonte de verdade que backend e frontend implementam sem negociar caso a caso.

O resultado é que o cliente pode escrever um tratador genérico de resposta e de erro, uma vez, em vez de descobrir por tentativa o formato de cada rota.

## Dinâmica / Passo a Passo

1. **Defina o envelope de sucesso.** Toda resposta com corpo devolve o payload dentro de uma chave única — nunca um array na raiz, que impede acrescentar metadado depois sem quebrar o contrato.

   ```json
   // Lista — GET /v1/{recurso}
   { "data": { "items": [ … ], "pagination": { "page": 1, "pageSize": 20, "total": 150, "totalPages": 8 } } }

   // Detalhe / criação / atualização
   { "data": { "id": "uuid", "…": "…" } }

   // Exclusão
   HTTP 204 No Content — sem corpo
   ```

2. **Defina o envelope de erro**, com um código estável e um identificador de correlação:

   ```json
   {
     "error": {
       "code": "RESOURCE_NOT_FOUND",
       "message": "Pedido com id '…' não encontrado.",
       "requestId": "id-da-invocação",
       "timestamp": "2026-01-01T00:00:00Z"
     }
   }
   ```

3. **Fixe os cabeçalhos obrigatórios** nas duas direções, e declare-os no CORS.

   | Direção | Cabeçalho | Origem |
   |---|---|---|
   | → API | `Authorization` | Interceptador do cliente HTTP |
   | → API | `X-Tenant-Id` | Contexto de sessão |
   | → API | `X-Idempotency-Key` | Gerado no serviço, em POST/PUT/PATCH |
   | ← Cliente | `X-Request-Id` | Identificador da invocação no servidor |
   | ← Cliente | `X-Trace-Id` | Trace de observabilidade |

4. **Implemente auxiliares de resposta no backend** (`ok()`, `created()`, `noContent()`, `badRequest()`) e proíba a construção manual do objeto de resposta no handler.
5. **Implemente um mapeador de erro único no frontend**, no interceptador — nenhum componente lê a estrutura crua do erro.
6. **Versione pelo caminho** (`/v1/...`) e registre cada rota nova na tabela funcionalidade ↔ domínio ↔ rota antes de escrever a primeira linha.

## Regras

- **O `requestId` é gerado pelo servidor e lido do corpo**, não do cabeçalho. É o que liga a reclamação do usuário à linha de log
- **`code` é estável e legível por máquina; `message` é para humanos.** O cliente decide o comportamento pelo `code` e a tradução pela chave correspondente — nunca comparando a mensagem
- **Nenhum campo fora do envelope.** Acrescentar um campo na raiz porque "só nesta rota" é o começo do fim do contrato
- **204 não tem corpo.** Devolver `{ "data": null }` com 200 numa exclusão obriga o cliente a tratar dois formatos para a mesma semântica
- Alterar o formato de um campo existente é mudança **incompatível** — exige novo prefixo de versão, não um deploy silencioso

## Exemplo

Uma tela de listagem sabe, sem consultar documentação de rota, que precisa ler `data.items` e `data.pagination`. Um erro 404 chega ao mapeador, vira `{ code: 'RESOURCE_NOT_FOUND', requestId }`, e a interface exibe a tradução de `errors.RESOURCE_NOT_FOUND` com o `requestId` num rodapé copiável. O suporte recebe o identificador e localiza a invocação exata no log.

---
Ref: [[Amazon API Gateway]], [[Idempotência]], [[Versionamento de API]], [[Internationalization (i18n)]], [[Segurança de API]]
