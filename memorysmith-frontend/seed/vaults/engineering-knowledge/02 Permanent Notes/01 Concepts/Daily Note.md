---
title: Daily Note
aliases:
  - Nota Diária
  - Daily Notes
  - Journal
tags:
  - obsidian
  - plugin
  - note-taking
  - pkm
type: concept
status: evergreen
source: Obsidian Help — obsidian.md/help
author: Obsidian
created: 2026-08-07
---
> [!abstract]
> **Daily note** é a nota do dia corrente aberta pelo core plugin Daily notes — ou criada na hora, caso ainda não exista — nomeada por data e opcionalmente pré-preenchida por um template.

## Conceito

A daily note resolve o problema da captura sem decisão: quando a ideia chega, escolher o arquivo já é atrito. A data é um endereço que sempre existe e nunca colide, então o custo de capturar cai a um atalho. O trabalho de destilar depois — extrair conceitos daquilo que foi capturado — é outro momento, e é onde o [[Internal Link (Wikilink)]] entra.

Abre por três caminhos: **Open today's daily note** no Ribbon, na Command palette, ou por hotkey.

## Sintaxe

```md
# {{date:YYYY-MM-DD}}

## Tasks

- [ ]
```

Variáveis de template disponíveis: `{{title}}` (título da nota ativa), `{{date}}` (default `YYYY-MM-DD`) e `{{time}}` (default `HH:mm`). Ambas as variáveis de tempo aceitam **format string** — dois-pontos seguidos de tokens Moment.js, como `{{date:YYYY-MM-DD}}` ou `{{time:YYYY-MM-DD}}`. Os defaults ficam em **Settings → Core plugins → Templates → Date format / Time format**.

## Características

- Nome default: a data de hoje no formato **`YYYY-MM-DD`**, nota vazia.
- **New file location** — pasta onde as daily notes são criadas.
- **Date format** aceita tokens momentJS e **cria subpastas automaticamente**: `YYYY/MMMM/YYYY-MMM-DD` produz `2023/January/2023-Jan-01`.
- **Template file location** aponta a nota-template; ela passa a valer na próxima daily note criada.
- **Integração com properties**: com o plugin ativo, uma date property em *qualquer* nota (`2023-01-01` em `example.md`) vira **link clicável para a daily note daquele dia** em [[Live Preview]]. Ver [[Properties (Frontmatter)]].

> [!warning]
> Em Live Preview, o painel **Properties in document** pode sobrescrever variáveis de template que não estejam entre aspas. Edite templates em **Source mode**, ou ajuste **Settings → Editor → Properties in document** para **Source**.

## Comparação

| | Daily Note | [[Unique Note (Zettelkasten Prefix)]] |
|---|---|---|
| Nome do arquivo | Data — `2024-01-01` | Timestamp — `202401010945` |
| Granularidade | Uma por dia | Uma por criação |
| Colisão | Reabre a nota existente | Avança para o próximo timestamp |
| Papel | Contêiner de captura do dia | Identificador estável de uma ideia |
| Endereçável de fora | Sim, por date property | Não, sem o título completo |
| Template | `Template file location` | `Template file location` |

## Veja também

- [[Properties (Frontmatter)]]
- [[Unique Note (Zettelkasten Prefix)]]
- [[Internal Link (Wikilink)]]
- [[Live Preview]]
- [[Obsidian Plugin]]
