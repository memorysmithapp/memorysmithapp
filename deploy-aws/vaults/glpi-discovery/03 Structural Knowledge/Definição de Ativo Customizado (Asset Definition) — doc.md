---
title: Definição de Ativo Customizado (Asset Definition) — doc
aliases: [Asset Definition, Ativo customizado, Custom Asset, Generic asset]
tags: [asset-definition, custom-asset, generic-object, configuration]
type: component
maturity: evergreen
reviewed: false
source:
  - "[[EV-2-f2-011 · Definições de ativos customizados e criação|EV-2-f2-011]]"
  - "[[EV-2-f2-012 · Capacidades disponíveis para ativos customizados|EV-2-f2-012]]"
  - "[[EV-2-f2-013 · Campos perfis e traduções de ativos customizados|EV-2-f2-013]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Definição de Ativo Customizado (Asset Definition) — doc

Visão de administrador do construtor de tipos de ativo, complementando a nota de código [[Ativos Customizáveis (AssetDefinition)]]. Desde o **GLPI 11**, o antigo plugin **generic objects** foi integrado nativamente, permitindo criar **tipos de ativo customizados** (ex.: servidores ou laptops separados do tipo nativo Computers). Configurado em Setup > Assets (Asset Definitions).

## Estrutura de uma definição
Ao criar um ativo definem-se: **Label**, **System name** (imutável; usado em API/webhooks; palavras reservadas como Computer, Monitor; gera a classe `Glpi\CustomAsset\<Nome>Asset`), **Comments**, **Active**, **Icon**. Ver [[Criação de um ativo customizado (procedimento)]].

## Abas
- **Capacities** — comportamentos ativáveis (software, portas de rede, contratos, documentos, inventário, etc.). Ver [[Capacidades de ativo customizado (catálogo)]].
- **Fields** — campos customizados e controle dos nativos. Ver [[Gestão de campos customizados de ativos (procedimento)]] e [[Tipos e propriedades de campo customizado de ativos]].
- **Profiles** — permissões por perfil sobre os ativos deste tipo (Create, View all/assigned/owned, Update all/assigned/owned, Delete, Purge) e perfis que podem associar o ativo a tickets/problemas/mudanças. Relaciona-se a [[Perfis e Direitos (RBAC)]].
- **Translations** — tradução do label e do system name (formas One/Many/Other).

> [!warning] Migração
> A migração dos generic objects deve ser feita a partir do banco do **GLPI 10** com o plugin instalado (`php bin/console migration:genericobject_plugin_to_core`); não é possível importar ativos do GLPI 10 para o 11 após a atualização.

Relaciona-se a [[Modelo de Ativos (padrão comum)]], [[Composição de um Ativo (componentes)]] e [[Gestão de Ativos e Configuração (SACM)]].
