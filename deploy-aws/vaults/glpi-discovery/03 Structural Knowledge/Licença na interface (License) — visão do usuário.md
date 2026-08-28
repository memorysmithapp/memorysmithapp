---
title: Licença na interface (License) — visão do usuário
aliases: [License, Licença, SoftwareLicense]
tags: [concept, management, license, software, doc]
type: concept
maturity: evergreen
reviewed: false
source: "[[EV-2-d1-008 · Licenças de software — objetivos, campos e abas|EV-2-d1-008]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Licença na interface (License) — visão do usuário

Objeto do módulo Management que representa uma licença de software, sempre **ligada a um software** do GLPI (ver [[Licença requer software associado (regra)]]). Suporta template. Ver [[Campos do formulário de Licença]].

Abas:
- **Licenses** — licenças declaradas como filhas desta (relação pai/filho via *as child of*);
- **Summary** — tipos e entidades de itens ligados (comparar nº de instalações com o campo *Number*);
- **Items** — cada item ligado à licença;
- **Management** — dados financeiros/administrativos;
- **Contracts**, **Documents**, Knowledgebase, **Tickets**, **Problems**, **Changes**, Notes;
- **Certificates** — anexar um certificado GLPI à licença;
- Historical, All.

O vínculo ativo↔licença é feito na aba `Softwares` do ativo. Ver [[Licença pai-filho (procedimento)]].

> [!note] Ponte doc×código
> Corresponde a [[Software, Versões e Licenças]] e ao processo [[Gestão de Software e Licenças (processo)]].
