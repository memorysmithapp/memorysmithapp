---
title: Visualização e Gestão de Registros
aliases: [View and manage records, Listas e abas, Customize display]
tags: [use-case, list, tabs, display, columns, view]
type: use-case
status: confirmed
source: "[[EV-2-a1-006 · Visualização e gestão de registros (listas e abas)|EV-2-a1-006]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Visualização e Gestão de Registros

A exibição de **listas** de registros e dos **detalhes** de um registro funciona sempre da mesma forma no GLPI, seja lista de computadores, telefones ou tickets — o princípio de apresentação é o mesmo.

## Obter uma lista (2 formas)
- **A partir do motor de busca** — após critérios e validação, exibe-se a lista. Por padrão, nenhum critério limita a lista; o display limita-se aos primeiros `x` registros (configurável nas [[Campos das Preferências do Usuário|preferências]]). Ver [[Busca na Interface (uso do motor de busca)]].
- **A partir de outra lista** — algumas abas oferecem lista de itens relacionados (ex.: de um computador, a aba de software mostra o software instalado).

## Detalhes em abas
Os detalhes de um registro são organizados em **abas** que agrupam informações similares (ex.: informação financeira e lista de software em abas separadas de um computador).

## Customizar a exibição (colunas)
As colunas exibidas na lista completa do inventário são configuráveis (botão de preferências): adicionar, remover e ordenar colunas.
- **Visão global** — aplica-se a todos os perfis com acesso à parte do inventário; a mudança é visível a todos.
- **Visão pessoal** — aplica-se só ao usuário logado e **sobrepõe** a global. Disponível apenas com o direito *User view* em *Search result display*. Permite **redefinir** a personalização (voltar ao padrão por tipo de objeto).

## Relações
- Base de: [[Busca na Interface (uso do motor de busca)]], [[Ações Massivas (bulk actions)]].
- Personalização em: [[Campos das Preferências do Usuário]].
- Ponte de código: [[Motor de Busca (Search Engine)]], [[CommonDBTM (Active Record)]].
