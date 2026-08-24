---
title: Problem
aliases: [Problema, Problem]
tags: [entity, itil, dominio/service-desk]
type: entity
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-1-013 · Change e Problem estendem CommonITILObject com fases próprias|EV-1-013]]"
author: CAD Discovery
created: 2026-07-10
---

# Problem

O **Problem** (problema) modela a gestão de problemas ITIL — análise de **causa-raiz** de um
ou mais incidentes recorrentes. Subclasse de [[CommonITILObject (base de service desk)]] com
`STATUS_MATRIX_FIELD = 'problem_status'`.

Reaproveita atores, timeline, tarefas (`ProblemTask`), custos e templates. Distingue campos
próprios de análise (impactos, causas, sintomas, solução de contorno vs solução definitiva).
Liga-se a Tickets e Changes (`Problem_Ticket`, `Change_Problem`), sustentando a cadeia
**incidente → problema → mudança**.

Ver [[Gestão de Problemas (processo)]].
