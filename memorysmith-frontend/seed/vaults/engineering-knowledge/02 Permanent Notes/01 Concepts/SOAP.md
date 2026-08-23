---
title: SOAP
aliases:
  - Simple Object Access Protocol
  - WSDL
  - Web Services
tags:
  - api
  - protocols
  - architecture
  - system-design
type: concept
status: evergreen
source: SOAP Version 1.2 Part 1 Messaging Framework — W3C Recommendation, 2007
author: W3C XML Protocol Working Group
created: 2026-07-25
---
> [!abstract]
> SOAP é um protocolo de troca de mensagens em **XML**, com contrato formal descrito em WSDL — o estilo maduro e cerimonioso que precedeu [[REST API]] no mundo corporativo.

## Conceito

Onde REST é um estilo com convenções, SOAP é um **protocolo com especificação**. A mensagem tem envelope, cabeçalho e corpo definidos por esquema; o contrato do serviço é publicado em WSDL, a partir do qual cliente e servidor podem ser gerados automaticamente.

Essa formalidade é o ponto: em integração entre empresas, com contrato jurídico por trás, ter o esquema validando cada campo vale o peso do XML.

## Características

| Aspecto | SOAP |
|---|---|
| Formato | XML, sempre |
| Contrato | WSDL, formal e verificável |
| Transporte | Independente — HTTP, SMTP, filas |
| Extensões | WS-Security, WS-ReliableMessaging, WS-AtomicTransaction |
| Estado | Suporta transação distribuída padronizada |

## Comparação

| | **SOAP** | **[[REST API]]** |
|---|---|---|
| Natureza | Protocolo | Estilo arquitetural |
| Payload | XML | Livre, na prática JSON |
| Contrato | WSDL, obrigatório | Opcional (OpenAPI) |
| Verbosidade | Alta | Baixa |
| Curva de adoção | Íngreme | Suave |
| Onde sobrevive | Bancos, seguros, governo, ERP | Web em geral |

> [!important] Não está morto, está entrincheirado
> SOAP continua operando em sistemas financeiros, seguradoras e governo — justamente onde as extensões WS-* entregam o que REST deixa para o desenvolvedor resolver: assinatura em nível de mensagem, entrega confiável e transação distribuída padronizada.
>
> Quem integra sistemas legados vai encontrá-lo. Ver [[Strangler Fig]] para a estratégia de substituição gradual.

> [!warning]
> A cerimônia do SOAP não é gratuita nem inútil: é o preço de garantias que [[gRPC]] recuperou em parte, com contrato formal e geração de código, mas em formato binário e com um décimo do peso.

## Fonte

- W3C, [SOAP Version 1.2 Part 1: Messaging Framework](https://www.w3.org/TR/soap12-part1/), 2007

## Veja também

- [[Estilos de Arquitetura de API]]
- [[REST API]]
- [[gRPC]]
- [[Versionamento de API]]
- [[Strangler Fig]]
- [[System Design MOC]]
