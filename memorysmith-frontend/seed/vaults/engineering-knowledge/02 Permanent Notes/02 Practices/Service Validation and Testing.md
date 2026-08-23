---
title: Service Validation and Testing
aliases:
  - Validação e Teste de Serviço
tags:
  - itil
  - practice
  - product-service
  - quality
type: practice
status: evergreen
source: ITIL Foundation (Version 5), PeopleCert, 2026
author: PeopleCert
created: 2026-07-25
---
Prática que garante que produtos e serviços novos ou modificados atendam aos requisitos definidos, tanto de utilidade quanto de garantia.

## Dinâmica / Passo a Passo

1. Derivar critérios de aceitação dos requisitos de [[Utility]] e [[Warranty]]
2. Definir a estratégia de teste proporcional ao risco
3. Automatizar o que é repetitivo e executado a cada mudança
4. Testar também o caminho de falha e a reversão
5. Validar prontidão operacional, não apenas funcional
6. Usar defeitos escapados como sinal para melhorar a estratégia

## Regras

- Testar só utilidade deixa a garantia para o usuário descobrir
- Teste manual repetido a cada release não escala e é o primeiro a ser pulado
- Ambiente divergente de produção invalida o resultado
- Cobertura alta não é o alvo; risco coberto é

---
Ref: [[Build (Lifecycle)]], [[Continuous Integration (CI)]], [[Utility]], [[Warranty]], [[Transition (Lifecycle)]], [[Product and Service Management Practices]]
