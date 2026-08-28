---
title: Áreas da Interface do GLPI
aliases: [Layout da interface, UI areas, User menu, Breadcrumb, Search box]
tags: [component, interface, layout, navigation, ui]
type: component
maturity: evergreen
reviewed: false
source: "[[EV-2-a1-011 · Áreas da interface do GLPI|EV-2-a1-011]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Áreas da Interface do GLPI

Independentemente do perfil (que altera menus e conteúdo), a **lógica da interface** permanece a mesma. A interface é composta por áreas que agrupam funcionalidades por natureza:

1. **User menu** — gerenciar preferências, acessar ajuda, mudar o idioma atual, mudar o perfil e a entidade atuais, e desconectar.
2. **Main menu** — navegar pelos diferentes [[Módulos de Navegação do GLPI|módulos]].
3. **Breadcrumb trail** — localizar o contexto de uso da área de trabalho principal.
4. **Main working area** — espaço privilegiado de interação com a aplicação.
5. **Search box** — realizar uma [[Busca Rápida (Quick Search)|busca global]] a qualquer momento.

> [!note]
> O *user menu* é o ponto de acesso a [[Personalização da Experiência do Usuário (capacidade)|preferências]], troca de perfil/entidade e logout ([[Acesso e Login no GLPI (fluxo)]]). As [[Buscas Salvas (Bookmarks)]] também são acessadas por ele.

## Relações
- Contém: [[Módulos de Navegação do GLPI]], [[Busca Rápida (Quick Search)]].
- Ponte de código: [[Modelo de Entidades (multi-tenancy)]], [[Perfis e Direitos (RBAC)]].
