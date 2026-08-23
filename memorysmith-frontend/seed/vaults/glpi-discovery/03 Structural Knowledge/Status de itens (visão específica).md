---
title: Status de itens (visão específica)
aliases: [Status, Estado de item, Status de ativo]
tags: [status, lifecycle, dropdown, inventory]
type: concept
status: confirmed
source:
  - "[[EV-2-a2-003 · Status como visão específica|EV-2-a2-003]]"
  - "[[EV-2-a2-005 · Glossário oficial do GLPI|EV-2-a2-005]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Status de itens (visão específica)

**Status** é o estado de um ativo ou de um ticket dentro do seu ciclo de vida. Para ativos, é usado para classificar hardware (descartado, disponível, atribuído...).

> [!note] Configuração pelo administrador
> É possível criar novos valores de status específicos do sistema gerido e definir os tipos de objeto a que se aplicam — responsabilidade do administrador, via [[Dropdown (lista suspensa customizável)|configuração de dropdown]]. Esses status podem ser **recursivos** (ver [[Recursividade em entidades]]) para facilitar a gestão entre entidades.

O status de um elemento pode ser modificado pelo formulário do elemento ou por [[Ações em massa (massive actions)]]. Um relatório pode exibir o resumo de status por tipo de ativo e a busca global no inventário permite consultar elementos por status (ver [[Relatórios e estatísticas]]).

No Kanban, as colunas correspondem aos status (ver [[Quadro Kanban]]). Para tickets, os valores de status compõem a máquina de estados descrita em [[Ciclo de vida de um Ticket (máquina de estados)]] (New, In progress attributed/planned, Pending, Solved, Closed). Relaciona-se à [[Gestão de Ativos e Configuração (SACM)]].
