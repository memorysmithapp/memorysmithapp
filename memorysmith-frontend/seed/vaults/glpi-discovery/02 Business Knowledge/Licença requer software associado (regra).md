---
title: Licença requer software associado (regra)
aliases: [License requires software]
tags: [rule, management, license, software, doc]
type: rule
status: confirmed
source: "[[EV-2-d1-008 · Licenças de software — objetivos, campos e abas|EV-2-d1-008]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Licença requer software associado (regra)

> [!quote] licenses.rst
> "A license cannot exist in GLPI without a software associated to the license when creating it."

Uma **licença** só pode ser criada se estiver **associada a um software** existente no GLPI. Consequentemente, a criação de licenças filhas (campo *as child of*) parte de um software e não de uma licença "solta". Esta é uma invariante de negócio verificada na criação.

Complementarmente, o doc alerta que **a gestão de licenças não é automatizada** — a atualização das informações depende de acompanhamento humano.

> [!note] Ponte doc×código
> Reforça o vínculo modelado em [[Software, Versões e Licenças]] e o processo [[Gestão de Software e Licenças (processo)]].
