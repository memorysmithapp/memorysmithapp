---
title: Gestão Financeira via Orçamentos (visão do usuário)
aliases: [Budgets, Gestão financeira, Financial management]
tags: [capability, management, budget, financial, doc]
type: capability
status: confirmed
source: "[[EV-2-d1-005 · Orçamentos — definição, criação e abas|EV-2-d1-005]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Gestão Financeira via Orçamentos (visão do usuário)

Um **orçamento** (budget) no GLPI é definido por um **valor** e um **período de tempo**. Outros itens GLPI podem ser anexados ao orçamento e, ao fornecerem o seu valor, reduzem o montante disponível.

> [!quote] budgets.rst
> "Creating a budget in GLPI enables the administrative and financial management functionality for all other GLPI items."

Ou seja, o orçamento é o eixo que **habilita a gestão administrativa e financeira** de todos os demais itens. O acompanhamento se dá rastreando o valor de cada item anexado; o total restante pode ficar **negativo** se a soma dos valores anexados exceder o valor do orçamento.

Pontos-chave da mecânica:

- O vínculo de um item a um orçamento é feito **pela aba `Management` do próprio item**, não pela tela do orçamento (ver [[Vincular um item a um orçamento (procedimento)]]).
- A **Main tab** do orçamento mostra o gasto por tipo de item e o total restante, mas **não permite lançar custos ali** — os custos são deduzidos pelas abas *Costs* dos objetos (changes, tickets, contratos, etc.).
- Ao exibir um orçamento de uma **subentidade**, o total restante não fica visível.
- Existe um **budget type** (valor administrativo) configurável em *Setup > Dropdowns > Types > Budget types*.

> [!note] Ponte doc×código
> Complementa [[Gestão Financeira de TI]] e [[Orçamentos e Custos]]. A aba `Management` que faz o vínculo corresponde a [[Infocom (dados financeiros do ativo)]] no código.

Ver campos em [[Campos do formulário de Orçamento]].
