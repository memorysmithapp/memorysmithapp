---
title: Release Management
aliases:
  - Gestão de Liberação
tags:
  - itil
  - practice
  - product-service
  - release
type: practice
status: evergreen
source: ITIL Foundation (Version 5), PeopleCert, 2026
author: PeopleCert
created: 2026-07-25
---
Prática que disponibiliza serviços e funcionalidades novas e modificadas para uso, controlando quando e para quem cada mudança se torna visível.

## Dinâmica / Passo a Passo

1. Definir o escopo e o conteúdo da liberação
2. Separar a liberação técnica ([[Deployment Management]]) da exposição ao usuário
3. Escolher a estratégia: progressiva, canário, por segmento, feature flag
4. Preparar usuários, suporte e documentação antes de expor
5. Liberar observando indicadores de saúde e de adoção
6. Reverter a exposição rapidamente quando necessário

## Regras

- Liberar para todos de uma vez é a estratégia mais arriscada disponível
- Feature flag sem data de remoção vira dívida técnica permanente
- Suporte precisa saber da liberação antes do usuário
- Comunicar o que mudou é parte da liberação, não cortesia

---
Ref: [[Deployment Management]], [[Change Enablement]], [[Continuous Delivery (CD)]], [[Transition (Lifecycle)]], [[Product and Service Management Practices]]
