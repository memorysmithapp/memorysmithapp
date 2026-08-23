---
title: Hexagonal Architecture
aliases:
  - Ports and Adapters
  - Arquitetura Hexagonal
  - Portas e Adaptadores
tags:
  - architecture
  - design
  - ddd
  - software-engineering
type: concept
status: evergreen
source: Alistair Cockburn, "Hexagonal Architecture (Ports and Adapters)"
author: Alistair Cockburn
created: 2026-07-25
---
> [!abstract]
> Arquitetura hexagonal isola a lógica de negócio de toda tecnologia externa através de **portas** — interfaces definidas pelo domínio — implementadas por **adaptadores** que traduzem o mundo exterior para elas.

## Conceito

A formulação original de Cockburn ataca um sintoma específico: a regra de negócio que só é executável dentro de um servidor, com um banco de pé e um cliente HTTP chamando. Quando o domínio depende de infraestrutura, ele não é testável isoladamente, não é portável, e cada troca de tecnologia vira reescrita.

A inversão é simples de enunciar e difícil de sustentar: **a dependência aponta sempre para dentro**. O domínio define a interface de que precisa (`RepositorioDePedidos`); a infraestrutura a implementa. O domínio nunca importa nada da infraestrutura.

```mermaid
flowchart LR
    subgraph Adaptadores primários
    H[Handler HTTP]
    E[Consumidor de evento]
    T[Teste]
    end
    subgraph Núcleo
    A[Aplicação<br/>casos de uso]
    D[Domínio<br/>entidades · regras · invariantes]
    A --> D
    end
    subgraph Adaptadores secundários
    R[(Repositório)]
    B[Barramento de eventos]
    X[API externa]
    end
    H --> A
    E --> A
    T --> A
    A -.porta.-> R
    A -.porta.-> B
    A -.porta.-> X
```

## Primários × secundários

| | **Primário** (driving) | **Secundário** (driven) |
|---|---|---|
| Quem inicia | O adaptador chama o núcleo | O núcleo chama o adaptador |
| Exemplos | Handler HTTP, consumidor de fila, CLI, teste | Repositório, publicador de eventos, cliente de API externa |
| A porta é | O caso de uso exposto | A interface exigida pelo domínio |

## Em contexto serverless

O `handler.ts` de uma função é apenas um **adaptador primário**: traduz o evento do provedor em uma chamada de caso de uso e o resultado em resposta HTTP. Ele não contém regra.

Isso tem um efeito prático que compensa o esforço: a mesma regra de negócio serve a uma rota HTTP, a um consumidor de fila e a um trigger de stream, sem duplicação — porque nenhum dos três está dentro dela. E o teste do domínio roda em milissegundos, sem emular a nuvem.

```
lambda/{dominio}/
├── criar.handler.ts          ← adaptador primário (fino)
├── domain/                   ← entidades, objetos de valor, invariantes
├── application/              ← casos de uso; define as portas
└── infrastructure/           ← adaptadores secundários (repositório, SDK)
```

> [!warning] O custo é real
> Hexagonal introduz indireção. Em um CRUD trivial, a interface e o adaptador podem ser cerimônia pura. O critério é a densidade de regra: onde há invariante de negócio a proteger, o isolamento paga; onde é passa-dado, ele só adiciona arquivos.

## Veja também

- [[Domain Driven Design]]
- [[Bounded Context]]
- [[Microservices]]
- [[Arquitetura Evolutiva]]
- [[AWS Lambda]]
