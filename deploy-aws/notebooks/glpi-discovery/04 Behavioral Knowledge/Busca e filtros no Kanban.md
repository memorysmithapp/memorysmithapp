---
title: Busca e filtros no Kanban
aliases: [Kanban filters, Filtros do Kanban, Kanban search]
tags: [kanban, search, filter, tags]
type: use-case
maturity: evergreen
reviewed: false
source: "[[EV-2-a2-002 · Quadro Kanban|EV-2-a2-002]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Busca e filtros no Kanban

O [[Quadro Kanban]] tem um sistema de busca e filtros para restringir os itens exibidos.

Buscas simples são feitas digitando um ou mais termos. Ao clicar na caixa, um tooltip sugere as *tags* de filtro disponíveis (variam por Kanban; plugins podem adicionar novas).

## Tags comuns

- `title`: nome/título do item;
- `type`: tipo do item (no Project Kanban, filtra Projetos ou tarefas de projeto);
- `content`: conteúdo do item;
- `team`: equipe do item (independe do tipo de membro).

## Modificadores

- `!`: negação/exclusão;
- `#`: expressão regular.

Filtros podem ser digitados manualmente, ex.: `title:this` ou `!title:notthis`, ou selecionados do tooltip com mouse/teclado (setas + Enter). Selecionar do tooltip adiciona a tag em modo *edit* para completar o termo.

Cada filtro tem fundo colorido por tipo: **exclusões vermelho**, **regex verde**, **tags regulares azul**, **buscas sem tag preto**. A busca inicia com Enter ou ao clicar fora da caixa. Termos são editados clicando neles (ou setas + backspace) e removidos apagando o conteúdo ou pelo botão "x".
