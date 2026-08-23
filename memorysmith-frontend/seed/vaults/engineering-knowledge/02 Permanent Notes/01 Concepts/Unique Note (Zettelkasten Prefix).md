---
title: Unique Note (Zettelkasten Prefix)
aliases:
  - Unique Note Creator
  - Zettelkasten Prefixer
  - UID
  - Nota Time-Coded
tags:
  - obsidian
  - zettelkasten
  - plugin
  - migration
type: concept
status: evergreen
source: Obsidian Help — obsidian.md/help
author: Obsidian
created: 2026-08-07
---
> [!abstract]
> **Unique note** é a nota criada pelo core plugin Unique note creator com nome time-coded — o timestamp `YYYYMMDDHHmm` do momento da criação — seguindo a convenção de identificadores do método Zettelkasten.

## Conceito

O Zettelkasten clássico separa **identificador** de **título**: o número da ficha nunca muda, mesmo que a ideia seja reformulada. Isso torna o endereço estável por construção. O Obsidian, ao contrário, resolve links pelo **nome completo do arquivo** — o nome *é* o endereço.

O plugin oferece a metade fácil da convenção (gerar o UID), mas a outra metade colide com o modelo de endereçamento do app. É um atrito estrutural, não um bug.

## Características

- Criar: **Create new unique note** no Ribbon, ou o mesmo comando na Command palette (`Ctrl+P` / `Cmd+P`).
- Nome gerado: timestamp. Uma nota criada às 09:45 de 1º de janeiro de 2024 nasce como **`202401010945`**.
- **Colisão**: se já existe nota com esse nome, a nova usa o **próximo timestamp disponível**.
- Notas novas são vazias por default; **Template file location**, em *Settings → Core plugins → Unique note creator*, define o template. Vale a mesma sintaxe de variáveis do plugin Templates (`{{date}}`, `{{time}}`, `{{title}}`).

## O atrito e o conserto

> [!warning]
> Se a nota se chama `202301011230 My note title` e outra nota a referencia só pelo UID, `[[202301011230]]`, **o link quebra** — o Obsidian usa o nome completo da nota para resolver internal links.

O core plugin **Format converter** resolve o passivo em duas modalidades, aplicadas ao vault inteiro (faça [[Backup]] antes):

| Opção | Converte |
|---|---|
| **Zettelkasten link fixer** (full links) | `[[UID]]` → `[[UID File Name]]` |
| **Zettelkasten link beautifier** (pretty links) | `[[UID]]` → `[[UID File Name\|File Name]]` |

## Comparação

| | Identificador opaco (Zettelkasten clássico) | Endereçamento por nome (Obsidian) |
|---|---|---|
| Endereço | O UID, imutável | O nome completo do arquivo |
| Renomear o título | Não afeta os links | Quebraria — se não fosse o auto-update |
| Legibilidade do link | Nenhuma | Alta |
| Custo | Precisa de índice para achar a ficha | Precisa de disciplina de nomes |
| Recuperação no Obsidian | — | `Automatically update internal links` + [[Alias (Obsidian)]] |

> [!success]
> A estabilidade que o UID dava é reconstruída por outro caminho: **Automatically update internal links** reescreve os links ao renomear, e um alias permite continuar chamando a nota pelo nome antigo — ou pelo próprio UID — sem tocar no arquivo. O identificador deixa de ser o nome e passa a ser o par nome + aliases, mantido consistente pelo app em vez de pela sua memória.

Para granularidade abaixo da nota, o endereço estável é outro — ver [[Block Reference]]. Como toda essa camada vive em texto puro, o custo de sair permanece baixo: ver [[Data Portability]].

## Veja também

- [[Daily Note]]
- [[Internal Link (Wikilink)]]
- [[Alias (Obsidian)]]
- [[Block Reference]]
- [[Data Portability]]
- [[Migrar uma Base de Conhecimento para o Obsidian]]
