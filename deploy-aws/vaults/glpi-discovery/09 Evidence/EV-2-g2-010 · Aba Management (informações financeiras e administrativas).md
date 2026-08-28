---
title: EV-2-g2-010 · Aba Management (informações financeiras e administrativas)
aliases: [EV-2-g2-010]
tags: [evidence, tabs, management, financeiro, infocom]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-002 · modules/tabs/management.rst · Management"
author: CAD Discovery (doc)
created: 2026-07-12
---

## Evidência

> [!quote] modules/tabs/management.rst — "Management"
> Gestão de informações financeiras e administrativas, visíveis na aba 'Management' do formulário do computador. Por padrão essa gestão está desabilitada. É possível ativar a informação financeira em qualquer tipo de objeto do inventário usando o link na aba *Management* do detalhe do material.

> [!note] Notas do doc — ativação
> É possível ativar a informação administrativa e financeira a partir das ações massivas sobre um conjunto de elementos (computador, monitor...). Também é possível ativá-la assim que um elemento é criado (opção "Enable default administrative and financial information" em Setup > General > aba Asset).

A informação financeira agrupa três blocos — **Lifecycle** (datas: pedido, compra, entrega, implementação, último inventário físico, reforma), **Financial and administrative information** (fornecedor, número do pedido, número do ativo, número da fatura, nota de entrega, valor, valor de extensão de garantia, valor contábil líquido, tipo/período/coeficiente de depreciação, TCO, orçamento, datas, comentários, TCO mensal) e **Warranty information** (data de início da garantia, informação, período; "Expires on" em vermelho se vencida).

> [!quote] Tips (management.rst)
> O GLPI permite configurar notificação sobre a expiração da garantia do hardware, configurável por entidade. O GLPI pode calcular o valor contábil líquido por depreciação linear ou de saldo decrescente. Todas as datas podem ser geridas automaticamente conforme mudanças no status do equipamento; algumas datas podem ser copiadas de outra data — configuração feita por entidade. A exibição da informação financeira por tipo de equipamento depende do perfil do usuário logado.

## Sustenta

- [[Aba Gestão (Management) financeira e administrativa]]
- [[Campos da aba Gestão (financeiro e administrativo)]]
