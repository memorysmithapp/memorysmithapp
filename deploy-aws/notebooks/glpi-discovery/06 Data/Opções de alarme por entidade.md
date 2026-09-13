---
title: Opções de alarme por entidade
aliases: [Alarm options]
tags: [dados, alarme, entidade, estoque, expiracao, campos]
type: entity
maturity: evergreen
reviewed: false
source:
  - "[[EV-2-f3-003 · Opções de alarme por entidade|EV-2-f3-003]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Opções de alarme por entidade

Opções configuradas no nível da **entidade** que governam os alarmes de estoque e de expiração (a partir do GLPI 10.0). Por padrão, **herdam o valor da entidade pai**. Alimentam as ações automáticas de alerta correspondentes (ver [[Catálogo de ações automáticas (crontasks)]]).

| Grupo | Opções |
|---|---|
| Cartridges | Frequência de lembretes de alarmes; limiar padrão de contagem. |
| Consumables | Frequência de lembretes; limiar padrão de contagem. |
| Contract | Alarmes de contratos; valor padrão; antecedência de envio. |
| Financial and administrative information | Alarmes; valor padrão; antecedência de envio. |
| Licenses | Alarmes de licenças expiradas; antecedência de envio. |
| Certificates | Alarmes de certificados expirados; antecedência de envio. |
| Reservations | Alertas em reservas. |
| Tickets | Alertas de tickets não resolvidos desde (prazo). |
| Domains | Alarmes de expiração; "Domains closes expiries"; "Domains expired". |

## Ver também
- [[Reservas e Consumíveis]]
- [[Contratos (Contract)]]
- [[Infocom (dados financeiros do ativo)]]
- [[Software, Versões e Licenças]]
