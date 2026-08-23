---
title: Gestão de campos customizados de ativos (procedimento)
aliases: [Custom fields management, Campos customizados de ativos]
tags: [asset-definition, custom-fields, procedure]
type: use-case
status: confirmed
source: "[[EV-2-f2-013 · Campos perfis e traduções de ativos customizados|EV-2-f2-013]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Gestão de campos customizados de ativos (procedimento)

Como adicionar, ocultar, reordenar, modificar e excluir campos na aba **Fields** de uma [[Definição de Ativo Customizado (Asset Definition) — doc]]. A aba adiciona campos extras e permite ocultar/reordenar os nativos.

## Criar um campo (+ New field)
Preencher as propriedades do campo — ver [[Tipos e propriedades de campo customizado de ativos]] para o detalhe de cada uma (Label, System name, Type, Full width, Mandatory, Readonly/Hidden for these profiles, Default values).

## Ocultar / mostrar
Qualquer campo pode ser **oculto** clicando no ícone de ocultar; para restaurar, **arrasta-se** o campo de volta à lista.

## Modificar
- **Campo padrão (nativo)**: só pode modificar Full width, Mandatory, Readonly for these profiles, Hidden for these profiles.
- **Campo customizado**: pode modificar Label, System name (muda automaticamente com o Label), Full width, Mandatory, Readonly/Hidden for these profiles, Default value.
- Em ambos, **o tipo não pode ser modificado** após salvo.

## Excluir
- **Não é possível excluir** campos criados por padrão (só ocultar).
- Campos adicionados pelo usuário: clicar em ocultar → depois na lixeira (**ação irreversível**).

## Reordenar
Arrastar e soltar o campo para a posição desejada.

## Tradução
Na aba **Translations** traduzem-se o label e o system name (formas One = singular, Many = plural, Other = exibida na lista de ativos).
