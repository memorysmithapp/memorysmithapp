---
title: Tipos e propriedades de campo customizado de ativos
aliases: [Custom field types, Propriedades de campo customizado, Field types]
tags: [data, asset-definition, custom-fields, field-types]
type: entity
maturity: evergreen
reviewed: false
source: "[[EV-2-f2-013 · Campos perfis e traduções de ativos customizados|EV-2-f2-013]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Tipos e propriedades de campo customizado de ativos

Propriedades de um campo criado na aba **Fields** de uma [[Definição de Ativo Customizado (Asset Definition) — doc]]. Procedimento em [[Gestão de campos customizados de ativos (procedimento)]].

## Propriedades
| Propriedade | Significado |
|---|---|
| **Label** | Nome exibido no formulário do ativo, resultados de busca, etc. |
| **System name** | Usado em desenvolvimento (API, webhooks). Na **API legada** é prefixado por `custom_` para evitar conflito com campos padrão. Muda automaticamente ao alterar o Label. |
| **Type** | Tipo do dado. **Imutável após salvar.** |
| **Full width** | Estende o campo por toda a largura do formulário. |
| **Mandatory** | Torna o preenchimento obrigatório antes de salvar. |
| **Readonly for these profiles** | Perfis com acesso somente leitura ao campo (permissões da aba Profiles têm precedência). |
| **Hidden for these profiles** | Perfis para os quais o campo fica oculto (as autorizações da aba Profiles têm precedência — visível ao perfil mesmo se selecionado aqui). |
| **Default values** | Valor padrão. |

## Tipos disponíveis (Type)
`string` · `date` · `URL` · `dropdown` · `yes/no` · `text` · `date and time` · `number`.

> [!note] Campo do tipo dropdown
> Seleciona-se o **tipo de item** da lista (catálogo extenso: Computers, Monitors, Tickets, Users, Locations, Manufacturers, ITIL category, Software categories, IP networks, e dezenas de outros tipos de item, modelo e dropdown do GLPI). Permite **seleção múltipla** e valor padrão.

Relaciona-se a [[Dropdown (lista suspensa customizável)]] e [[Perfis e Direitos (RBAC)]].
