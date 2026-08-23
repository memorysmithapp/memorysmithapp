---
title: Tipos de pergunta de formulário
aliases: [Form question types]
tags: [formularios, forms, perguntas, campos, dados, doc]
type: table
status: confirmed
source: "[[EV-2-e2-015 · Formulários nativos - migração e tipos de pergunta|EV-2-e2-015]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Tipos de pergunta disponíveis ao construir um [[Formulários (módulo nativo)|formulário]]. Cada pergunta tem título e pode ser **obrigatória**.

| Tipo | Descrição / opções |
|---|---|
| **Short answer** | Texto curto sem formatação. Opções: *Text* / *Emails* / *Number* |
| **Long answer** | Até 65.535 caracteres, com formatação (negrito, itálico, cor) |
| **Date and time** | Data e/ou hora. Opções: *Current date/time* (fixo), *Date*, *Time* |
| **Actors** | Usuários/grupos/fornecedores. Papéis: *Requesters/Observers/Assignees* (pré-preenchidos no ticket); *Allow multiple actors*. Uma pergunta de ator = um só tipo de ator |
| **Urgency** | very low → very high |
| **Request type** | incident ou request |
| **Document** | Anexar documento |
| **Radio** | Lista de resposta única (com descrição adicional) |
| **Checkbox** | Lista de resposta múltipla |
| **Dropdown** | Lista suspensa; opção *Allow multiple options* |
| **Item** | Selecionar objetos GLPI (ou *Users devices* = próprios ativos) — ver [[Objetos GLPI e dropdowns no tipo de pergunta Item]] |

## Condições
- **Visibilidade condicional**: mostrar/ocultar uma pergunta com base na resposta de outra (operadores: is visible, is equal to, contains, match regex…).
- **Aprovação condicional** (só short/long answer): regex força o formato da resposta (ex.: 6 dígitos).
