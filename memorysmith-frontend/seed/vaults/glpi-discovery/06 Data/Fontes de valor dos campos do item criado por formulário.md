---
title: Fontes de valor dos campos do item criado por formulário
aliases: [Form item field sources, Custom item fields]
tags: [formularios, forms, item, mapeamento, dados, doc]
type: table
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-e2-016 · Formulários - visibilidade, catálogo, controle de acesso e item a criar|EV-2-e2-016]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Na aba **Custom** do formulário, cada campo do item a ser criado (ticket/change/problem) pode ter sua **origem de valor** definida. Padrões recorrentes de fonte:

## Propriedades
- **Template**: só preenche elementos não preenchidos; nunca sobrepõe o preenchimento manual;
- **Entity**: *Active in entity of form filler* / *From form* / *Specific entity* / *Answer from a specific question* / *Answer to last "Entity" question*;
- **Request type**: From template / Specific / Answer from question / Answer to last (default: **incident**);
- **ITIL Category**: Specific / Answer from question / Answer to last;
- **Status**: *Default* (new / processing assigned / processing planned) ou *Closed*;
- **Request source**: From template / From specific source;
- **Urgency** e **Location**: From template / Specific / Answer from question / Answer to last.

## Actors (Requesters / Observers / Assignees)
Múltiplas fontes combináveis (*+ Combine with another option*):
- User who filled the form; Supervisor of the user; From template; Specific actors; Answer from question; Answer from last "Requesters" question;
- **User / Tech / Group / Tech group from GLPI object answer** (recupera usuário/técnico/grupo/grupo técnico atribuído a um ativo — exige pergunta do tipo *GLPI object > asset*).

## Service levels
- **TTO / TTR / Internal TTO / Internal TTR**: From template / Specific — ver [[SLM, SLA e OLA]] e [[TTO e TTR (indicadores de tempo)]].

## Associated items
Computers, Databases, Enclosures, Monitors, Network devices, Peripherals, Phones, Printers, Rack, Server rooms, Software. Fontes: Specific / Answer from question / Answer from last / All valid answers.

## Custom fields (conteúdo)
Por padrão **autoconfig** (todas perguntas/respostas no item); pode-se customizar via `#` (adicionar/remover respostas de perguntas existentes).

> [!warning] Regras de negócio (tickets/changes/problems) podem depois modificar essas informações — ver [[Regras de negócio de tickets (administração)]].
