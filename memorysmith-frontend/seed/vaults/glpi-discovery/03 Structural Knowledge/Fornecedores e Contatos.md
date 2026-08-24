---
title: Fornecedores e Contatos
aliases: [Supplier, Contact, Fornecedor, Contato]
tags: [entity, fornecedor, dominio/gestao]
type: entity
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-1-024 · Supplier Contact e Budget|EV-1-024]]"
author: CAD Discovery
created: 2026-07-10
---

# Fornecedores e Contatos

- **Supplier (Fornecedor)** — terceiros: fornecedores, fabricantes, prestadores de serviço.
  Têm tipo (`SupplierType`), dados de endereço/contato e são referenciados por [[Contratos (Contract)]],
  [[Infocom (dados financeiros do ativo)]], licenças e como **ator (assign)** em chamados/mudanças
  ([[Modelo de Atores ITIL]]).
- **Contact** — pessoas de contato (nome, cargo, telefone, e-mail), associadas a fornecedores
  por `Contact_Supplier` (N:N). Um fornecedor pode ter vários contatos e vice-versa.

Formam o cadastro de terceiros que sustenta compras, contratos e atendimento por fornecedor.
