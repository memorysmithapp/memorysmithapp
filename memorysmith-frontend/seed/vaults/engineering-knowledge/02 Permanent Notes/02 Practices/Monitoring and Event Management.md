---
title: Monitoring and Event Management
aliases:
  - Monitoramento e Gestão de Eventos
tags:
  - itil
  - practice
  - product-service
  - operations
type: practice
status: evergreen
source: ITIL Foundation (Version 5), PeopleCert, 2026
author: PeopleCert
created: 2026-07-25
---
Prática que observa sistematicamente serviços e componentes, registra mudanças de estado identificadas como eventos e determina a resposta apropriada a cada uma.

## Dinâmica / Passo a Passo

1. Definir o que monitorar a partir do impacto no serviço, não da disponibilidade do sensor
2. Classificar eventos em informativo, alerta e exceção
3. Estabelecer limiares que gerem ação, não ruído
4. Correlacionar eventos para reduzir alertas redundantes
5. Encaminhar exceções para o fluxo de resposta adequado
6. Revisar continuamente alertas que ninguém aciona

## Regras

- Alerta que não gera ação deve ser removido, não silenciado
- Fadiga de alerta é a causa mais comum de incidente não detectado
- Monitorar componente sem monitorar a jornada do usuário cria pontos cegos
- Correlação vale mais que volume: ver [[AIOps]]

---
Ref: [[Observability]], [[Incident Management]], [[AIOps]], [[Operate (Lifecycle)]], [[Service Level Indicator (SLI)]], [[Product and Service Management Practices]]
