---
title: Criação de um ativo customizado (procedimento)
aliases: [Criar asset definition, Create custom asset]
tags: [asset-definition, custom-asset, procedure]
type: use-case
maturity: evergreen
reviewed: false
source: "[[EV-2-f2-011 · Definições de ativos customizados e criação|EV-2-f2-011]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Criação de um ativo customizado (procedimento)

Passo a passo para criar um novo tipo de ativo customizado. Instância de [[Definição de Ativo Customizado (Asset Definition) — doc]].

## Passos
1. Clicar em **+ Add**.
2. Preencher:
   - **Label** — aparece na lista de ativos.
   - **System name** — **imutável** após a criação; usado em desenvolvimento (API, webhooks). Palavras reservadas (Computer, Monitor, etc.) não são permitidas. Gera a classe `Glpi\CustomAsset\<Nome>Asset`.
   - **Comments**, **Active**, **Icon**.
3. Após a criação surge o erro **"There is currently no profile with access to items with current definition"** — é preciso ir à aba **Profiles** e conceder permissões a ao menos um perfil ([[Perfis e Direitos (RBAC)]]).
4. Habilitar as **capacidades** desejadas ([[Capacidades de ativo customizado (catálogo)]]) e configurar **campos** ([[Gestão de campos customizados de ativos (procedimento)]]).

> [!note] Pré-requisito de migração
> Se houver ativos do antigo plugin generic objects, migrá-los a partir do banco GLPI 10 com `php bin/console migration:genericobject_plugin_to_core` antes de recriá-los manualmente.
