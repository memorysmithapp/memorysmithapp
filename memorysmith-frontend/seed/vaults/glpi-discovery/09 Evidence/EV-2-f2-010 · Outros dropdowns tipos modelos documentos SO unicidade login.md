---
title: EV-2-f2-010 · Outros dropdowns tipos modelos documentos SO unicidade login
aliases: [EV-2-f2-010]
tags: [evidence, dropdown, others, document-types, operating-systems, unicity]
type: evidence
status: confirmed
source: "SRC-002 · modules/configuration/dropdowns/others.rst"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-f2-010 · Outros dropdowns tipos modelos documentos SO unicidade login

> [!quote] others.rst — nota plugins
> Alguns plugins podem prover cabeçalhos (headings) adicionais, configuráveis no mesmo menu.

> [!quote] others.rst — Types, Models, Virtual machines
> **Types**: lista plana para todas as entidades; define o nome do tipo da aba; pode ser traduzido. **Models**: lista plana para todas as entidades; define o nome do modelo; traduzível. **Virtual machines** (modelos/sistema de virtualização, estado das VMs): listas planas para todas as entidades; **apenas o estado das VMs pode ser traduzido**.

> [!quote] others.rst — Document headings e Document types
> **Document headings**: lista em árvore, válida para todas as entidades. **Document types**: lista plana para todas as entidades; o app oferece vários tipos por padrão, mas é possível adicionar informando: nome do tipo, extensão (ex. `.txt`, `.pdf` — detecção baseada nela), nome do arquivo do ícone (colocar em `pics/icones`), tipo MIME (se necessário), autorização de download (sim/não). O tipo de documento pode ser uma **expressão regular** (ex. `/[0-9]+/`).

> [!quote] others.rst — Knowledge base categories, Operating systems, Networks, Software categories
> **Knowledge base categories**: em árvore, delegável por entidade (nome, categoria pai, visibilidade a subentidades). **Operating systems**: listas planas para todas as entidades; apenas os "update sources" podem ser traduzidos. **Networks**: todas listas planas; interfaces de rede, firmware e networks válidos para todas as entidades; network sockets, domains e VLANs podem ser delegados por entidade com/sem visibilidade a subentidade. **Software categories**: em árvore, para todas as entidades.

> [!quote] others.rst — User titles, LDAP criteria, unicity, login HTTP
> **User titles**: listas planas para todas as entidades. **LDAP criteria**: lista plana para todas as entidades; possível adicionar critério LDAP particular. **Ignored values for the unicity**: lista plana, delegável por entidade e aplicável ou não à subentidade; indica, por tipo de objeto, valores a ignorar na verificação de unicidade (ex.: número de série genérico "To Be Filled By OEM"). **Fields storage of the login in the HTTP request**: lista plana para todas as entidades (usada pela autenticação SSO por cabeçalho HTTP).

## Sustenta
- [[Outros dropdowns (tipos, modelos, documentos, SO, redes, unicidade)]]
- [[Campos de tipo de documento (dropdown)]]
- [[Métodos de autenticação externos adicionais (CAS, x509, SSO delegado)]]
