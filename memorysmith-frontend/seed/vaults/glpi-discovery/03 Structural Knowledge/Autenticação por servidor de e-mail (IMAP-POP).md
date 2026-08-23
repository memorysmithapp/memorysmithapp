---
title: Autenticação por servidor de e-mail (IMAP-POP)
aliases: [IMAP auth, POP auth, Mail servers auth]
tags: [authentication, imap, pop, email]
type: component
status: confirmed
source: "[[EV-2-f2-003 · Autenticação via servidor de e-mail IMAP-POP|EV-2-f2-003]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Autenticação por servidor de e-mail (IMAP-POP)

O GLPI pode usar **servidores de e-mail** como fonte de autenticação, configurados em **Setup > Authentication > Mail servers**. É uma alternativa quando não há diretório LDAP nem servidor CAS.

## Características
- Conexão via protocolos **IMAP ou POP**, com criptografia **SSL/TLS** opcional.
- **Não há importação em massa** (ao contrário de outras fontes): o usuário é autenticado pelo GLPI apenas se o servidor de e-mail o autenticou antes.
- Distingue-se o **domínio de e-mail** (parte após o `@`) do **nome totalmente qualificado do servidor de e-mail**, que pode servir vários domínios.

> [!note]
> Não confundir com o [[Coletor de E-mail (MailCollector)]] / [[Collectors de e-mail no Assistance]], que servem para criar chamados a partir de e-mails — aqui o e-mail é usado apenas como mecanismo de **autenticação**.

Faz parte de [[Fontes de autenticação externa (configuração)]].
