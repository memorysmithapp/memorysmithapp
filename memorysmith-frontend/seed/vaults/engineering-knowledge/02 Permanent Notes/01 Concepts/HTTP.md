---
title: HTTP
aliases:
  - HyperText Transfer Protocol
  - HTTP/2
  - HTTP/3
  - Verbos HTTP
tags:
  - protocols
  - networking
  - api
  - system-design
type: concept
status: evergreen
source: RFC 9110 HTTP Semantics — IETF, 2022
author: IETF HTTP Working Group
created: 2026-07-25
---
> [!abstract]
> HTTP é o protocolo cliente-servidor de requisição/resposta que sustenta praticamente toda troca de dados na Web — e cuja semântica de **verbos** e **códigos de status** é o contrato implícito de qualquer [[REST API]].

## Conceito

HTTP define como um cliente pede um recurso e como o servidor descreve o que fez com o pedido. Essa descrição é o que permite que intermediários — [[Content Delivery Network (CDN)]], [[API Gateway]], [[Load Balancer]], caches — tomem decisões corretas sem entender o domínio da aplicação.

## Verbos e idempotência

| Verbo | Efeito | Idempotente? |
|---|---|---|
| **GET** | Recupera um recurso | ✅ |
| **PUT** | Atualiza ou cria em um endereço conhecido | ✅ |
| **POST** | Cria um recurso novo | ❌ |
| **DELETE** | Remove um recurso | ✅ |
| **PATCH** | Modificação parcial | ❌ (na prática) |
| **HEAD** | Igual a GET, sem corpo na resposta | ✅ |
| **OPTIONS** | Descreve as opções de comunicação do recurso | ✅ |
| **CONNECT** | Estabelece um túnel até o servidor | — |
| **TRACE** | Teste de loop-back ao longo do caminho | ✅ |

> [!important] A tabela acima não é trivia de entrevista
> É o que decide se uma retentativa é segura. `POST` não é idempotente: dois `POST` idênticos criam dois recursos. É exatamente por isso que [[Idempotência]] precisa ser construída explicitamente sobre ele, com chave de idempotência. Ver [[Retry Pattern]].

## Classes de status

| Faixa | Significado |
|---|---|
| **1xx** | Informacional |
| **2xx** | Sucesso |
| **3xx** | Redirecionamento |
| **4xx** | Erro do cliente — **não vai passar a funcionar se repetido** |
| **5xx** | Erro do servidor — pode ter sucesso em nova tentativa |

## Evolução do protocolo

| Versão | Transporte | O que muda |
|---|---|---|
| **HTTP/1.1** | TCP | Uma requisição por vez na conexão; *head-of-line blocking* |
| **HTTP/2** | TCP | Multiplexação de streams e compressão de cabeçalho — base do [[gRPC]] |
| **HTTP/3** | **QUIC sobre UDP** | Elimina o bloqueio no nível do transporte; melhor em redes móveis |
| **HTTPS** | TLS sobre qualquer uma | Acrescenta cifragem e autenticação. Ver [[Transport Layer Security (TLS)]] |

## Fonte

- IETF, [RFC 9110 — HTTP Semantics](https://datatracker.ietf.org/doc/html/rfc9110), 2022

## Veja também

- [[REST API]]
- [[Transport Layer Security (TLS)]]
- [[Idempotência]]
- [[Estilos de Arquitetura de API]]
- [[API Gateway]]
- [[System Design MOC]]
