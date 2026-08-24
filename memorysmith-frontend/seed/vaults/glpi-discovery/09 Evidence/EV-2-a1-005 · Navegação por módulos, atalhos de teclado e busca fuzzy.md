---
title: EV-2-a1-005 · Navegação por módulos, atalhos de teclado e busca fuzzy
aliases: [EV-2-a1-005]
tags: [evidence, doc, navigation, modules, shortcuts, fuzzy, menu]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-002 · source/first-steps/navigation-modules.rst · Navigate GLPI modules"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-a1-005 · Navegação por módulos, atalhos de teclado e busca fuzzy

> [!quote] source/first-steps/navigation-modules.rst
> "The various functions of GLPI have been grouped into several modules, built around similar contexts of use. The top bar of the interface allows you to navigate between these modules."

Módulos descritos:

- **Assets** — acesso aos diversos materiais inventariados.
- **Assistance** — criar e monitorar tickets, problemas e mudanças; ver estatísticas.
- **Management** — contatos, fornecedores, orçamentos, contratos e documentos.
- **Tools** — projetos, notas, base de conhecimento, reservas, feeds RSS e relatórios.
- **Administration** — usuários, grupos, entidades, perfis, regras e dicionários; também a gestão da fila de e-mail.
- **Setup** — opções gerais de configuração: notificações, coletores, tarefas automáticas, autenticação, plugins, links externos, SLA, gestão de títulos, componentes e controle de unicidade de campos.

> [!note]
> "The menus presented vary according to the authorizations of the logged in user. The navigation context is presented to the user in the breadcrumb trail." Há um botão no canto inferior direito para voltar rapidamente ao topo da página.

## Atalhos de teclado
`1`→Home; *Assets*: `o`→Computers, `s`→Software; *Assistance*: `t`→Tickets, `a`→Statistics, `p`→Planning; *Management*: `d`→Documents; *Tools*: `b`→Knowledge base, `r`→Reservations, `e`→Reports; *Administration*: `u`→Users, `g`→Groups; *Setup*: `n`→Dropdowns.

> [!note] Combinação de teclas
> Varia por SO/navegador. Firefox/Chrome: `Alt`+`Shift`+*atalho*. Opera: `Esc`+`Shift`+*atalho*.

## Busca aproximada (Fuzzy)
> [!quote]
> "since version 9.2, GLPI offers navigation with approximate search (fuzzy) accessible from the keyboard shortcut `Ctrl` + `Alt` + `G`." Abre uma janela modal para filtrar, via campo de busca, todos os menus do GLPI (todos os níveis, incluindo 3º nível como dropdowns/componentes). Atalhos na janela: `↑`/`↓` navegar resultados, `Enter` ir ao resultado, `Esc` fechar. (captura: `images/fuzzyglpi.png`)

## Sustenta
- [[Módulos de Navegação do GLPI]]
- [[Navegação por Atalhos e Busca Fuzzy]]
