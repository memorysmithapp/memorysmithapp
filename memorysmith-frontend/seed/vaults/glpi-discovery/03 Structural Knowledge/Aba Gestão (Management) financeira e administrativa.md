---
title: Aba Gestão (Management) financeira e administrativa
aliases: [aba Management, Management tab, gestão financeira]
tags: [tabs, management, financeiro, infocom, ui]
type: component
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-g2-010 · Aba Management (informações financeiras e administrativas)|EV-2-g2-010]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

A aba **Management** concentra as **informações financeiras e administrativas** de um objeto do inventário. Por padrão está **desabilitada**; pode ser ativada por objeto (link na própria aba), em massa (ações massivas sobre vários elementos), ou automaticamente na criação (opção "Enable default administrative and financial information" em Setup > General > aba Asset).

A informação organiza-se em três blocos:
- **Lifecycle** — datas do ciclo de vida (pedido, compra, entrega, implementação, último inventário físico, reforma).
- **Financial and administrative information** — fornecedor, números (pedido, ativo, fatura), nota de entrega, valores, depreciação, TCO, orçamento, comentários.
- **Warranty information** — datas e período de garantia; "Expires on" em vermelho quando vencida.

> [!note] Recursos associados
> - Notificação por entidade na expiração da garantia (ver [[Notificações (e-mail e canais)]]).
> - Cálculo de valor contábil líquido por depreciação linear ou de saldo decrescente.
> - Datas geridas automaticamente conforme o status do equipamento; algumas copiáveis de outra data — configurado por entidade.
> - A exibição da informação financeira por tipo de equipamento depende do **perfil** do usuário logado (ver [[Perfis e Direitos (RBAC)]]).

Materializa, na interface, o conceito de [[Infocom (dados financeiros do ativo)]] e integra a [[Gestão Financeira de TI]]; relaciona-se com [[Orçamentos e Custos]]. Campos em [[Campos da aba Gestão (financeiro e administrativo)]]. Faz parte das [[Abas genéricas dos formulários GLPI]].
