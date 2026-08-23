---
title: Gestão de Problemas (processo)
aliases: [Problem Management]
tags: [process, itil, dominio/service-desk]
type: process
status: confirmed
source: "[[EV-1-013 · Change e Problem estendem CommonITILObject com fases próprias|EV-1-013]]"
author: CAD Discovery
created: 2026-07-10
---

# Gestão de Problemas (processo)

Processo ITIL implementado pela entidade [[Problem]] para identificar a **causa-raiz** de
incidentes recorrentes e eliminar o problema subjacente.

## Fluxo típico
1. **Detecção** — problema aberto a partir de incidentes recorrentes (`Problem_Ticket`) ou
   proativamente.
2. **Análise** — investigação de causa; registro de **impactos**, **causas** e **sintomas**.
3. **Solução de contorno (workaround)** — mitigação temporária, publicável na base de
   conhecimento ([[Base de Conhecimento]] — Módulo 4/5).
4. **Solução definitiva** — frequentemente via uma [[Change]] (`Change_Problem`).
5. **Encerramento** — quando a causa é eliminada.

Reaproveita atores, tarefas (`ProblemTask`), timeline e prioridade
([[Priorização (urgência × impacto)]]) da base [[CommonITILObject (base de service desk)]].
