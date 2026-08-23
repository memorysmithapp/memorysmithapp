---
title: Observabilidade em Funções Serverless
aliases:
  - Instrumentação de Lambda
  - Lambda Powertools
tags:
  - observability
  - aws
  - serverless
  - operations
type: practice
status: evergreen
source: Powertools for AWS Lambda; Integrated Architecture Guide (PWA + AWS Serverless)
author: Amazon Web Services
created: 2026-07-25
---
Instrumentar toda função com log estruturado, métrica de negócio e trace correlacionados, de modo que qualquer requisição possa ser reconstituída de ponta a ponta a partir de um único identificador.

O resultado é diagnóstico sem acesso à máquina — que não existe.

## Dinâmica / Passo a Passo

1. **Adote uma camada de middleware única** para todas as funções, aplicando logger, tracer e métricas de forma idêntica:

   ```ts
   const logger  = new Logger({ serviceName: '{dominio}' });
   const metrics = new Metrics({ namespace: '{Produto}/{Dominio}' });
   const tracer  = new Tracer({ serviceName: '{dominio}' });

   export const handler = middy(mainHandler)
     .use(injectLambdaContext(logger))
     .use(captureLambdaHandler(tracer))
     .use(logMetrics(metrics));
   ```

2. **Padronize o conteúdo do log.** Todo registro carrega: `level`, `message`, `requestId`, `traceId`, `service`, `tenantId`, `timestamp`.
3. **Devolva a correlação ao cliente**: `X-Request-Id` e `X-Trace-Id` nos cabeçalhos, e `requestId` no corpo do erro — é o que liga a reclamação do usuário à linha de log.
4. **Emita métrica de negócio via EMF** (escrita no log, extraída assincronamente) — não por chamada de API dentro do caminho da requisição.
5. **Habilite tracing ativo** na função e no estágio do gateway, para que o trace atravesse a borda.
6. **Crie os quatro alarmes obrigatórios** por função: erros acima de 1 % em 5 min, throttles acima de zero, duração acima de 80 % do timeout, e mensagens visíveis na DLQ.
7. **Correlacione o frontend**: o error boundary captura a exceção junto com o `requestId` da última chamada e o tenant ativo.

## Regras

- **Nunca logue token, senha, dado de cartão ou PII.** O log é lido por mais gente do que se imagina, e retido por mais tempo
- **Alta cardinalidade vai no log, nunca na dimensão da métrica.** `userId` como dimensão gera uma métrica cobrada por usuário
- **Log é JSON, sempre.** Texto livre não é consultável e obriga expressão regular no pior momento possível
- **Toda função tem timeout explícito** dimensionado pelo tipo de trabalho — o padrão de 3 s nunca é aceito por omissão
- **Fila assíncrona sem DLQ e sem alarme na DLQ é falha invisível**
- **Retenção de log é definida na infraestrutura.** O padrão é reter para sempre, e isso é uma conta crescente

## Exemplo

Um usuário relata erro numa criação de pedido e informa o identificador exibido na tela. Uma consulta pelo `requestId` traz a linha exata do log, com o tenant e o trace. O trace mostra 180 ms na função e 2,3 s na chamada ao serviço de terceiro — a causa não era o código. O alarme de duração já havia disparado quinze minutos antes.

---
Ref: [[Amazon CloudWatch]], [[Observability]], [[Distributed Tracing]], [[Logging]], [[Contrato de API Padronizado]], [[Monitoring and Event Management]]
