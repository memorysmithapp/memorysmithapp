---
title: EV-1-024 · Supplier, Contact e Budget
aliases: [EV-1-024]
tags: [evidence, dominio/gestao, fornecedor, orcamento]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-001 · src/Supplier.php L46 · src/Contact.php L45 · src/Contact_Supplier.php · src/Budget.php L46"
author: CAD Discovery
created: 2026-07-10
---

# EV-1-024 · Supplier, Contact e Budget

> [!quote] classes (grep confirmado)
> ```php
> class Supplier extends CommonDBTM { ... }          // fornecedor/fabricante/prestador
> class SupplierType extends CommonType { ... }
> class Contact extends CommonDBTM { ... }            // pessoa de contato
> class Contact_Supplier extends CommonDBRelation {}  // liga contato ↔ fornecedor
> class Budget extends CommonDropdown { ... }         // orçamento (valor, período, entidade)
> ```

- **Supplier** — terceiros (fornecedores, fabricantes, prestadores), com tipo, endereço,
  site. Referenciados por contratos, Infocom, licenças e como **ator** (assign) em chamados
  ([[Modelo de Atores ITIL]]).
- **Contact** — pessoas de contato, ligadas a fornecedores por `Contact_Supplier` (N:N).
- **Budget** — orçamento com **valor** e **período de vigência**; ativos/custos referenciam
  `budgets_id` para consolidar gastos por orçamento.

## Sustenta
- [[Fornecedores e Contatos]]
- [[Orçamentos e Custos]]
- [[Gestão Financeira de TI]]
