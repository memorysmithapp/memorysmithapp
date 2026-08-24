---
title: EV-2-f1-003 · Links externos, tags e templates Twig
aliases: [EV-2-f1-003]
tags: [evidence, links-externos, twig, tags, configuracao]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-002 · modules/configuration/external_links.rst · External links"
author: CAD Discovery (doc)
created: 2026-07-12
---

> [!quote] modules/configuration/external_links.rst — "External links"
> "Some elements of GLPI can be associated with a set of links to external applications. These are visible from the **Links** tab of the various forms."
> - Adicionar link: informar **name**, **URL**, **icon** e opção de abrir em **aba diferente**.
> - Link **genérico** vale para todos os elementos de um tipo de objeto (via **Setup > External Links** ou botão *Configure XXXX links*). Um link pode ser associado a **um ou mais tipos** de elemento.
> - Usam **tags** substituídas pelos valores do elemento. "External links now use Twig templates. Existing links will be converted automatically during the upgrade to GLPI 11, but new links need to use Twig syntax. `[NAME] -> {{ NAME }}`."
> - Tags: `{{LOGIN}}`, `{{ID}}`, `{{NAME}}`, `{{LOCATION}}`, `{{LOCATIONID}}`, `{{IP}}`, `{{MAC}}`, `{{NETWORK}}`, `{{DOMAIN}}`, `{{SERIAL}}`, `{{OTHERSERIAL}}`, `{{USER}}`, `{{GROUP}}`, `{{FIRSTNAME}}`, `{{REALNAME}}`, `{{FIELD:*}}` (referência a nome interno do campo, case-sensitive).
> - Se o conteúdo é vazio, gera link simples; se há conteúdo, gera download do conteúdo (ex.: arquivo `.rdp`).
> - Exemplos: acesso remoto RDP (`{{NAME}}.rdp` com conteúdo de arquivo RDP e tags), link web `https://{{IP}}`, VNC via navegador `https://{{IP}}:5900`.
> [!note] Com tags de portas de rede (IP, MAC), se o hardware tem várias, são criados tantos links quantas portas.

## Sustenta
- [[Links Externos (external links)]]
- [[Tags de Substituição em Links Externos]]
- [[Migração de Links Externos para templates Twig (GLPI 11)]]
