---
title: Módulos de Navegação do GLPI
aliases: [Módulos GLPI, GLPI modules, Assets, Assistance, Management, Tools, Administration, Setup]
tags: [component, modules, navigation, menu]
type: component
maturity: evergreen
reviewed: false
source: "[[EV-2-a1-005 · Navegação por módulos, atalhos de teclado e busca fuzzy|EV-2-a1-005]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Módulos de Navegação do GLPI

As funções do GLPI são agrupadas em **módulos**, construídos em torno de contextos de uso similares. A barra superior da interface permite navegar entre eles. Os menus apresentados variam conforme as autorizações do usuário logado, e o contexto é mostrado na trilha de navegação (breadcrumb).

| Módulo | Escopo | Ponte de código |
|---|---|---|
| **Assets** | Materiais inventariados | [[Modelo de Ativos (padrão comum)]], [[DCIM (Datacenter → Rack)]] |
| **Assistance** | Tickets, problemas e mudanças; estatísticas | [[Ticket]], [[Problem]], [[Change]], [[Gestão de Incidentes e Requisições (processo)]] |
| **Management** | Contatos, fornecedores, orçamentos, contratos, documentos | [[Fornecedores e Contatos]], [[Contratos (Contract)]], [[Orçamentos e Custos]], [[Documentos (Document)]] |
| **Tools** | Projetos, notas, base de conhecimento, reservas, RSS, relatórios | [[Projetos (Project)]], [[Base de Conhecimento (KnowbaseItem)]], [[Reservas e Consumíveis]] |
| **Administration** | Usuários, grupos, entidades, perfis, regras, dicionários; fila de e-mail | [[Usuários e Grupos]], [[Perfis e Direitos (RBAC)]], [[Modelo de Entidades (multi-tenancy)]] |
| **Setup** | Config. geral: notificações, coletores, tarefas automáticas, autenticação, plugins, links externos, SLA, títulos, componentes, unicidade de campos | [[Notificações (e-mail e canais)]], [[Ações Automáticas (CronTask)]], [[Autenticação (Auth)]], [[SLM, SLA e OLA]] |

> [!note]
> Há botão no canto inferior direito para voltar ao topo da página. A navegação por teclado (atalhos e busca fuzzy) está descrita em [[Navegação por Atalhos e Busca Fuzzy]].

## Relações
- Parte de: [[Áreas da Interface do GLPI]] (main menu).
- Navegação por teclado: [[Navegação por Atalhos e Busca Fuzzy]].
