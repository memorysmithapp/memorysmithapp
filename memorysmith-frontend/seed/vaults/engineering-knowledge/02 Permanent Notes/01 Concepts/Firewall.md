---
title: Firewall
aliases:
  - Firewall de Rede
  - Security Group
  - WAF
tags:
  - networking
  - security
  - infrastructure
  - system-design
type: concept
status: evergreen
source: NIST SP 800-41 Rev. 1 Guidelines on Firewalls and Firewall Policy — NIST, 2009
author: NIST
created: 2026-07-25
---
> [!abstract]
> Firewall é o dispositivo ou serviço que **decide o que pode atravessar** uma fronteira de rede, aplicando uma política de permissão e bloqueio ao tráfego.

## Conceito

A premissa é a segmentação: se toda rede fosse um espaço plano, alcançar um host seria alcançar todos. O firewall define fronteiras e obriga o tráfego a passar por um ponto onde a política é avaliada.

A regra de ouro é **negar por padrão**: bloqueia-se tudo e libera-se explicitamente o necessário. A postura inversa — permitir tudo e bloquear o conhecido — falha silenciosamente contra qualquer coisa não catalogada.

## Tipos, por camada

| Tipo | Camada do [[Modelo OSI]] | O que avalia |
|---|---|---|
| **Filtro de pacotes** | 3–4 | IP de origem e destino, porta, protocolo — sem estado |
| **Stateful inspection** | 3–4 | Idem, mas rastreia o estado da conexão |
| **Gateway de aplicação** | 7 | Conteúdo do protocolo — proxy que entende HTTP, SMTP |
| **WAF** | 7 | Ataques em aplicação web: injeção, XSS, abuso de API |

## Na nuvem

O firewall deixa de ser uma caixa e vira **regra declarada**:

- **Security group** — firewall stateful na interface de rede da instância
- **Network ACL** — filtro sem estado na fronteira da [[Subnet]]
- **[[Rate Limiting]] e WAF na borda** — descartam tráfego abusivo antes de chegar à aplicação, o que é também uma camada de [[Load Shedding]]

> [!important] Perímetro não basta
> O modelo clássico assume "dentro é confiável, fora não é". Um atacante que atravessa o perímetro — ou uma credencial vazada — passa a se mover livremente. É essa premissa que [[Zero Trust]] abandona.

> [!tip]
> Firewall e [[NAT]] costumam rodar no mesmo equipamento e são confundidos. NAT traduz endereço; firewall aplica política. Estar atrás de NAT não é estar protegido por firewall.

## Fonte

- NIST, [SP 800-41 Rev. 1 — Guidelines on Firewalls and Firewall Policy](https://csrc.nist.gov/pubs/sp/800/41/r1/final), 2009

## Veja também

- [[Zero Trust]]
- [[NAT]]
- [[Subnet]]
- [[Virtual Private Cloud (VPC)]]
- [[Segurança de API]]
- [[Information Security Management]]
- [[System Design MOC]]
