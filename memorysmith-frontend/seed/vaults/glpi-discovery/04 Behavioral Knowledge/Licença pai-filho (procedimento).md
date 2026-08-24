---
title: Licença pai-filho (procedimento)
aliases: [Child license, Parent license]
tags: [use-case, management, license, software, doc]
type: use-case
maturity: evergreen
reviewed: false
source: "[[EV-2-d1-008 · Licenças de software — objetivos, campos e abas|EV-2-d1-008]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Licença pai-filho (procedimento)

Algumas licenças são obtidas **por pacote ou por grupo**; a relação pai/filho permite declará-las. A aba **Licenses** de uma [[Licença na interface (License) — visão do usuário|licença]] lista todas as licenças declaradas como filhas dela.

Fluxo para **adicionar uma licença filha**:

1. Criar uma licença a partir do software (toda licença exige software — ver [[Licença requer software associado (regra)]]).
2. No campo **as child of** da nova licença, informar a **licença pai**.

Para **desvincular/modificar/excluir** um vínculo pai/filho, edita-se a entrada no mesmo campo *as child of*.

> [!note] Ponte doc×código
> Modela hierarquia de licenças em [[Software, Versões e Licenças]].
