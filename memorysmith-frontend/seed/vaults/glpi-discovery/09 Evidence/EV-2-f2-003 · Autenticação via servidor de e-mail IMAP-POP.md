---
title: EV-2-f2-003 · Autenticação via servidor de e-mail IMAP-POP
aliases: [EV-2-f2-003]
tags: [evidence, authentication, imap, pop, email]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-002 · modules/configuration/authentication/imap.rst"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-f2-003 · Autenticação via servidor de e-mail IMAP-POP

> [!quote] imap.rst — "Authenticate from IMAP"
> Interface do GLPI com servidores de e-mail como fonte de autenticação, configurada em **Setup > Authentication > Mail servers**. Esta capacidade pode compensar a ausência de diretório ou de servidor CAS. Ao contrário de outras fontes, **não há importação em massa**: um usuário é autenticado pelo GLPI se o servidor de e-mail o autenticou previamente. A conexão usa os protocolos **IMAP ou POP**, com opções de criptografia **SSL e TLS**. Distingue-se o **domínio de e-mail** (parte após o caractere de arroba) do **nome totalmente qualificado do servidor de e-mail**, que pode servir vários domínios.

## Sustenta
- [[Autenticação por servidor de e-mail (IMAP-POP)]]
