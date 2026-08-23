---
title: Campos de Nome de Rede (FQDN e IP)
aliases: [Network name fields, Campos de network name]
tags: [data, assets, network, dns, fqdn, ip, cname]
type: entity
status: confirmed
source: "[[EV-2-c3-005 · Aba Nome de Rede (Network Name)|EV-2-c3-005]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Composição de um network name (identificação DNS de uma máquina), gerido na [[Aba Nome de Rede (Network Name)]]:

| Campo | Semântica |
|---|---|
| Name (FQDN) | Nome correspondente ao rótulo **FQDN**, resolvido pelo DNS |
| IP addresses | Um ou mais endereços IP (IPv4 e/ou IPv6) — daí poder ter vários |
| IP network | Campo de **consulta** das redes IP disponíveis; não é armazenado no network name |
| Network alias | Aliases da rede, correspondentes aos `CNAME` do FQDN (também exigem rótulo FQDN válido) |

> [!note] Validação na entrada
> A validade do nome e de cada endereço IP é verificada ao salvar; elementos inválidos são rejeitados.

> [!note] Por que múltiplos IPs
> Como um nome pode responder em IPv4 e IPv6 e cada IP pode pertencer a várias redes IP, a informação de rede IP não é guardada no network name — apenas os IPs são.
