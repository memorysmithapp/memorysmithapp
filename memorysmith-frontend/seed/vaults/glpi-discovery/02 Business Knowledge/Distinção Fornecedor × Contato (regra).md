---
title: Distinção Fornecedor × Contato (regra)
aliases: [Supplier vs Contact]
tags: [rule, management, supplier, contact, doc]
type: rule
status: confirmed
source:
  - "[[EV-2-d1-003 · Fornecedores — definição, distinção fornecedor×fabricante e abas|EV-2-d1-003]]"
  - "[[EV-2-d1-004 · Contatos — definição, títulos e vCard|EV-2-d1-004]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Distinção Fornecedor × Contato (regra)

O GLPI separa claramente dois conceitos que juntos formam a relação comercial:

- **Fornecedor (Supplier)** — a empresa/entidade que pode ser **anexada a ativos** e a quem se podem atribuir tickets. Caracterizado por nome, tipo de terceiro, localização e dados de contato genéricos.
- **Contato (Contact)** — a **pessoa** externa que permite contatar o fornecedor. É a ela que se atribui título, telefone e e-mail pessoais.

> [!quote] suppliers.rst
> "There is a clear distinction between a supplier (which can be attached to assets) and a contact (which are the persons allowing to contact the supplier). Therefore, a supplier must be associated with contacts."

**Exemplo do doc:** M. Doe é assistente de vendas na empresa Foo → cria-se o fornecedor "Foo", cria-se o contato "M. Doe", atribui-se o tipo "Sale" ao contato e anexa-se o contato ao fornecedor Foo. A associação é bidirecional: o fornecedor tem aba *Contacts* e o contato tem aba *Suppliers*.

> [!note] Ponte doc×código
> Corresponde à nota de código [[Fornecedores e Contatos]]. Não confundir com [[Fornecedor × Fabricante-Marca (regra)]].
