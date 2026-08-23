---
title: Estruturas de Dados
aliases:
  - Data Structures
tags:
  - computing
  - algorithms
  - system-design
type: concept
status: evergreen
source: 10 Key Data Structures We Use Every Day — BIG ARCHIVE System Design 2023
author: ByteByteGo (Alex Xu, Sahn Lam)
created: 2026-07-25
---
> [!abstract]
> Estrutura de dados é a forma como a informação é organizada na memória — e essa escolha determina quais operações são baratas e quais serão sempre caras.

## Conceito

Nenhuma estrutura é boa em tudo. Cada uma otimiza um conjunto de operações às custas de outro: o que é O(1) em uma é O(n) na outra. Escolher é decidir **qual operação vai acontecer com mais frequência**.

## As que aparecem no dia a dia

| Estrutura | Onde aparece |
|---|---|
| **Lista** | Feed de rede social |
| **Pilha** | Desfazer e refazer no editor |
| **Fila** | Trabalhos de impressão, ações de jogador |
| **Hash table** | Sistemas de cache — base de [[Distributed Cache]] |
| **Array** | Operações matemáticas |
| **Heap** | Agendamento de tarefas |
| **Árvore** | Documento HTML, árvore de decisão |
| **Suffix tree** | Busca de texto dentro de um documento |
| **Grafo** | Rede de amizades, busca de caminho |
| **R-tree** | Vizinho mais próximo, dados geográficos |
| **Vertex buffer** | Envio de dados para a GPU |

## A ponte com banco de dados

> [!important]
> As estruturas acima não ficam na aplicação: são exatamente as que sustentam os índices. Skiplist no Redis, hash index para busca por igualdade, B-Tree em bancos relacionais, LSM Tree em cargas de escrita intensa, inverted index em busca textual, R-tree em dados espaciais.
>
> É por isso que "qual índice usar" e "qual estrutura de dados usar" são a mesma pergunta em níveis diferentes. Ver [[Database Index]].

> [!tip]
> Em System Design, a escolha da estrutura raramente aparece explícita — ela vem embutida na escolha do banco, do cache ou da fila. Reconhecer a estrutura por trás do componente é o que permite prever seu comportamento sob carga.

## Fonte

- ByteByteGo, *10 Key Data Structures We Use Every Day* e *What are the data structures used in daily life?* — BIG ARCHIVE: System Design 2023

## Veja também

- [[Database Index]]
- [[Distributed Cache]]
- [[Message Queue]]
- [[Linguagem Compilada e Interpretada]]
- [[System Design MOC]]
