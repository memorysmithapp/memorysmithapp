---
title: Tipos de Regra
aliases: [RuleRight, RuleTicket, RuleAsset, RuleImportAsset, dicionários]
tags: [concept, motor-de-regras, dominio/admin]
type: concept
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-1-032 · Tipos de regra especializados|EV-1-032]]"
author: CAD Discovery
created: 2026-07-10
---

# Tipos de Regra

O [[Motor de Regras (engine)]] é aplicado em vários pontos por **tipos** especializados:

| Tipo | Quando roda | O que faz |
|---|---|---|
| **RuleRight** | no login (LDAP/SSO) | atribui perfil/entidade/grupo por atributos do diretório |
| **RuleTicket** (business rules) | add/update de chamado | ajusta categoria, prioridade, atribuição, SLA |
| **RuleChange/RuleProblem** | add/update | idem para mudanças/problemas |
| **RuleAsset** | add/update de ativo | define estado, entidade, localização |
| **RuleImportAsset** | inventário | casa/cria ativos vindos do agente |
| **RuleLocation / RuleEntity** | várias | deriva localização/entidade |
| **RuleMailCollector** | e-mail→chamado | roteia chamados criados por e-mail |
| **RuleDictionary\*** | normalização | limpa nomes de software, fabricantes, modelos, SO |

Como cada tipo é executado em um gancho do [[Ciclo de vida de um item (add-update-delete)]]
(ex.: `assetBusinessRules` em `add()`), as regras são o principal ponto onde a **política do
cliente** é configurada sem código. Catálogo exato de critérios/ações por tipo em
[[INV-1-009 · Catálogo de critérios e ações por tipo de regra]].
