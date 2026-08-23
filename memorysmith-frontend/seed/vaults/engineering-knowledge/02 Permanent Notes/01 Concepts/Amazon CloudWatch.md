---
title: Amazon CloudWatch
aliases:
  - CloudWatch
  - CloudWatch Logs
  - CloudWatch Alarms
  - EMF
tags:
  - aws
  - observability
  - operations
  - serverless
type: concept
status: evergreen
source: Amazon CloudWatch User Guide; Integrated Architecture Guide (PWA + AWS Serverless)
author: Amazon Web Services
created: 2026-07-25
---
> [!abstract]
> CloudWatch é a plataforma de observabilidade nativa da AWS: agrega logs, métricas, alarmes e dashboards de todos os serviços da conta, e é o destino padrão da instrumentação de qualquer função Lambda.

## Conceito

Em ambientes serverless não há máquina para acessar por SSH nem processo para inspecionar. O que resta é o que a função **emitiu** antes de o ambiente ser congelado. CloudWatch é onde isso aterrissa, e por isso a qualidade da operação depende inteiramente da qualidade do que se escolheu emitir.

Os três pilares de [[Observability]] mapeiam assim:

| Pilar | Serviço | Origem |
|---|---|---|
| Logs | CloudWatch Logs | `stdout` da função, estruturado em JSON |
| Métricas | CloudWatch Metrics | Métricas do serviço + métricas de negócio via EMF |
| Traces | [[Distributed Tracing\|AWS X-Ray]] | Instrumentação ativa na função e no gateway |

## EMF — métrica sem chamada de API

O **Embedded Metric Format** permite emitir métricas escrevendo um JSON no log. CloudWatch extrai o valor assincronamente. A vantagem é decisiva em Lambda: `PutMetricData` seria uma chamada de rede síncrona somada à duração faturada de toda invocação; EMF custa o que custa um `console.log`.

## Alarmes mínimos por função

Uma função sem alarme é uma função que falha em silêncio até o usuário reclamar.

| Métrica | Limiar de referência | Significa |
|---|---|---|
| `Errors` | > 1 % em 5 min | Regressão funcional |
| `Throttles` | > 0 | Estouro de concorrência — degradação em cascata |
| `Duration` | > 80 % do timeout configurado | Caminho para o timeout; investigar antes de virar erro |
| `NumberOfMessagesVisible` na DLQ | > 0 | Mensagem venenosa ou dependência fora do ar |

## O custo mora nas métricas, não nos logs

> [!warning] Métrica customizada é o item caro
> Logs têm camada gratuita mensal e custo por GB relativamente baixo. **Métricas customizadas são cobradas por métrica única por mês** e a contagem cresce com o produto cartesiano de nomes de métrica × dimensões. Colocar `userId` ou `requestId` como dimensão gera uma métrica por usuário — é a forma mais rápida de multiplicar a fatura de observabilidade por mil. Alta cardinalidade pertence ao **log**, não à dimensão da métrica.

Outras alavancas: definir retenção explícita nos grupos de log (o padrão é *nunca expirar*) e revisar dashboards, cobrados por unidade acima da cota gratuita.

## Veja também

- [[Observability]]
- [[Logging]]
- [[Distributed Tracing]]
- [[Monitoring and Event Management]]
- [[AWS Lambda]]
- [[FinOps]]
