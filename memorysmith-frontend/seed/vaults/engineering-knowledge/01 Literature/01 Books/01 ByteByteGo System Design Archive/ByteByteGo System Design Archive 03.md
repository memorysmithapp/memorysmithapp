---
title: ByteByteGo System Design Archive 03
aliases:
  - "Parte 3: APIs, Protocolos e Segurança"
tags:
  - api
  - protocols
  - security
  - identity
type: literature
status: evergreen
source: "BIG ARCHIVE: System Design 2023, ByteByteGo"
author: ByteByteGo (Alex Xu, Sahn Lam)
created: 2026-07-25
chapter: 3
---
## Parte 3: APIs, Protocolos e Segurança

Reúne os tópicos do arquivo sobre **como os sistemas conversam entre si** e como essa conversa é protegida: estilos de API, protocolos de rede, gestão de identidade e criptografia.

## Resumo executivo

O arquivo trata protocolo e segurança como duas faces do mesmo assunto, e a leitura acumulada mostra por quê: cada estilo de API muda quem inicia a comunicação, e cada mudança dessas move a superfície de ataque de lugar. REST expõe URIs; GraphQL expõe um schema inteiro; WebSocket mantém conexão aberta; Webhook exige endpoint público. O conjunto de controles de segurança não é o mesmo para os quatro.

Na gestão de identidade, o fio condutor é a evolução do que trafega: primeiro a senha, depois o ID de sessão, depois o token, depois o token autocontido e assinado. Cada passo elimina um estado no servidor e cria um problema novo — o último deles, revogar.

## Principais ideias

- **REST é um estilo, não um formato.** Seis restrições, cada uma com um custo declarado. A que quase ninguém implementa — HATEOAS — é justamente a que distingue REST de "API HTTP com JSON".
- **A escolha do estilo de API é sobre controle, não sintaxe.** Quem inicia a comunicação e quem define o formato da resposta são as duas perguntas que separam REST, GraphQL, gRPC, WebSocket e Webhook.
- **Idempotência é uma propriedade do verbo HTTP, não da implementação.** `GET`, `PUT` e `DELETE` são idempotentes; `POST` não é. É o que decide se uma retentativa é segura.
- **A escada da identidade** vai de WWW-Authenticate a OAuth 2.0, passando por sessão-cookie, token, JWT e SSO. Cada degrau resolve a limitação do anterior.
- **OAuth autoriza, OpenID Connect autentica.** O arquivo trata os fluxos OAuth sem essa distinção, e ela é a origem de boa parte das implementações inseguras.
- **TLS combina os dois tipos de criptografia**: assimétrica no handshake para estabelecer a chave, simétrica depois para o volume. Nenhuma das duas resolveria sozinha.
- **Salt não basta.** O arquivo recomenda `hash(senha + salt)`; a orientação atual da OWASP é mais estrita — algoritmos lentos e adaptativos com work factor configurável.

> [!quote]
> "Unlike REST, which always 'pulls' data, WebSocket enables data to be 'pushed'."

> [!warning] Ponto em que a fonte está desatualizada
> O arquivo apresenta **Implicit Flow** e **Resource Owner Password Grant** como opções válidas de OAuth 2.0. A IETF classifica ambos como legado. As notas extraídas registram a correção com a fonte primária.

## Conceitos apresentados

- [[Estilos de Arquitetura de API]] — SOAP, REST, GraphQL, gRPC, WebSocket, Webhook
- [[REST API]] · [[GraphQL]] · [[gRPC]] · [[WebSocket]] · [[Webhook]]
- [[HTTP]] — verbos, códigos de status e a evolução até HTTP/3 sobre QUIC
- [[OAuth 2.0]] · [[JSON Web Token (JWT)]] · [[Single Sign-On (SSO)]] · [[Gerenciamento de Sessão]]
- [[Transport Layer Security (TLS)]] · [[Criptografia Simétrica e Assimétrica]]
- [[Armazenamento Seguro de Senhas]] · [[Segurança de API]]

## Exemplos

- **Oito protocolos de rede em um diagrama:** HTTP, HTTP/3 sobre QUIC, HTTPS, WebSocket, TCP, UDP, SMTP e FTP — com a distinção prática entre TCP (entrega garantida) e UDP (tempo-sensível, tolera perda).
- **gRPC é apontado como ~5× mais rápido que JSON** graças à codificação binária e às otimizações de HTTP/2.
- **Gerenciador de senhas e autenticador TOTP** aparecem como estudos de caso de criptografia aplicada.

---
Ref: [[ByteByteGo System Design Archive]], [[API Gateway]], [[Microservices]], [[Idempotência]], [[System Design MOC]]
