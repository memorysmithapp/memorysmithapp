---
title: Campos de rede IP e nome de rede
aliases: [Campos de IP network, Campos de network name, FQDN fields]
tags: [data, dropdown, ip-network, network-name, fqdn, vlan]
type: entity
status: confirmed
source: "[[EV-2-f2-009 · Dropdowns de internet redes IP e nomes de rede|EV-2-f2-009]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Campos de rede IP e nome de rede

Campos dos dropdowns de internet, parte de [[Dropdowns de Internet e rede (IP, nomes de rede, domínios)]].

## IP network
| Campo | Significado |
|---|---|
| Endereço | Endereço da rede (obrigatório). |
| Máscara | Máscara de sub-rede (obrigatório); IPv6 na forma de prefixo. |
| Gateway | Opcional; geralmente presente em rede "addressable". |

- Redes podem ser **aninhadas**; hierarquia **implícita** derivada de endereços/máscaras, **não editável manualmente**.
- Abas: **VLAN** (VLANs associadas), **IP addresses** (endereços da rede).

## Network name
| Campo | Significado |
|---|---|
| Nome | Rótulo **FQDN**; validade verificada na entrada. |
| IP address(es) | Um ou mais IPs (botão *plus* para adicionar; apagar o campo para remover). |
| IP network | Aparece para recuperar informação das redes IP disponíveis (não é armazenado no name). |

- Aba **Network alias**: aliases = **CNAME** do FQDN; também exigem rótulo FQDN válido.

Relaciona-se a [[Rede (portas, IP, VLAN)]].
