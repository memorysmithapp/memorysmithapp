---
title: Aba Antivírus (ativos)
aliases: [Antivirus tab, Aba Antivirus]
tags: [assets, tab, antivirus, computer, inventory]
type: component
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-c3-001 · Aba Antivírus de um Computador|EV-2-c3-001]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Aba **Antivirus**, presente na ficha de um `Computer`, para gerenciar o(s) antivírus em execução na máquina. É uma das abas de detalhe que compõem um ativo, ao lado de componentes, software e sistema operacional.

> [!note] Origem dos dados
> As informações de antivírus podem ser importadas e mantidas automaticamente pelo [[Inventário automático (processo)]] (nativo ou ferramenta de terceiros). A adição/remoção manual é registrada no histórico do computador (ver [[Ciclo de vida de um item (add-update-delete)]]).

> [!warning] Persistência do agente na estação
> Excluir o antivírus no GLPI (**Delete permanently**) não o remove da estação: se ainda presente, ele reaparece no próximo inventário automático. É preciso removê-lo também na estação.

O fabricante (manufacturer) do antivírus reutiliza o cadastro comum de fabricantes (ver [[Fornecedores e Contatos]]). Os atributos do antivírus estão detalhados em [[Campos do Antivírus (ativo)]].

Ver também: [[Composição de um Ativo (componentes)]] · [[Modelo de Ativos (padrão comum)]].
