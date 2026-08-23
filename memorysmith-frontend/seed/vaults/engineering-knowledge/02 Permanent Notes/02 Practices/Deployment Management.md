---
title: Deployment Management
aliases:
  - Gestão de Implantação
tags:
  - itil
  - practice
  - product-service
  - engineering
type: practice
status: evergreen
source: ITIL Foundation (Version 5), PeopleCert, 2026
author: PeopleCert
created: 2026-07-25
---
Prática que move hardware, software, documentação e processos novos ou modificados para os ambientes de produção. Migrou das práticas técnicas do ITIL 4 para o grupo de produto e serviço na Versão 5.

## Dinâmica / Passo a Passo

1. Padronizar e automatizar o processo de implantação
2. Manter paridade entre ambientes ([[Infrastructure as Code]])
3. Implantar em lotes pequenos e frequentes
4. Separar implantação de liberação para o usuário, quando possível
5. Verificar saúde após implantar, automaticamente
6. Reverter rápido quando o sinal for negativo

## Regras

- Implantar é técnico; liberar é decisão de negócio — separar os dois reduz risco
- Implantação manual não é auditável nem reproduzível
- Se reverter é difícil, o desenho está errado
- Frequência alta com lote pequeno é mais seguro que o contrário

---
Ref: [[Release Management]], [[Change Enablement]], [[Continuous Delivery (CD)]], [[Infrastructure as Code]], [[Transition (Lifecycle)]], [[Product and Service Management Practices]]
