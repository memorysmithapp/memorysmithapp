---
title: EV-1-023 · Contract com renovação, alerta, custos e vínculo a itens
aliases: [EV-1-023]
tags: [evidence, dominio/gestao, contrato]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-001 · src/Contract.php L47–101 · src/Contract_Item.php L43 · src/ContractCost.php L42 · src/Contract_Supplier.php"
author: CAD Discovery
created: 2026-07-10
---

# EV-1-023 · Contract com renovação, alerta, custos e vínculo a itens

> [!quote] `src/Contract.php`
> ```php
> class Contract extends CommonDBTM implements StateInterface {
>     use Clonable; use Glpi\Features\State;
>     public $dohistory = true;
>     protected static $forward_entity_to = ['ContractCost'];
>     public static $rightname = 'contract';
>     public const RENEWAL_NEVER = 0;
>     public const RENEWAL_TACIT = 1;   // renovação tácita
>     public const RENEWAL_EXPRESS = 2; // renovação expressa
>     public function getCloneRelations(): array {
>         return [Contract_Item::class, Contract_Supplier::class, ContractCost::class, ...];
>     }
>     // post_getEmpty(): alerta herdado da Entidade (use_contracts_alert / default_contract_alert)
>     public static function getLogDefaultServiceName(): string { return 'financial'; }
> }
> ```

O **Contract** modela contratos (suporte, aluguel, garantia estendida…). Tem tipo de
**renovação** (nunca/tácita/expressa), período de **aviso prévio** (`notice`) e **alerta** de
vencimento (herdado da configuração da [[Modelo de Entidades (multi-tenancy)|entidade]]).
Liga-se a **qualquer item** via `Contract_Item`, a **fornecedores** via `Contract_Supplier`,
e acumula **custos** (`ContractCost`). Serviço de log "financial".

## Sustenta
- [[Contratos (Contract)]]
- [[Gestão de Contratos (processo)]]
