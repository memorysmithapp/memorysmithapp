---
title: Busca na Interface (uso do motor de busca)
aliases: [Search, Busca básica, Busca multicritério, Busca avançada, Search views]
tags: [use-case, search, criteria, pagination, map-view, trash]
type: use-case
maturity: evergreen
reviewed: false
source: "[[EV-2-a1-007 · Motor de busca da UI (básica, multicritério, avançada, export, ações massivas)|EV-2-a1-007]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Busca na Interface (uso do motor de busca)

O GLPI tem um motor de busca que exibe elementos que satisfazem critérios. As listas são **paginadas** (barra de navegação no topo e no rodapé define itens por página e navega). Há também um motor de busca **global** (dados de objetos de tipos diferentes). Face de uso do [[Motor de Busca (Search Engine)]] (código).

## Busca básica
Múltiplas buscas configuradas e ordenadas sobre um tipo do inventário. Critérios adicionados com o `+` de fundo **cinza**. Operadores e semântica de datas/labels detalhados em [[Critérios e Operadores de Busca da UI]]. A busca é lançada pelo botão **Search**.

## Busca multicritério
Refina a busca estendendo-a a outros tipos de objeto, adicionando critérios de busca global — com o `+` de fundo **branco**. Ex.: computadores com >1024 MiB, >80% de disco livre, monitor de 17" e LibreOffice instalado (critérios *simple* e *multi* ligados por *AND*).

## Itens na lixeira (Trash)
Itens que podem ir para a lixeira são vistos clicando no ícone de lixeira (para restaurar ou excluir definitivamente); clicar de novo volta aos ativos.

## Views de resultado
- **List/Table** (padrão) — tabela com campos no cabeçalho e um resultado por linha. Ordenar clicando nos cabeçalhos; **multi-ordenação** com `Ctrl`/`Command`; cliques sucessivos alternam direção/removem ordenação. Rodapé traz dropdown de resultados por página, paginação e indicador de posição.
- **Map** — localização dos resultados num mapa (toggle acima dos resultados); oculto se o tipo de item não tem localização.

> [!note]
> O nº padrão de registros exibidos é configurável nas [[Campos das Preferências do Usuário|preferências]] (ver também [[Visualização e Gestão de Registros]]).

## Relações
- Complementada por: [[Busca Rápida (Quick Search)]], [[Exportação de Resultados de Busca]], [[Ações Massivas (bulk actions)]], [[Buscas Salvas (Bookmarks)]].
- Detalhe: [[Critérios e Operadores de Busca da UI]].
- Ponte de código: [[Motor de Busca (Search Engine)]].
