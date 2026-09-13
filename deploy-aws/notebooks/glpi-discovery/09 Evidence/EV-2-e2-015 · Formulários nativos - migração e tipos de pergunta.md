---
title: EV-2-e2-015 · Formulários nativos - migração e tipos de pergunta
aliases: [EV-2-e2-015]
tags: [evidence, formularios, forms, perguntas, migracao, doc]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-002 · modules/administration/forms/forms.rst · Forms / Migration / Forms options"
author: CAD Discovery (doc)
created: 2026-07-12
---

> [!quote] Documentação (forms.rst, início até "Configure visibility")
> "Since GLPI 11, forms are native, so the formcreator plugin is no longer required. Forms must be migrated from formcreator to forms."

- **Migração formcreator → forms**: feita a partir da base do GLPI 10; não é possível importar formulários de 10 para 11. O plugin formcreator deve estar instalado na migração; depois roda-se em **CLI**: `php bin/console migration:formcreator_plugin_to_core`.
- **Formulários por padrão**: *Report an issue* e *Request a service* (acessíveis a todos; podem ser desativados/excluídos/modificados).
- **Lista de formulários** em Administration > Forms; também visíveis em Assistance > Service catalog.

**Opções ao criar formulário (+ Add):**
- *Customize the formatting*: adicionar nova pergunta, comentário, nova seção, layout horizontal; mover/reorganizar perguntas e seções.
- *Basic information*: título (visível a quem acessa) e descrição.
- *Add questions*: cada pergunta tem título (visível ao usuário) e pode ser **obrigatória**.

**Tipos de pergunta:**
- **Short answer** (texto sem formatação; opções: Text / Emails / Number).
- **Long answer** (até 65.535 caracteres, com formatação).
- **Date and time** (opções: Current date/time, Date, Time).
- **Actors** (usuários/grupos/fornecedores; papéis Requesters/Observers/Assignees pré-preenchidos no ticket; *Allow multiple actors*; uma pergunta de ator só contém um tipo de ator).
- **Urgency** (very low → very high).
- **Request type** (incident ou request).
- **Document** (anexar documento).
- **Radio** (lista de resposta única) / **Checkbox** (múltipla).
- **Dropdown** (lista suspensa; opção *Allow multiple options*).
- **Item** (selecionar objetos GLPI; opção *Users devices* = próprios ativos do usuário). Ver [[Objetos GLPI e dropdowns no tipo de pergunta Item]].

## Sustenta
- [[Formulários (módulo nativo)]]
- [[Tipos de pergunta de formulário]]
- [[Objetos GLPI e dropdowns no tipo de pergunta Item]]
- [[Migração de formcreator para formulários nativos]]
- [[Criação e submissão de um formulário (fluxo)]]
