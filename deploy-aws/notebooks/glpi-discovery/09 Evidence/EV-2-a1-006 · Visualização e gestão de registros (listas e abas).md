---
title: EV-2-a1-006 · Visualização e gestão de registros (listas e abas)
aliases: [EV-2-a1-006]
tags: [evidence, doc, list, tabs, records, display, columns]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-002 · source/first-steps/view.rst · View and manage records / Customize the display"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-a1-006 · Visualização e gestão de registros (listas e abas)

> [!quote] source/first-steps/view.rst
> "The display of all the lists of records and of all the details concerning a record always works in the same way in GLPI. Whether it's a list of computers, phones or tickets, the presentation follows the same principle."

Uma lista de elementos pode ser obtida de 2 formas:

- **A partir do motor de busca** — após definir critérios e validar a busca, exibe-se uma lista. Por padrão, nenhum critério limita a lista e o display é limitado aos primeiros `x` registros (configurável nas preferências).
- **A partir de outra lista** — algumas abas oferecem lista de itens relacionados. Ex.: em uma lista de computadores, clicar no nome de um computador e navegar até a aba de software mostra o software instalado.

Os detalhes de um registro são exibidos em **abas** que agrupam informações similares (ex.: para um computador, informações financeiras e lista de software ficam em abas separadas).

## Customizar a exibição (colunas)
> [!quote] source/first-steps/view.rst — Customize the display
> "The columns displayed from the complete list of the inventory can be configured." (botão `images/change_prefs_button.png`) É possível adicionar, remover e ordenar as colunas exibidas.

- **Visão global (global view)**: aplica-se a todos os perfis com acesso à parte do inventário — a modificação é visível a todos os usuários.
- **Visão pessoal (personal view)**: aplica-se somente ao usuário logado e sobrepõe as configurações da visão global. Disponível apenas para quem tem o direito *User view* em *Search result display*. Permite também **redefinir** a personalização (voltar ao display padrão apagando a personalização, por tipo de objeto).

## Sustenta
- [[Visualização e Gestão de Registros]]
