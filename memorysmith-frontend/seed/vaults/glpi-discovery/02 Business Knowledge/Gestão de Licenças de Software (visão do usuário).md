---
title: Gestão de Licenças de Software (visão do usuário)
aliases: [Licenses management]
tags: [capability, management, license, software, financial, doc]
type: capability
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-d1-008 · Licenças de software — objetivos, campos e abas|EV-2-d1-008]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Gestão de Licenças de Software (visão do usuário)

A gestão de licenças do GLPI, na ótica do usuário, permite:

- **inventariar** licenças com ligação aos softwares inventariados no GLPI;
- **acompanhar** as instalações de licenças em todos os ativos;
- **ligar** licenças à gestão financeira;
- **antecipar e acompanhar** a renovação de licenças (via *Expiration date* e alertas).

Duas restrições importantes de negócio:

> [!warning] Regras
> - Uma licença **não pode existir sem um software associado** no momento da criação (ver [[Licença requer software associado (regra)]]).
> - A gestão de licenças **não é automatizada**: exige acompanhamento humano para atualização das informações.

O controle de conformidade compara o número de instalações (aba *Summary*) contra o campo **Number** (número máximo de usos), com opção **Allow Over-Quota**. Licenças podem formar hierarquias pai/filho (campo *as child of*), útil para pacotes/grupos de licenças. O vínculo ativo↔licença é feito na aba `Softwares` do ativo.

> [!note] Ponte doc×código
> Complementa a nota de código [[Gestão de Software e Licenças (processo)]] e a entidade [[Software, Versões e Licenças]].

Ver [[Campos do formulário de Licença]], [[Licença pai-filho (procedimento)]] e [[Alertas de renovação e vencimento (contratos, licenças, certificados)]].
