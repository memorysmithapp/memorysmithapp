---
title: ACID
aliases:
  - Atomicidade Consistência Isolamento Durabilidade
  - Transação ACID
tags:
  - database
  - transaction-management
  - system-design
type: concept
status: evergreen
source: What does ACID mean? — BIG ARCHIVE System Design 2023; Designing Data-Intensive Applications, cap. 7
author: ByteByteGo (Alex Xu, Sahn Lam) · Martin Kleppmann
created: 2026-07-25
---
> [!abstract]
> ACID são as quatro garantias que uma transação de banco de dados oferece: **atomicidade**, **consistência**, **isolamento** e **durabilidade**.

## Conceito

Uma transação agrupa várias operações em uma unidade lógica. As quatro letras descrevem o que o banco promete sobre essa unidade — e é o conjunto dessas promessas que permite ao desenvolvedor raciocinar sobre concorrência e falha sem tratar cada caso à mão.

| Letra | Garantia |
|---|---|
| **Atomicity** | As escritas acontecem todas de uma vez e não podem ser quebradas em partes. Se algo falha no meio, tudo é revertido. "Tudo ou nada" |
| **Consistency** | Preservação das invariantes do banco. O dado escrito deve ser válido segundo todas as regras definidas e manter o banco em estado bom |
| **Isolation** | Escritas concorrentes de duas transações ficam isoladas uma da outra |
| **Durability** | Depois do commit, o dado sobrevive a falha do sistema |

## Isolamento é uma escala, não um interruptor

O nível mais estrito é a **serializabilidade**: cada transação se comporta como se fosse a única rodando no banco. É difícil de implementar com desempenho aceitável, então na prática se adota um nível mais frouxo — *read committed*, *repeatable read*, *snapshot isolation* — cada um permitindo anomalias específicas.

> [!important] O C do ACID não é o C do [[CAP Theorem]]
> A confusão é constante e vale fixar:
>
> - **Consistency no ACID** = as invariantes do banco continuam válidas. É responsabilidade de quem escreve a transação, assistida por constraints
> - **Consistency no CAP** = toda leitura recebe a escrita mais recente ou um erro. É sobre replicação e visibilidade entre nós
>
> São propriedades diferentes com o mesmo nome. Ver também [[Eventual Consistency]].

## Em sistema distribuído

Durabilidade em um único nó significa gravar em disco. Em sistema distribuído, significa **replicar para outros nós** — o disco local pode simplesmente desaparecer.

> [!warning]
> ACID vale dentro de **uma** base. Quando a transação de negócio atravessa serviços com bases distintas, as garantias não se estendem: é o problema que [[Two-Phase Commit]] tenta resolver e que [[Saga]] contorna, pagando com o isolamento.

## Fonte

- ByteByteGo, *What does ACID mean?* — BIG ARCHIVE: System Design 2023
- Martin Kleppmann, *Designing Data-Intensive Applications*, cap. 7 "Transactions", O'Reilly, 2017

## Veja também

- [[BASE]]
- [[CAP Theorem]]
- [[Two-Phase Commit]]
- [[Saga]]
- [[Tipos de Banco de Dados]]
- [[System Design MOC]]
