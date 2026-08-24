---
title: Motor de Regras de Negócio (capacidade)
aliases: [Business Rules, automação, regras de negócio]
tags: [capability, motor-de-regras, dominio/admin]
type: capability
status: confirmed
maturity: evergreen
reviewed: false
source:
  - "[[EV-1-031 · Motor de regras Rule RuleCollection Criteria Action|EV-1-031]]"
  - "[[EV-1-032 · Tipos de regra especializados|EV-1-032]]"
author: CAD Discovery
created: 2026-07-10
---

# Motor de Regras de Negócio (capacidade)

Capacidade transversal que permite **configurar automações e políticas sem programar**, via o
[[Motor de Regras (engine)]]. É onde grande parte do comportamento específico do cliente é
definido.

## Exemplos de automação (por tipo — ver [[Tipos de Regra]])
- Roteamento de chamados: "se categoria = Rede e entidade sob Matriz → atribuir ao grupo
  Redes e prioridade Alta" (**RuleTicket**).
- Provisionamento de acesso: "se `memberOf` contém *Suporte* → perfil Técnico na entidade X"
  (**RuleRight**).
- Importação de inventário: casar ativo por serial/UUID, senão criar (**RuleImportAsset**).
- Normalização: "Microsoft Office 2019/2021 → Microsoft Office" (**dicionário**).

> [!note] Para extração de requisitos
> As **regras configuradas** na instância-alvo são requisitos de negócio implementados como
> dados. Um levantamento completo deve **exportar e catalogar** as regras ativas (fora do
> escopo do código-fonte). Ver [[INV-1-009 · Catálogo de critérios e ações por tipo de regra]].
