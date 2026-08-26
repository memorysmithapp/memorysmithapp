---
title: Rotação de chaves de API
aliases: []
tags: [runbook, security]
type: runbook
maturity: seed
reviewed: false
source: gateway
author: Equipe de SRE
created: 2026-07-30
---

## Pré-condições

Rascunho: falta mapear os consumidores externos da chave antiga.

## Passos

1. Emitir chave nova mantendo a antiga válida.
2. Migrar consumidores.
3. Revogar a antiga.
