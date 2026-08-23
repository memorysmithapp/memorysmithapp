---
title: ByteByteGo System Design Archive 04
aliases:
  - "Parte 4: Dados, Transações e Pipelines"
tags:
  - data
  - database
  - transaction-management
  - analytics
type: literature
status: evergreen
source: "BIG ARCHIVE: System Design 2023, ByteByteGo"
author: ByteByteGo (Alex Xu, Sahn Lam)
created: 2026-07-25
chapter: 4
---
## Parte 4: Dados, Transações e Pipelines

Reúne os tópicos do arquivo sobre **que garantias o armazenamento oferece** e como o dado percorre o caminho da origem até a análise.

## Resumo executivo

Toda a seção gira em torno de uma escolha só, apresentada em três roupagens diferentes: quanto de consistência se está disposto a trocar por disponibilidade e desempenho. ACID e BASE são as duas respostas extremas; os tipos de banco são as implementações que materializam cada uma; o pipeline de dados é onde a decisão reaparece na forma de batch contra stream.

O arquivo é útil aqui menos pela profundidade e mais por colocar os acrônimos lado a lado — inclusive apontando que o mesmo termo, *consistency*, significa coisas diferentes em ACID e no CAP.

## Principais ideias

- **ACID descreve garantias de transação**, e isolamento é uma escala, não um interruptor: serializabilidade é o topo, mas na prática se adota um nível mais frouxo por causa do custo.
- **O C do ACID não é o C do CAP.** No ACID, é a preservação das invariantes do banco; no CAP, é toda leitura receber a escrita mais recente. Nomes iguais, propriedades distintas.
- **BASE é a escolha oposta de ACID:** disponibilidade acima de consistência, com convergência ao longo do tempo.
- **A divisão que mais importa não é SQL × NoSQL**, é OLTP × OLAP — transações pequenas e concorrentes contra varreduras analíticas.
- **Índice não é um só.** Skiplist, hash index, SSTable, LSM Tree, B-Tree, inverted index, suffix tree e R-Tree resolvem problemas diferentes, e a estrutura escolhida muda o custo de escrita.
- **Pipeline de dados tem cinco fases** — coletar, ingerir, armazenar, computar, consumir — e sua eficácia é limitada pela fase mais fraca.
- **O próprio arquivo registra a crítica ao CAP:** classificar bancos como "CP" ou "AP" é estreito demais, citando *Please stop calling databases CP or AP*, de Martin Kleppmann.

> [!quote]
> "The BASE principle offers more flexibility, choosing availability over consistency. It states that the states will eventually be consistent."

## Conceitos apresentados

- [[ACID]] · [[BASE]] · [[CAP Theorem]]
- [[Tipos de Banco de Dados]] — relacional, OLAP, graph, key-value, document, column
- [[Database Index]] — as oito estruturas de dados que sustentam índices
- [[Data Pipeline]] — as cinco fases, batch e stream
- [[Database Sharding]] · [[Two-Phase Commit]] · [[Saga]]

## Exemplos

- **Visualização de uma query SQL:** parsing, transformação em representação interna, otimização com informação de índice e execução do plano.
- **Persistência do Redis:** AOF (log de comandos, gravado *depois* da execução em memória) e RDB (snapshot via `fork` do processo `bgsave`), combinados em produção.
- **Dez estruturas de dados do cotidiano**, de lista a r-tree, cada uma amarrada a um uso concreto.

---
Ref: [[ByteByteGo System Design Archive]], [[Eventual Consistency]], [[Data Lake]], [[Data Warehouse]], [[System Design MOC]]
