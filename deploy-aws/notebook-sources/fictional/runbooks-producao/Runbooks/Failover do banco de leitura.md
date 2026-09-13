---
title: Failover do banco de leitura
aliases: []
tags: [runbook, database]
type: runbook
status: evergreen
source: replica-reader
author: Equipe de SRE
created: 2026-06-05
---

## Pré-condições

Réplica saudável com replicação em dia.

## Passos

1. Promover a réplica.
2. Apontar o endpoint de leitura.
3. Validar consultas canário.

## Verificação final

Erros de leitura zerados no painel por 5 minutos.
