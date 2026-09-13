---
title: 2026-06-14 · Fila de eventos parada
aliases: [INC-2026-031]
tags: [postmortem, pipeline]
type: postmortem
status: evergreen
source: INC-2026-031
author: Equipe de SRE
created: 2026-06-15
---

## Linha do tempo

Consumidores pararam após deploy com variável de ambiente ausente; a fila cresceu por 40 minutos até o alerta de lag.

## Causa raiz

Validação de configuração ausente no boot do worker.

## Ações

O procedimento de recuperação virou [[Reiniciar o pipeline de ingestão]]; o boot passou a falhar rápido com configuração inválida.
