---
title: Embed (Transclusão)
aliases:
  - Embed
  - Transclusão
  - Transclusion
tags:
  - obsidian
  - linking
  - markdown
  - note-taking
type: concept
status: evergreen
source: Obsidian Help — obsidian.md/help
author: Obsidian
created: 2026-08-07
---
> [!abstract]
> Um **embed** é um [[Internal Link (Wikilink)|internal link]] precedido de `!` que exibe o conteúdo do arquivo referenciado inline na nota, em vez de apenas apontar para ele.

## Conceito

Embed é a operação de *transclusão*: o conteúdo aparece onde é útil, mas continua existindo em um único lugar. A propriedade que dá valor ao mecanismo está declarada na doc — os arquivos embedados *stay up to date when the source file changes*. Não há cópia a sincronizar; há uma referência resolvida na renderização.

Isso muda a economia da escrita. Uma definição escrita uma vez pode aparecer em cinco notas sem que se crie cinco versões divergentes dela — e a granularidade da referência pode descer até o bloco, via [[Block Reference]].

## Sintaxe

```markdown
![[Internal links]]                 nota inteira
![[Nota#Heading]]                   uma seção
![[Nota#^b15695]]                   um bloco
![[Minha nota#^my-list-id]]         uma lista com block id
![[Engelbart.jpg]]                  imagem
![[Engelbart.jpg|100x145]]          imagem com largura x altura
![[Excerto.ogg]]                    áudio
![[Document.pdf#page=3]]            PDF numa página específica
![[Document.pdf#height=400]]        altura do visualizador em pixels
![[My canvas.canvas]]               canvas
![[File.base#View]]                 base, com a view padrão especificada
```

## Características

- Funciona com qualquer um dos formatos aceitos — ver [[Attachment]]
- Para embedar uma **lista**, primeiro adicione um block identifier logo abaixo dela (`^my-list-id`), depois referencie com `![[Nota#^my-list-id]]`
- Se apenas a largura for especificada em uma imagem, ela escala proporcionalmente
- Imagens hospedadas externamente podem ser embedadas por link Markdown, com a mesma sintaxe de largura e altura
- No **desktop**, arrastar e soltar um arquivo suportado dentro da nota cria o embed automaticamente
- Em [[Base (Obsidian Bases)|Bases]], `![[File.base]]` usa a primeira view da lista; `![[File.base#View]]` especifica qual view

> [!warning] Canvas embedado mostra só as formas
> Um [[Canvas|canvas]] embedado exibe as shapes, **mas não o texto dentro dos cards**. Para ver o canvas completo, é preciso abri-lo diretamente.

> [!info] Com Wikilinks desativado
> A opção **Settings → Files and links → Use Wikilinks** governa a auto-geração de `[[links]]` e `![[images]]`. Desativada, o Obsidian passa a gerar links e imagens em formato Markdown — mas a autocompletar continua funcionando ao digitar `[[`, apenas produzindo o outro formato.

## Comparação

| | [[Internal Link (Wikilink)]] | Embed |
|---|---|---|
| Sintaxe | `[[Nota]]` | `![[Nota]]` |
| O que aparece | O nome, clicável | O conteúdo, renderizado |
| Custo de leitura | Navegação | Nenhuma — está ali |
| Gera [[Backlink\|backlink]] | Sim | Sim |
| Atualiza sozinho | O destino, ao renomear | O conteúdo, quando a fonte muda |
| Uso típico | Referenciar um conceito vizinho | Reaproveitar um trecho canônico |

## Veja também

- [[Internal Link (Wikilink)]]
- [[Block Reference]]
- [[Attachment]]
- [[Canvas]]
- [[Base (Obsidian Bases)]]
