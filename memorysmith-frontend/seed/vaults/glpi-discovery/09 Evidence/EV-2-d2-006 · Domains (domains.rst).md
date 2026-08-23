---
title: EV-2-d2-006 · Domains (domains.rst)
aliases: [domains.rst, Domains]
tags: [evidence, management, domain, doc]
type: evidence
status: confirmed
source: "SRC-002 · modules/management/domains.rst · Domains"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-d2-006 · Domains (domains.rst)

Evidência da documentação sobre o objeto **Domain** (domínio Internet) no módulo Management.

> [!quote] domains.rst · introdução
> "Domains management in GLPI allows to manage domains (i.e. Internet domains) and domain records: Inventorying domain names; Inventorying domain records; Anticipating and following domain names renewal; Integrating domains in GLPI financial management; Linking assets to domains; Include domains and records in GLPI assistance." Nota: "Access to list of domain `Records` is done via the list of `Domains`."

> [!quote] domains.rst · "Domain object"
> "A `Domain` object represents an Internet domain, with its name, expire date... This object can be attached to other objects in GLPI assistance (tickets, problems, changes)."

> [!quote] domains.rst · "The different tabs"
> Abas: Impact Analysis; **Records** (cria/seleciona um registro de domínio a associar ao domínio — ver domains records); Items (lista de itens GLPI vinculados, adição manual); Management; Tickets; Problems; Changes; Contracts; Documents; Certificates; Historical e "all".

Capturas no doc: `images/domains.png`, `images/recordslist-domains.png`. O formulário não enumera explicitamente os campos além de nome e data de expiração (ver [[INV-2-d2-001 · Campos do formulário de Domínio não enumerados na documentação]]).

## Sustenta
- [[Domínio (Internet domain)]]
- [[Gestão de Domínios e Registros (capacidade)]]
