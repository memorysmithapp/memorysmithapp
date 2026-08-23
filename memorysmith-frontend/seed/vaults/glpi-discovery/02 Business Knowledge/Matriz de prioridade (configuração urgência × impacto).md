---
title: Matriz de prioridade (configuração urgência × impacto)
aliases: [Priority matrix, Matriz de prioridade]
tags: [prioridade, urgencia, impacto, matriz, itil, rule, configuracao]
type: rule
status: confirmed
source: "[[EV-2-b2-005 · Matriz de cálculo de prioridade (urgência × impacto)|EV-2-b2-005]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Matriz de prioridade (configuração urgência × impacto)

Regra de negócio que deriva a **prioridade** de um item de help desk a partir da **urgência**
(definida pelo usuário) e do **impacto** (definido pelo técnico), seguindo boas práticas ITIL.
A matriz é **comum** a [[Ticket|tickets]], [[Problem|problemas]] e [[Change|mudanças]] e é
configurada na aba **Assistance** de **Setup > General**. O GLPI traz uma matriz predefinida
para os casos padrão.

É possível **selecionar quais níveis** de urgência, impacto e prioridade ficam disponíveis e
**desabilitar** alguns (definindo o nível como `No`); o nível **Medium não pode ser
desabilitado**. Como a ordem de processamento pelos técnicos se baseia na prioridade, essa
configuração afeta diretamente a fila.

> [!warning] Prioridade Major (fora da matriz)
> A prioridade **Major** (usada por tickets) **não** faz parte da matriz: é superior a
> qualquer outra e exige permissão para alterar prioridade. Um incidente *Major* sobrepõe-se
> a todos os demais.

Materializa, na ótica de configuração, o conceito de [[Priorização (urgência × impacto)]]
(código). Os valores numéricos exatos da matriz default estão só em captura de tela —
ver [[INV-2-b2-002 · Valores exatos da matriz de prioridade default]].
