---
title: Gestão de Ativos e Configuração (SACM)
aliases: [SACM, Asset Management, CMDB processo]
tags: [process, cmdb, dominio/ativos]
type: process
status: confirmed
maturity: evergreen
reviewed: false
source:
  - "[[EV-1-015 · Ativos herdam CommonDBTM com traits Assignable-State-Inventoriable|EV-1-015]]"
  - "[[EV-1-016 · Composição do ativo via Item_Devices e itens filhos|EV-1-016]]"
  - "[[EV-1-020 · Infocom dados administrativos e financeiros do ativo|EV-1-020]]"
author: CAD Discovery
created: 2026-07-10
---

# Gestão de Ativos e Configuração (SACM)

Processo que mantém um registro preciso e atualizado dos ativos de TI e suas relações — o
CMDB do GLPI. Sustentado pelo [[Modelo de Ativos (padrão comum)]].

## Ciclo de vida do ativo
1. **Cadastro/descoberta** — manual, importação ou [[Inventário automático (processo)]].
2. **Classificação** — tipo, modelo, fabricante, **estado** (State), **localização** (física
   e DCIM), **entidade**, responsável (AssignableItem).
3. **Composição** — componentes, SO, software, rede, VMs ([[Composição de um Ativo (componentes)]]).
4. **Gestão administrativa/financeira** — [[Infocom (dados financeiros do ativo)]]
   (compra, garantia, depreciação) e vínculo a contratos/documentos.
5. **Relações** — ligação a chamados ([[Ticket]]), problemas, mudanças e a outros ativos
   (impacto).
6. **Baixa/descarte** — mudança de estado, fim de garantia, saída do parque.

## Valor
Base para service desk (item afetado num chamado), análise de impacto, planejamento de
capacidade e conformidade de software.
