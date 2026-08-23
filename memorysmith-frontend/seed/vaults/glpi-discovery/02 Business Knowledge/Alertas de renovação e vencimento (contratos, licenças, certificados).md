---
title: Alertas de renovação e vencimento (contratos, licenças, certificados)
aliases: [Renewal alerts, Notificações de vencimento]
tags: [capability, management, notification, contract, license, certificate, doc]
type: capability
status: confirmed
source:
  - "[[EV-2-d1-002 · Contratos — objetivos, campos específicos e abas|EV-2-d1-002]]"
  - "[[EV-2-d1-008 · Licenças de software — objetivos, campos e abas|EV-2-d1-008]]"
  - "[[EV-2-d1-009 · Certificados — objetivos, campos e abas|EV-2-d1-009]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Alertas de renovação e vencimento (contratos, licenças, certificados)

Vários itens do módulo Management compartilham a preocupação de **antecipar e acompanhar renovações/vencimentos** por meio de alertas por notificação:

- **Contratos** — campo *Notice* dispara alertas; datas de fim calculadas a partir de *Start date* + *Initial contract period* (fim aparece em vermelho se expirado). É possível ser notificado antes do fim (renovação *Express*) ou ao fim de cada período (contratos periódicos).
- **Licenças** — campo *Expiration date* serve para configurar alertas e antecipar a renovação.
- **Certificados** — campo *Expiration date* com a mesma finalidade.

> [!quote] contract.rst
> As notificações são configuradas ao nível da **entidade**: em **Setup > Notifications** definem-se modelos e destinatários; em **Administration > Entities** habilita-se a notificação, definem-se valores padrão e uma possível **antecipação** do envio.

> [!note] Ponte doc×código
> A entrega efetiva das notificações usa o mecanismo descrito em [[Notificações (e-mail e canais)]]. Relaciona-se com [[Gestão de Contratos (visão do usuário)]], [[Gestão de Licenças de Software (visão do usuário)]] e [[Gestão de Certificados (capacidade)]].
