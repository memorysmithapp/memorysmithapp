---
title: Fluxos ICAL e WEBCAL do Planejamento (chave de acesso remoto)
aliases: [ICAL, WEBCAL, Remote access key, Calendário externo]
tags: [integration, calendar, ical, webcal, planning, remote-access-key]
type: integration
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-a1-009 · Preferências do usuário (abas e campos)|EV-2-a1-009]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Fluxos ICAL e WEBCAL do Planejamento (chave de acesso remoto)

O GLPI expõe **fluxos privados de calendário** do planejamento nos formatos **ICAL** e **WEBCAL**, consumíveis por clientes de calendário externos. Esses fluxos são protegidos por uma **chave de segurança (Remote access key)** integrada à URL de acesso.

A chave é gerenciada na aba principal das [[Personalização da Experiência do Usuário (capacidade)|preferências do usuário]], onde o usuário pode **regenerá-la** (o que invalida a URL anterior).

> [!note]
> Segundo o doc, atualmente os fluxos ICAL e WEBCAL do planejamento são os protegidos por essa chave de acesso remoto.

## Relações
- Configurada em: [[Campos das Preferências do Usuário]].
- Ponte de código: [[API REST e GraphQL]] (superfície de integração externa do GLPI).
