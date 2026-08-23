---
title: Critérios e Operadores de Busca da UI
aliases: [Search operators, Operadores de busca, Search criteria]
tags: [data, search, operators, criteria, semantics]
type: data
status: confirmed
source: "[[EV-2-a1-007 · Motor de busca da UI (básica, multicritério, avançada, export, ações massivas)|EV-2-a1-007]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Critérios e Operadores de Busca da UI

Semântica dos critérios e operadores expostos no formulário de busca (ver [[Busca na Interface (uso do motor de busca)]]).

## Operadores de comparação (conforme o dado)
`contains`, `is`, `is not`, `before`, `after`.

## Datas
- **Data específica** (*Specify a date*) ou **relativa** à data atual: *Now*, `+`/`-` X hora(s), dia(s), mês ou ano(s).
- **Intervalos definidos**: *Monday*, *Last Saturday*, *Start of month*, *Start of year*, etc.
- Formato explícito de data: `[Year]-[Month]-[Day]` (YYYY-MM-DD).
- `<-60` (ex.: *Date of purchase contains <-60* = computadores com 5 anos, em meses).

## Labels / dropdowns
- Busca por valor com *is*. Se dropdowns são visíveis em subentidades, aparecem as opções "sob" e "não sob".

## Tipo de critério e conjunção
- **Simple** (fundo cinza, `+`) — critério no mesmo tipo de objeto (busca básica).
- **Multi** (fundo branco, `+`) — estende a outros tipos de objeto (busca multicritério).
- Conjunções: `AND`, `AND NOT`.

## Operadores textuais avançados
| Operador | Efeito |
|---|---|
| `NULL` | Campo vazio |
| `^123` | Contém "123" no **início** do campo |
| `123$` | Contém "123" no **fim** do campo |
| `^123$` | Contém **somente** "123" |
| `^Windows` | "Windows 2000", "Windows XP", mas não apenas "Windows" |
| `\\` | **Não utilizável** por razões de segurança |

> [!warning]
> Em alguns sistemas, para usar `^` é preciso digitar `^`, barra de espaço, depois o primeiro caractere.

## Relações
- Usados em: [[Busca na Interface (uso do motor de busca)]].
- Ponte de código: [[Motor de Busca (Search Engine)]].
