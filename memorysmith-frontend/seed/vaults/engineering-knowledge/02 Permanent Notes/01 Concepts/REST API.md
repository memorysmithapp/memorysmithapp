---
title: REST API
aliases:
  - REST
  - Representational State Transfer
  - RESTful
tags:
  - api
  - architecture
  - http
  - system-design
type: concept
status: evergreen
source: Architectural Styles and the Design of Network-based Software Architectures, cap. 5 — UC Irvine, 2000
author: Roy T. Fielding
created: 2026-07-25
---
> [!abstract]
> REST é um **estilo arquitetural**, não um protocolo: um conjunto de restrições que, aplicadas a um sistema distribuído de hipermídia, induzem as propriedades que fizeram a Web escalar.

## Conceito

O erro mais comum é tratar REST como sinônimo de "API HTTP com JSON". REST é o conjunto de **restrições** que Fielding derivou ao explicar por que a arquitetura da Web funciona. Cada restrição é uma troca deliberada: abre-se mão de algo para ganhar outra coisa.

## As seis restrições

| Restrição | O que impõe | O que induz | O que custa |
|---|---|---|---|
| **Cliente-servidor** | Separação entre interface e armazenamento | Evolução independente dos dois lados | — |
| **Stateless** | Cada requisição carrega tudo que é preciso para entendê-la; o estado de sessão vive no cliente | Visibilidade, confiabilidade, escalabilidade | Overhead repetido a cada requisição |
| **Cache** | A resposta é rotulada como cacheável ou não | Elimina interações inteiras, reduz latência percebida | Dado obsoleto pode divergir da origem |
| **Interface uniforme** | Mesma interface genérica para todo recurso | Simplicidade, visibilidade, evolução independente | Menos eficiente que uma interface sob medida |
| **Sistema em camadas** | Cada componente só enxerga a camada adjacente | Limita a complexidade, permite intermediários, [[Load Balancer]] e firewall | Acrescenta latência de processamento |
| **Code-on-demand** *(opcional)* | O cliente pode baixar e executar código | Extensibilidade do cliente | Reduz a visibilidade |

## Os quatro pilares da interface uniforme

1. **Identificação de recursos** — cada recurso tem um identificador (URI)
2. **Manipulação por representações** — o cliente manipula a representação, não o recurso em si
3. **Mensagens autodescritivas** — a mensagem carrega o suficiente para ser processada por intermediários
4. **HATEOAS** — hipermídia como motor do estado da aplicação: as próximas transições vêm nos links da resposta

> [!warning] A restrição que quase ninguém cumpre
> HATEOAS é o que separa uma API REST de uma API HTTP comum, e é justamente a mais ignorada. A maioria das APIs chamadas de "RESTful" implementa as outras cinco restrições e trata URIs como contrato fixo documentado fora da resposta.

> [!important] Stateless não é sem estado
> A restrição elimina o **estado de sessão no servidor**, não o estado do recurso. É isso que permite que qualquer instância atenda qualquer requisição — pré-requisito prático de [[Load Balancer]] com round-robin e de escala horizontal em [[Microservices]].

## Fonte

- Roy T. Fielding, [Architectural Styles and the Design of Network-based Software Architectures — cap. 5: Representational State Transfer (REST)](https://www.ics.uci.edu/~fielding/pubs/dissertation/rest_arch_style.htm), UC Irvine, 2000

## Veja também

- [[HTTP]]
- [[Estilos de Arquitetura de API]]
- [[GraphQL]]
- [[gRPC]]
- [[API Gateway]]
- [[Estratégias de Cache]]
- [[System Design MOC]]
