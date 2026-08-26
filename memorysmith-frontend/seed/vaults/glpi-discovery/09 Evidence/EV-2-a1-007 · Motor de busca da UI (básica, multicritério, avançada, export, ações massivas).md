---
title: EV-2-a1-007 · Motor de busca da UI (básica, multicritério, avançada, export, ações massivas)
aliases: [EV-2-a1-007]
tags: [evidence, doc, search, criteria, operators, export, massive-actions, quick-search, trash]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-002 · source/first-steps/search.rst · Search for information in GLPI (todas as seções)"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-a1-007 · Motor de busca da UI (básica, multicritério, avançada, export, ações massivas)

> [!quote] source/first-steps/search.rst
> "GLPI has a search engine allowing you to display a set of elements satisfying a certain number of criteria. The proposed lists are paginated. A navigation bar at the top and bottom of the list is used to define the number of items to display per page and to navigate between pages. A global search engine (that is, one that can use data from objects of different type) is also available."

Recursos adicionais das listas: exportação (CSV, PDF, ...), ações massivas (bulk), sistema de bookmarks para salvar buscas.

## Busca básica
Permite múltiplas buscas configuradas e ordenadas sobre um dos tipos do inventário. Operadores propostos (conforme o dado): `contains`, `is`, `is not`, `before`, `after`. Buscas em datas permitem data específica (*Specify a date*) ou relativa à data atual (*Now*, `+`/`-` X hora(s)/dia(s)/mês/ano(s)), e intervalos definidos (*Monday*, *Last Saturday*, *Start of month*, *Start of year*, etc.). Para labels, busca por valor (*is*); se dropdowns são visíveis em subentidades, aparecem opções "sob"/"não sob". Critérios adicionados com `+` em fundo **cinza**. A busca é lançada pelo botão **Search**.

## Busca multicritério
> [!quote]
> "The multi-criteria search makes it possible to refine the search by extending it to other types of objects by adding global search criteria." Obtida adicionando critérios com o `+` em fundo **branco**. Ex.: computadores com >1024 MiB de memória, >80% de disco livre, ligados a monitor de 17", com LibreOffice instalado (tipos *simple* e *multi*, ligados por *AND*).

## Itens na lixeira (Trash)
Alguns itens podem ir para a lixeira. Para vê-los (restaurar ou excluir definitivamente), clicar no ícone de lixeira; clicar novamente volta aos elementos ativos.

## Busca avançada (operadores)
- `NULL` — registros com campo vazio (uso com campos de data).
- `^123` — contém 123 no início do campo. (Aviso: em alguns sistemas é preciso digitar `^`, espaço, depois o primeiro caractere.)
- `^Windows` — contém "Windows 2000", "Windows XP", mas não apenas "Windows".
- `123$` — contém 123 no fim do campo.
- `^123$` — contém somente o texto 123.
- `AND NOT` — dois critérios ligados; registros que não atendem um critério. Ex.: *Entity is «Root entity»* `AND NOT` *Type contains «Laptop»*.
- `[Year]-[Month]-[Day]` (YYYY-MM-DD) — busca por data.
- `\\` — por razões de segurança, o operador `\\` não é utilizável.

## Exportação de resultados
Formatos SLK ou CSV (planilha) ou PDF, em duas formas: *Current page* (só o exibido) ou *All pages* (todos os resultados). Há opção de copiar os nomes dos resultados para a área de transferência. SLK é lido por muitos softwares; campos longos são truncados em softwares não conformes (preferir CSV). CSV importado no Microsoft Excel pode exibir acentos incorretamente (dificuldade com UTF-8). Botão `Export` acima da lista.

## Views de busca
- **List/Table** — visão padrão: tabela com nomes de campos no cabeçalho e cada resultado em uma linha.
- **Map** — mostra a localização dos resultados num mapa (toggle acima dos resultados). Se o tipo de item não tem localização, o toggle de mapa fica oculto.

### Visão em tabela
Ordenar por qualquer campo exibido clicando nos cabeçalhos de coluna. Multi-ordenação segurando `Ctrl`/`Command` (MacOS) ao clicar. Cliques sucessivos alternam direção da ordenação e a remoção. No rodapé há dropdown para nº de resultados por página, controles de paginação e indicador de posição (ex.: *Showing 1 to 20 of 30 rows*).

## Ações massivas (Massive/Bulk actions)
Sistema integrado ao motor de busca para modificações em lote. Exemplos (variam por tipo): *Put in trashbin*, *Delete permanently*, *Restore*, *Connect*/*Disconnect*, *Install*, *Update*, *Add a contract*, *Enable the financial and administrative information*, *Add to transfer list*, *Synchronize*. Selecionar elementos → botão **Actions** (topo e rodapé) → escolher ação → opções e botão de validação. Resultados exibidos ao fim. Checkbox no cabeçalho seleciona/deseleciona todos. Sistema similar existe em listas dentro dos próprios objetos.

> [!warning]
> O número de elementos manipuláveis simultaneamente é limitado por `max_input_vars` ou `suhosin.post.max_vars` na configuração PHP. Pode surgir mensagem de que edições massivas estão desabilitadas — aumentar os valores no PHP ou reduzir itens exibidos.

## Busca rápida (Quick search)
Ferramenta no canto superior direito da tela (`images/search_quick.png`). Busca entre elementos incluindo (não limitado a): Tickets, Problems, Changes, Projects, Computers, Monitors, Software, Network Equipment, Peripherals, Printers, Phones, Contacts, Suppliers, Documents, Budgets, Licenses, Users, Groups.
> [!note]
> "The search is carried out only on the fields displayed by default for each of the elements... it is the same as an `items seen` search on each type of element."

## Sustenta
- [[Busca na Interface (uso do motor de busca)]]
- [[Critérios e Operadores de Busca da UI]]
- [[Exportação de Resultados de Busca]]
- [[Ações Massivas (bulk actions)]]
- [[Busca Rápida (Quick Search)]]
