---
title: UDP
aliases:
  - User Datagram Protocol
  - Datagrama
  - QUIC
tags:
  - networking
  - protocols
  - system-design
type: concept
status: evergreen
source: RFC 768 User Datagram Protocol — IETF, 1980
author: Jon Postel (IETF)
created: 2026-07-25
---
> [!abstract]
> UDP envia datagramas ao destino **sem estabelecer conexão** e sem garantir entrega, ordem ou unicidade — e é exatamente essa ausência de garantias que o torna útil.

## Conceito

[[TCP]] resolve a falta de confiabilidade da rede pagando com latência: handshake, confirmação, retransmissão, ordenação. Existe uma classe de aplicações para as quais esse preço não faz sentido, porque **o dado atrasado já não vale nada**.

Em voz e vídeo, retransmitir um quadro perdido é inútil: quando ele chegar, o momento já passou. Perder um pacote ocasionalmente é melhor do que esperar.

## Comparação

| | **TCP** | **UDP** |
|---|---|---|
| Conexão | Estabelecida antes | Nenhuma |
| Entrega | Garantida | Melhor esforço |
| Ordem | Preservada | Não garantida |
| Duplicatas | Eliminadas | Possíveis |
| Controle de fluxo e congestionamento | Sim | Não |
| Overhead de cabeçalho | 20+ bytes | 8 bytes |
| Latência inicial | Handshake | Zero |

## Onde é usado

- **Voz e vídeo em tempo real** — tolerar perda é melhor que esperar
- **DNS** — consulta e resposta cabem em um datagrama; ver [[DNS]]
- **Jogos online** — posição desatualizada é descartável
- **QUIC / HTTP/3** — reconstrói confiabilidade **no espaço de usuário**, sobre UDP

> [!important] QUIC é a reviravolta
> Ironicamente, o protocolo web mais recente abandonou TCP e foi para UDP. O motivo é o *head-of-line blocking*: em TCP, a perda de um pacote trava todos os streams multiplexados. QUIC reimplementa confiabilidade e controle de congestionamento por cima de UDP, com cada stream independente — e ainda funde o handshake de transporte com o de [[Transport Layer Security (TLS)]].
>
> A lição é que "UDP não é confiável" descreve o protocolo, não o que se pode construir sobre ele.

## Fonte

- IETF, [RFC 768 — User Datagram Protocol](https://datatracker.ietf.org/doc/html/rfc768), 1980

## Veja também

- [[TCP]]
- [[Modelo OSI]]
- [[DNS]]
- [[HTTP]]
- [[Latency Numbers]]
- [[System Design MOC]]
