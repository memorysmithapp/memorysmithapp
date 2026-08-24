---
title: Reiniciar o pipeline de ingestão
aliases: [Restart ingest]
tags: [runbook, pipeline, incident-response]
type: runbook
maturity: growing
reviewed: false
source: svc-ingest
author: Equipe de SRE
created: 2026-06-02
---

## Pré-condições

Acesso de operador ao cluster e janela sem ingestão em lote agendada.

## Passos

1. Pausar os consumidores e aguardar a fila drenar.
2. Reiniciar os workers em ordem inversa de dependência.
3. Reprocessar a dead-letter queue.

## Verificação final

Painel de lag zerado por 10 minutos. Incidente relacionado: [[2026-06-14 · Fila de eventos parada]].
