---
title: Single-Table Design
aliases:
  - Modelagem de Tabela Única
  - Partition Key Pattern
  - Composite Key
tags:
  - nosql
  - data-modeling
  - aws
  - system-design
type: concept
status: evergreen
source: Amazon DynamoDB Developer Guide (NoSQL Design); Integrated Architecture Guide (PWA + AWS Serverless)
author: Amazon Web Services
created: 2026-07-25
---
> [!abstract]
> Single-Table Design é a técnica de modelagem NoSQL em que entidades de tipos diferentes convivem na mesma tabela, distinguidas por chaves compostas construídas a partir dos padrões de acesso.

## Conceito

A modelagem relacional normaliza para evitar redundância e depois reconstrói a visão com `JOIN`. Em um banco chave-valor distribuído não existe `JOIN` — e a tentativa de simulá-lo com várias consultas sequenciais multiplica latência e custo.

A inversão é essa: **o modelo não descreve as entidades, descreve as perguntas**. Escreve-se primeiro a lista de padrões de acesso ("listar os pedidos de um cliente por data", "buscar o perfil de um membro") e só então se desenha a chave que responde a cada um em uma única leitura.

## Chave composta

```
PK = "TENANT#{tenantId}#PEDIDO#{pedidoId}"
SK = "PROFILE"                       ← registro único da entidade
SK = "2026-01-01T00:00:00Z"          ← série temporal, ordenável
SK = "ITEM#{itemId}"                 ← coleção filha, consultável por begins_with
```

A chave carrega **significado estruturado**, não apenas um identificador. Isso é o que permite:

| Padrão de acesso | Como a chave resolve |
|---|---|
| Buscar uma entidade | `GetItem` com PK e SK exatos |
| Listar os filhos de um pai | `Query` com PK do pai e `begins_with(SK, 'ITEM#')` |
| Listar por faixa de tempo | `Query` com `between` no SK temporal |
| Isolar um tenant | Prefixo `TENANT#` — a partição de um cliente é fisicamente inalcançável a partir da de outro |

## Prefixo de tenant como invariante

Em [[Multi-Tenancy]], o prefixo `TENANT#{id}` na PK deixa de ser convenção e vira **regra estrutural**: é matematicamente impossível uma `Query` retornar dados de outro tenant se ela precisa da PK completa para existir. O isolamento passa a ser propriedade do modelo, não disciplina do desenvolvedor.

## Item Collection e o limite de 10 GB

Todos os itens que compartilham a mesma PK formam uma *item collection* e vivem na mesma partição física. Isso é o que torna a leitura barata — e também o teto:

> [!warning] Partição quente
> Uma PK que concentra escrita (um contador global, um tenant gigante, um `PK = "LOG"`) satura a capacidade daquela partição enquanto o resto da tabela está ociosa. Distribua com sufixo aleatório (*write sharding*) ou reveja a granularidade da chave.

## Trade-offs honestos

| Ganha | Perde |
|---|---|
| Uma leitura por tela, latência previsível | Legibilidade — a tabela é ilegível sem a documentação do modelo |
| Custo mínimo de leitura | Flexibilidade — pergunta nova pode exigir GSI novo ou *backfill* |
| Transação atômica dentro da coleção | Ferramental de BI direto (a análise vai para [[Amazon Athena]]) |

> [!important] Tabela única não é dogma
> "Single-table" descreve a técnica de chave composta, não a proibição de ter mais de uma tabela. Domínios sem relação de acesso entre si — com ciclos de vida, requisitos de retenção e volumes diferentes — ficam melhor em tabelas separadas, cada uma internamente modelada com a mesma técnica.

## Veja também

- [[Amazon DynamoDB]]
- [[Multi-Tenancy]]
- [[Database Sharding]]
- [[Database Index]]
- [[Tipos de Banco de Dados]]
