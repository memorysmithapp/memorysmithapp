---
title: EV-2-d1-008 · Licenças de software — objetivos, campos e abas
aliases: [EV-2-d1-008]
tags: [evidence, management, license, software, doc]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-002 · source/modules/management/licenses.rst · Licenses"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-d1-008 · Licenças de software — objetivos, campos e abas

> [!quote] licenses.rst · "Licenses"
> A gestão de licenças permite: inventariar licenças com links para os softwares inventariados no GLPI; acompanhar as instalações de licenças em todos os ativos; ligar licenças à gestão financeira; antecipar e acompanhar a renovação de licenças.

> [!quote] licenses.rst · notas
> "A license cannot exist in GLPI without a software associated to the license when creating it." "License management is not automated, a human follow-up is needed for information update." Suporta *template*.

> [!quote] licenses.rst · "Description of specific fields"
> Campos específicos: **As child of** (indica se a licença depende de outra licença); **Version in use** (versão do software associado); **Purchase version** (versão de compra, que pode diferir da em uso; se diferente, este campo a indica); **Number** (número máximo de usos da licença por ativos); **Allow Over-Quota** (permite ou não ultrapassar o máximo do campo Number); **Expiration date** (data de expiração, útil para alertas e antecipar renovação).

> [!quote] licenses.rst · abas
> Aba **Licenses**: lista as licenças declaradas como filhas desta (relação pai/filho, ex.: licenças obtidas por pack/grupo; criar a filha a partir do software e informar a licença pai no campo *as child of*). Aba **Summary**: lista tipos e entidades de itens ligados à licença (o nº de instalações deve ser conferido contra o campo Number; o vínculo ativo↔licença é feito na aba `Softwares` do ativo). Aba **Items**: detalha cada item ligado à licença. Inclui abas Management, Contracts, Documents, Knowledgebase, Tickets, Problems, Changes, Notes, **Certificates** (anexar um certificado do GLPI à licença), Historical, All.

> [!quote] licenses.rst · nota final
> É possível impedir que certos softwares (ex.: KBs da Microsoft) sejam trazidos, ajustando seus parâmetros em **Management > Dictionaries**.

## Sustenta
- [[Licença na interface (License) — visão do usuário]]
- [[Gestão de Licenças de Software (visão do usuário)]]
- [[Campos do formulário de Licença]]
- [[Licença requer software associado (regra)]]
- [[Licença pai-filho (procedimento)]]
- [[Alertas de renovação e vencimento (contratos, licenças, certificados)]]
