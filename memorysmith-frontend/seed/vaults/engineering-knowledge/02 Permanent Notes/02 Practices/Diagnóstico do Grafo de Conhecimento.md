---
title: Diagnóstico do Grafo de Conhecimento
aliases:
  - Knowledge Graph Diagnosis
  - Diagnóstico do Grafo
  - Auditoria do Grafo
tags:
  - obsidian
  - graph
  - linking
  - pkm
  - practice
type: practice
status: evergreen
source: Obsidian Help — obsidian.md/help
author: Obsidian
created: 2026-08-07
---
O Graph view não serve para admirar a rede — serve para encontrar os defeitos dela: notas sem nenhum link de entrada, links apontando para arquivos que não existem, clusters que deveriam se tocar e não se tocam. A prática é uma rotina de inspeção com filtros, groups e forces, seguida da correção — converter unlinked mentions em links reais — e tem um equivalente auditável por linha de comando.

## Dinâmica / Passo a Passo

1. **Abra o grafo** por **Open graph view** na ribbon. Círculos são notas, linhas são internal links; quanto mais notas referenciam um nó, maior ele fica. As configurações abrem pelo ícone de engrenagem no canto superior direito, e **Restore default settings** desfaz qualquer experimento.
2. **Ative o filtro Orphans** para exibir as notas sem link nenhum. É a primeira lista de trabalho: cada órfã ou ganha uma ligação ou não deveria existir.
3. **Desligue Existing files only** para ver os links não resolvidos. Como não é preciso que a nota exista para linkar para ela, esses nós são promessas de nota — intenções registradas que ainda não viraram arquivo.
4. **Silencie o ruído** desligando **Tags** e **Attachments** nos filtros. Sem isso, hubs de tag e imagens dominam a topologia e escondem a estrutura conceitual.
5. **Crie Groups coloridos por search term:** **New group**, digite o termo de busca e escolha a cor. Um group por `type` (`[type:concept]`, `[type:practice]`, `[type:literature]`) transforma o grafo numa leitura de camadas em vez de uma nuvem uniforme.
6. **Ajuste as Forces para separar clusters.** **Repel force** afasta os nós, **Link force** controla a tensão dos links como um elástico, **Link distance** define o comprimento das linhas e **Center force** define quão compacto e circular fica o conjunto. Aumentar repel e reduzir center é o que faz as pontes — as poucas notas que conectam dois clusters — ficarem visíveis.
7. **Use o Local graph para a nota nova.** Comando **Open local graph**: em vez do vault inteiro, mostra as notas conectadas à nota ativa. O slider de **Depth**, no topo do painel de filtros do grafo local, revela a cada nível as notas conectadas às reveladas no nível anterior — é a checagem de vizinhança de uma nota recém-escrita.
8. **Converta unlinked mentions nas duas direções.** No painel **Backlinks**, a seção **Unlinked mentions** lista ocorrências não linkadas do nome da nota ativa em outras notas; no painel **Outgoing links**, a seção homônima lista textos *dentro* da nota ativa que casam com o nome ou o alias de outra nota. Clicar no botão com o nome da nota cria o link.
9. **Repita o diagnóstico por CLI** quando quiser um registro reproduzível em vez de uma impressão visual:

```shell
obsidian orphans          # arquivos sem links de entrada
obsidian deadends         # arquivos sem links de saída
obsidian unresolved verbose format=json   # links não resolvidos, com os arquivos de origem
obsidian backlinks file="Graph View" counts
```

## Regras

- **Excluded files nunca aparecem no grafo.** Arquivos que casam com os padrões de **Settings → Excluded files** somem do Graph view, da busca e das Unlinked mentions — uma órfã invisível pode simplesmente estar excluída, não conectada.
- **Links vindos de diagramas Mermaid não entram no Graph view.** *"Internal links from diagrams don't show up in the Graph view."* Uma nota conectada só por diagrama aparece como órfã.
- **Grafos locais não são bookmarkáveis.** Grafos globais sim — botão direito na aba do grafo → **Bookmark** —, mas o local, não; ele é ferramenta de inspeção momentânea, não vista salva.
- **Órfã e dead end são defeitos diferentes.** `orphans` lista o que ninguém cita; `deadends`, o que não cita ninguém. A primeira é falha de indexação; a segunda, falha de contextualização.
- **Link dentro de code block não conta.** Ele pode ser criado a partir de uma unlinked mention, mas não aparece na seção Links — logo, não aparece no diagnóstico.
- **Mudanças de configuração do graph view exigem reload** para propagar quando sincronizadas entre dispositivos.

## Exemplo

Rotina mensal em três passos. Primeiro, `obsidian orphans` devolve 14 arquivos; 9 são notas de literatura recém-clipadas que ainda não foram processadas — trabalho legítimo de inbox — e 5 são notas permanentes, defeito real. Segundo, `obsidian unresolved counts` mostra que `[[Metadata Cache]]` é referenciado 7 vezes sem existir: a nota mais pedida do vault ainda não foi escrita, e essa contagem é a fila de prioridade. Terceiro, para cada uma das 5 órfãs permanentes, abre-se o **Local graph** com Depth 2 e o painel **Outgoing links**, e as unlinked mentions viram links — o que costuma resolver as cinco sem inventar nenhuma ligação artificial.

---
Ref: [[Graph View]], [[Backlink]], [[Unlinked Mention]], [[Internal Link (Wikilink)]], [[Obsidian CLI]], [[Knowledge Graph]], [[Busca Avançada no Obsidian]]
