---
title: Internal Link (Wikilink)
aliases:
  - Wikilink
  - Link Interno
  - Internal Link
tags:
  - obsidian
  - linking
  - markdown
  - pkm
type: concept
status: evergreen
source: Obsidian Help — obsidian.md/help
author: Obsidian
created: 2026-08-07
---
> [!abstract]
> **Internal link** é a referência de uma nota a outro arquivo do mesmo [[Vault]], escrita como wikilink `[[Nota]]` ou como link Markdown `[Nota](Nota.md)`, e é o mecanismo que transforma arquivos soltos em rede de conhecimento.

## Conceito

O link interno é a unidade elementar da rede. Tudo o que o Obsidian oferece de navegação derivada — [[Backlink]], [[Graph View]], [[Unlinked Mention]] — é leitura do conjunto de links internos indexado no [[Metadata Cache]]. Escrever um link não é decorar o texto: é declarar uma aresta.

> [!quote]
> Links are first-class citizens.

Os dois formatos suportados são equivalentes — apontam para a mesma nota e aparecem igual no editor. O wikilink é o default por ser mais compacto; o Markdown link existe para quem prioriza interoperabilidade fora do Obsidian. Ver [[Data Portability]].

## Sintaxe

```md
[[Three laws of motion]]
[[Three laws of motion.md]]
[Three laws of motion](Three%20laws%20of%20motion)
[Three laws of motion](Three%20laws%20of%20motion.md)

[[Projects/Three laws of motion]]        <!-- caminho a partir da raiz do vault -->
[[Example|Custom name]]                  <!-- display text -->
[[About Obsidian#Links are first-class citizens]]
[[Help and support#Questions and advice#Report bugs and request features]]
[[## team]]                              <!-- busca headings em todo o vault -->
[[Figure 1.png]]                         <!-- não-Markdown exige extensão -->
```

> [!warning]
> No formato Markdown o destino precisa ser **URL-encoded**: espaço vira `%20`. Caminhos de pasta partem da raiz do vault e usam barra normal (`/`) **mesmo no Windows**.

## Características

- **Settings → Files and links → New link format** define o link auto-gerado: `Shortest path when possible`, `Relative path to file` ou `Absolute path in vault`.
- **Use Wikilinks** desligado faz o Obsidian gerar Markdown links — o autocomplete por `[[` continua funcionando e produz o link Markdown.
- **Automatically update internal links** atualiza os links ao renomear um arquivo; desligado, o Obsidian pergunta antes.
- Criar link: digitar `[[`, selecionar texto e digitar `[[`, ou comando **Add internal link**.
- Link para nota inexistente aparece com cor mais apagada; `Ctrl`/`Cmd`+clique cria a nota. Se o link tem caminho de pasta, a nota nasce **naquele caminho**, sobrepondo o `Default location for new notes`.
- Prefixar com `!` transclui em vez de linkar — ver [[Embed (Transclusão)]].
- Caracteres a evitar no nome: `# | ^ : %% [[ ]]`.
- Hover com [[Live Preview]] e Page preview mostra o conteúdo do destino (`Ctrl`/`Cmd` em modo de edição).
- Arquivos em **Excluded files** são despriorizados nas sugestões de link.
- A partir de **10.000 itens** no vault, o autocomplete troca para um algoritmo de resultado mais simples para preservar performance.

## Comparação

| | Wikilink | Markdown link |
|---|---|---|
| Sintaxe | `[[Nota]]` | `[Nota](Nota%20.md)` |
| Encoding | Não exige | **URL-encode obrigatório** |
| Display text | `\|` | `[Texto](destino)` |
| Default | Sim, por ser compacto | Opcional, via `Use Wikilinks` off |
| Fora do Obsidian | Suporte limitado | Markdown padrão |

## Veja também

- [[Backlink]]
- [[Alias (Obsidian)]]
- [[Block Reference]]
- [[Graph View]]
- [[Embed (Transclusão)]]
- [[Ligar Notas em Três Granularidades]]
