---
title: Ceilometer
aliases:
  - OpenStack Telemetry Service
  - Telemetry Service
tags:
  - openstack
  - telemetry
  - metering
  - observability
type: concept
status: evergreen
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Serviço de telemetria do OpenStack: coleta, transforma e publica métricas de uso dos recursos da infraestrutura.

## Conceito

Nasceu no release **Havana** com propósito de **faturamento**, não de monitoramento: coletar uso de recurso por tenant e transformá-lo em item de fatura. Monitoramento e alarme foram acoplados depois e desacoplados de novo — o alarme virou [[Aodh]] no Liberty, o armazenamento virou [[Gnocchi]].

Hoje o Ceilometer é estritamente **coletor**.

## Estrutura

| Agente | Papel |
|---|---|
| **Polling** | Consulta periodicamente os serviços via API. O agente de compute colhe das instâncias; o central, dos demais recursos |
| **Notification** | Escuta o barramento, captura notificações e as traduz em métricas |
| **Collector** | Vigia a fila, junta amostras e grava no backend |
| **API service** | Expõe consulta ao banco interno |

### Pipeline de transformação

Toda amostra passa por transformers antes de ser publicada:

| Transformer | O que faz |
|---|---|
| **Accumulator** | Acumula valores e envia em lote |
| **Aggregator** | Agrega em uma aritmética, incluindo percentuais |
| **Rate of change** | Deriva nova métrica do dado anterior — identifica tendência |
| **Unit conversion** | Converte unidade |

E é publicada por um **publisher**: `notifier` (fila confiável) ou `rpc` (síncrono).

## Veja também

- [[Gnocchi]]
- [[Aodh]]
- [[Observability]]
- [[Metrics]]
