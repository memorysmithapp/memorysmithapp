---
title: Event Driven Architecture
aliases:
  - Arquitetura Orientada a Eventos
  - EDA
  - Event-Driven
tags:
  - architecture
  - event-architectures
  - microservices
  - system-design
type: concept
status: evergreen
source: What do you mean by Event-Driven? — martinfowler.com, 2017
author: Martin Fowler (Thoughtworks)
created: 2026-07-25
---
> [!abstract]
> Event Driven Architecture não é um padrão único: é um guarda-chuva sobre quatro padrões distintos que as pessoas chamam pelo mesmo nome — e confundi-los é a principal fonte de fracasso nesses sistemas.

## Conceito

Depois de um workshop da Thoughtworks reunindo desenvolvedores seniores de todo o mundo, a conclusão principal foi desconfortável: **quando se fala em "eventos", fala-se de coisas bastante diferentes**. Distinguir os quatro padrões é pré-requisito para discutir qualquer decisão de arquitetura orientada a eventos.

## Os quatro padrões

### 1. Event Notification

O sistema emite eventos para avisar outros de uma mudança no seu domínio. O emissor **não se importa com a resposta**, e o evento costuma carregar pouca coisa — um identificador e um link de volta para consulta.

- ✅ Acoplamento baixíssimo, simples de montar
- ⚠️ O fluxo lógico deixa de existir no código: só é visível monitorando o sistema vivo, o que dificulta depurar e modificar

> [!warning] A armadilha do comando disfarçado
> Quando o emissor **espera** que o destinatário execute uma ação, aquilo é um comando, não um evento. Estilizá-lo como evento é passivo-agressivo e esconde a dependência real.

### 2. Event-Carried State Transfer

O evento carrega os dados que mudaram, de modo que o destinatário atualize sua própria cópia e nunca precise consultar a origem.

- ✅ Resiliência (funciona com a origem fora do ar), menor latência, menos carga na origem
- ⚠️ Muitos dados replicados e mais complexidade no receptor, que passa a manter estado

### 3. Event Sourcing

Toda mudança de estado é registrada como evento, e o estado é derivado do log. O melhor exemplo é o Git: o log de commits é o event store; a árvore de trabalho é o estado.

Ver [[Event Sourcing]].

> [!info] Dois mal-entendidos comuns
> Event sourcing **não exige assincronia** — atualizar um repositório Git local é síncrono. E **nem todo componente precisa conhecer o log**: o editor de texto ignora todos os commits, ele só vê o arquivo em disco.

### 4. CQRS

Estruturas de dados separadas para leitura e escrita. Estritamente **não é sobre eventos** — dá para usar CQRS sem nenhum evento. Aparece nessa lista porque é combinado com os outros com frequência.

Ver [[CQRS]].

## Comparação

| Padrão | O que o evento carrega | Acoplamento |
|---|---|---|
| **Event Notification** | Identificador e link | Mínimo |
| **Event-Carried State Transfer** | Os dados que mudaram | Baixo, com réplica local |
| **Event Sourcing** | A mudança em si, como fonte da verdade | Interno ao sistema |
| **CQRS** | (não necessariamente eventos) | Modelos separados |

> [!important]
> Todos os quatro são bons no terreno certo e ruins no errado. O problema é que **é impossível achar o terreno certo enquanto os padrões estiverem fundidos** — foi o que Fowler chamou de "core problem" ao tentar diagnosticar projetos fracassados.

## Fonte

- Martin Fowler, [What do you mean by "Event-Driven"?](https://martinfowler.com/articles/201701-event-driven.html), 2017

## Veja também

- [[Event Sourcing]]
- [[CQRS]]
- [[Domain Events]]
- [[Message Queue]]
- [[Event Streaming Platform]]
- [[Microservices]]
- [[System Design MOC]]
