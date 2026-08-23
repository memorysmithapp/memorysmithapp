---
title: EV-2-a2-004 · Gestão de templates (ativos e tickets)
aliases: [EV-2-a2-004]
tags: [evidence, templates, autofill, tickets]
type: evidence
status: confirmed
source: "SRC-002 · modules/overview/templates.rst · Template management in GLPI (Introduction, Assets, Increment, Ticket templates)"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-a2-004 · Gestão de templates (ativos e tickets)

> [!quote] Introdução — o que é um template
> Para alguns tipos de objeto é possível criar objetos usando templates predefinidos. Um template define um modelo de criação em que alguns campos são fixos ou calculados por uma função (ex.: função que calcula o número de inventário de um computador). O gerenciamento de templates é acessível pelo botão *Templates* na barra de menu. — `templates.rst`, "Introduction".

> [!quote] Templates de ativos
> Para ativos, o template define um objeto padrão com campos pré-preenchidos, reutilizável para criar novos objetos — simplifica adicionar muitos objetos quase idênticos. Exemplo: 20 impressoras idênticas em que só diferem número de série e de inventário; cria-se um template com os campos fixos (vendor, model...) e criam-se as 20 a partir dele. É possível criar um template retroativamente a partir de um ativo com a ação "Create template" do menu "Actions" no formulário do ativo. — `templates.rst`, "Assets".

> [!quote] Increment — preenchimento automático
> Alguns campos identificados com um marcador (`autofill_mark`) têm mecanismo automático de preenchimento e incremento (nome, número de inventário...). O campo no template deve conter uma string entre `<` e `>`, com caracteres especiais substituídos automaticamente: `\g` (lookup de número em campos idênticos do mesmo formato); `#` (contador com tantos dígitos quantos `#` consecutivos); `\Y` (ano 4 dígitos); `\y` (ano 2 dígitos); `\m` (mês); `\d` (dia). Exemplo: `<\Y-\m-\d-555-1234-##\>` gera `1984-JAN-02-555-1234-01`, `...-02`, etc. — `templates.rst`, "Increment".

> [!quote] Templates de tickets
> Templates de tickets permitem customizar a interface de criação conforme tipo e categoria do ticket. Comportamentos configuráveis: lista de campos obrigatórios; lista de campos com valor predefinido; lista de campos mascarados (ocultos). Nota: só campos visíveis na interface do usuário são controlados quanto à obrigatoriedade. Um template é anexado à entidade onde foi criado e pode ser visível em subentidades. Templates padrão podem ser definidos por entidade ou por perfil (para perfis, só templates da entidade raiz visíveis de subentidades). Também podem ser definidos por categoria de ticket. — `templates.rst`, "Ticket templates".

> [!quote] Ordem de prioridade do template de ticket
> Ao criar um ticket, o template usado segue a ordem: (1) template definido na categoria e tipo selecionados; (2) template padrão do perfil atual do usuário; (3) template padrão da entidade de criação. Aviso: nos dois últimos casos, se o template definir novo par tipo/categoria, o caso (1) é testado de novo com esses novos valores. Na atualização de ticket aplica-se a mesma ordem para determinar campos obrigatórios; se entidade, perfil, tipo ou categoria mudam durante o preenchimento, o template é rebuscado. O template é usado para criar tickets recorrentes. — `templates.rst`, "Ticket templates".

## Sustenta
- [[Templates de itens (modelos)]]
- [[Preenchimento automático e incremento em templates]]
- [[Templates de tickets]]
