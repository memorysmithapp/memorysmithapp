---
title: EV-2-e2-016 · Formulários - visibilidade, catálogo, controle de acesso e item a criar
aliases: [EV-2-e2-016]
tags: [evidence, formularios, forms, catalogo, acesso, doc]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-002 · modules/administration/forms/forms.rst · Configure visibility até Import/Export"
author: CAD Discovery (doc)
created: 2026-07-12
---

> [!quote] Documentação (forms.rst, "Configure visibility" até "Import/Export")

- **Configure visibility**: condições de visibilidade de uma pergunta com base na resposta de outra (ex.: mostrar impressoras conforme a localização). Tipos: *Always visible* / *Visible if…* / *Hidden if…*. Condições: is visible / is not visible / is equal to / is not equal to / contains / do not contains / match regular expression / do not match regular expression.
- **Conditional Approval** (só em short/long answer): usa **regex** para forçar formato de resposta (ex.: 6 dígitos); erro em vermelho se inválido.
- **Submit button visibility**: condições (AND/OR) para exibir o botão de envio; se não atendidas, o usuário não pode submeter.
- **Service catalog**: torna o formulário visível em Assistance > Service catalog e na home do portal self-service. Customização: descrição, ilustração (catálogo ou upload); **Category** (com subcategorias; geridas em Setup > Dropdowns > Service catalog); possível **fixar (pin)** o formulário.
- **Access control**: define quem pode usar. **Public** (todos com o link; *allow unauthenticated users* permite usuários sem conta GLPI — mas então autenticados não veem o formulário) ou **Private** (filtra por usuários/grupos/perfis, seleção múltipla; opção *all users*). Aviso: condição por entidade → criar o formulário na entidade desejada.
- **Item to create**: customiza os campos do item a criar; pode criar **Tickets, Changes, Problems** (múltiplos itens do mesmo formulário). *Conditions*: condições de criação (ex.: se "Is this problem recurring? = yes" → cria problema em vez de ticket). *Custom fields*: por padrão **autoconfig** (todas perguntas/respostas no item). *Followup / Task / Approval*: para cada item, adicionar follow-up, tarefa ou solicitação de aprovação (do template ou novo).
- **Custom** (Properties): Template (só elementos não preenchidos; nunca sobrepõe preenchimento), Entity (Active in entity of form filler / From form / Specific / Answer from question / Answer to last "Entity" question), Request type, ITIL Category, Status (Default/Closed), Request source, Urgency, Location. **Actors** (Requesters/Observers/Assignees com muitas fontes: User who filled the form, Supervisor, From template, Specific, Answer from question, User/Tech/Group/Tech group from GLPI object answer…). **Service levels** (TTO/TTR/Internal). **Associated items** (Computers, Databases, Monitors…; Specific / Answer from question / All valid answers).
- **Form translations**: tradução por idioma (baseada na preferência do usuário) com barra de progresso.
- **Import / Export**: exporta/importa formulários entre instâncias (dev → produção) via ações massivas; import com **reconciliação de campos** (Resolve issues) quando faltam valores.

## Sustenta
- [[Formulários (módulo nativo)]]
- [[Fontes de valor dos campos do item criado por formulário]]
- [[Criação e submissão de um formulário (fluxo)]]
- [[Import e Export de regras, dicionários e formulários (XML)]]
