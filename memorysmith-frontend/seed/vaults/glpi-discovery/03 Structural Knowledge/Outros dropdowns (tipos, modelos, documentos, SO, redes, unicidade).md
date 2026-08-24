---
title: Outros dropdowns (tipos, modelos, documentos, SO, redes, unicidade)
aliases: [Types, Models, Document types, Operating systems, Ignored values for unicity]
tags: [dropdown, others, document-types, operating-systems, unicity, ldap-criteria]
type: component
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-f2-010 · Outros dropdowns tipos modelos documentos SO unicidade login|EV-2-f2-010]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Outros dropdowns (tipos, modelos, documentos, SO, redes, unicidade)

Dropdowns diversos. Categoria de [[Catálogo de tipos de dropdown (configuração)]]. Plugins podem prover cabeçalhos adicionais no mesmo menu.

## Tipos, modelos e máquinas virtuais
- **Types**: lista plana; nome do tipo; traduzível.
- **Models**: lista plana; nome do modelo; traduzível.
- **Virtual machines** (modelos/sistema de virtualização, estado das VMs): listas planas; **apenas o estado das VMs é traduzível**.

## Documentos
- **Document headings**: lista **em árvore**, todas as entidades.
- **Document types**: lista plana; cada tipo com nome, extensão (base da detecção), ícone (`pics/icones`), MIME e autorização de download; o tipo pode ser uma **expressão regular**. Ver [[Campos de tipo de documento (dropdown)]] e [[Documentos (Document)]].

## Base de conhecimento, SO, redes e software
- **Knowledge base categories**: em árvore, delegável por entidade. Relaciona-se a [[Base de Conhecimento (KnowbaseItem)]].
- **Operating systems**: listas planas; apenas "update sources" traduzível.
- **Networks**: listas planas — interfaces/firmware/networks para todas as entidades; sockets/domains/VLANs delegáveis por entidade.
- **Software categories**: em árvore. Relaciona-se a [[Software, Versões e Licenças]].

## Usuários, LDAP, unicidade e login HTTP
- **User titles**: listas planas.
- **LDAP criteria**: lista plana; permite adicionar critério LDAP particular (usado pelas regras de autorização).
- **Ignored values for the unicity**: lista plana, delegável por entidade; valores a ignorar na verificação de unicidade por tipo de objeto (ex.: "To Be Filled By OEM"). Visão de configuração de [[Dicionário de dados (dictionary)]] / fields-unicity.
- **Fields storage of the login in the HTTP request**: lista plana; nomes de cabeçalho aceitos pela autenticação SSO — ver [[Métodos de autenticação externos adicionais (CAS, x509, SSO delegado)]].
