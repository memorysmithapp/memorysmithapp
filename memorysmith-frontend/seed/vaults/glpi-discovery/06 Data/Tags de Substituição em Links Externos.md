---
title: Tags de Substituição em Links Externos
aliases: [External link tags, Tags de links externos, Twig tags]
tags: [links-externos, tags, twig, campos, data]
type: entity
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-f1-003 · Links externos, tags e templates Twig|EV-2-f1-003]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Conjunto de **tags** usadas em [[Links Externos (external links)]], substituídas pelos valores do elemento ao gerar o link ou o conteúdo. Desde o GLPI 11 usam sintaxe **Twig** (`{{ TAG }}`) — ver [[Migração de Links Externos para templates Twig (GLPI 11)]].

## Tags disponíveis
| Tag | Significado |
|---|---|
| `{{LOGIN}}` | username do usuário logado |
| `{{ID}}` | ID numérico interno do item |
| `{{NAME}}` | nome do item |
| `{{LOCATION}}` | nome da localização do item |
| `{{LOCATIONID}}` | ID numérico interno da localização |
| `{{IP}}` | endereço IP do item |
| `{{MAC}}` | endereço MAC do item |
| `{{NETWORK}}` | rede do item |
| `{{DOMAIN}}` | domínio do item (o primeiro, se houver vários) |
| `{{SERIAL}}` | número de série |
| `{{OTHERSERIAL}}` | número de inventário / asset tag |
| `{{USER}}` | usuário do item |
| `{{GROUP}}` | grupo do item |
| `{{FIRSTNAME}}` | primeiro nome (só em links de User) |
| `{{REALNAME}}` | sobrenome (só em links de User) |
| `{{FIELD:*}}` | referência ao nome interno de um campo (case-sensitive, ex.: `{{FIELD:comment}}`) |

> [!note]
> Tags de portas de rede (`{{IP}}`, `{{MAC}}`) em hardware com várias portas geram vários links — ver [[Rede (portas, IP, VLAN)]].
