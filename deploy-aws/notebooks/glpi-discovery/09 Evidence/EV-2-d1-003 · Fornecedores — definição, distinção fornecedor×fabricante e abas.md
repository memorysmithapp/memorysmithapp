---
title: EV-2-d1-003 · Fornecedores — definição, distinção fornecedor×fabricante e abas
aliases: [EV-2-d1-003]
tags: [evidence, management, supplier, doc]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-002 · source/modules/management/suppliers.rst · Suppliers"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-d1-003 · Fornecedores — definição, distinção fornecedor×fabricante e abas

> [!quote] suppliers.rst · "Suppliers"
> "GLPI supports suppliers management, in order to identify the supplier of an asset in asset management but also to attribute tickets to the supplier, either a person or a company." Ao comprar um equipamento de marca X do fornecedor Y, duas informações distintas devem ser geridas no GLPI: o fabricante/marca (X, *vendor*) e o fornecedor (Y, *supplier*).

> [!quote] suppliers.rst · caracterização e objetivos
> Um fornecedor é caracterizado por: nome, tipo de terceiro (*third party type*), localização (endereço, código postal, cidade, país) e contato (site, telefone, fax...). A gestão de fornecedores permite: referenciar todos os fornecedores dos ativos da organização; facilitar o contato em caso de incidente; incluir fornecedores na assistência do GLPI.

> [!quote] suppliers.rst · nota fornecedor × contato
> "There is a clear distinction between a supplier (which can be attached to assets) and a contact (which are the persons allowing to contact the supplier). Therefore, a supplier must be associated with contacts." Exemplo: M. Doe é assistente de vendas na empresa Foo → criar um fornecedor "Foo", criar um contato para M. Doe, atribuir o tipo "Sale" ao contato e anexá-lo ao fornecedor Foo.

> [!quote] suppliers.rst · abas
> Abas do fornecedor: Contacts, Contracts, Elements, Documents, Tickets, Problems, Changes, External links, Notes, Knowledgebase, Historical, All.

## Sustenta
- [[Fornecedor na interface (Supplier) — visão do usuário]]
- [[Distinção Fornecedor × Contato (regra)]]
- [[Fornecedor × Fabricante-Marca (regra)]]
- [[Campos do formulário de Fornecedor]]
