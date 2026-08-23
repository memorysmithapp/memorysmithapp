---
title: EV-2-e1-003 · Gestão de Grupos (hierarquia, opções e importação LDAP)
aliases: [EV-2-e1-003]
tags: [evidence, grupos, hierarquia, ldap, notificacoes, 2fa]
type: evidence
status: confirmed
source: "SRC-002 · modules/administration/groups.rst · Groups / Import groups / abas (Child groups, Users, Security, Notifications...)"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-e1-003 · Gestão de Grupos (hierarquia, opções e importação LDAP)

> [!quote] Conceito e opções (groups.rst)
> A aba Groups permite adicionar, modificar, excluir e buscar grupos. Grupos podem ser hierárquicos (ex.: `Management > Division > Service` ou `N3 Support > Network > LAN`) para facilitar navegação/busca. Servem para agrupar usuários por **Skills** (helpdesk — ex.: técnicos de rede) ou por **grupos organizacionais** (ex.: pessoas a notificar). Opções de comportamento: **Visible in a ticket** (grupo requerente e/ou de atribuição); **Can be notified** (destinatário de notificações); **Can be manager** (só para projeto); **Can contain** (ativos e/ou usuários). Se todas as opções forem *No*, o grupo não aparece em nenhuma lista de seleção (útil para grupo mantido só por histórico ou nós vazios da hierarquia).

> [!quote] Grupo técnico vs grupo, gestores e entidade
> Em um item há duas noções: **Technical group** (grupo responsável pelo ativo) e **Group** (grupo ao qual o item pertence). O grupo técnico permite atribuição automática de ticket a um grupo de técnicos (via categorias de ticket) e uso em regras de negócio. Um grupo pode ter um ou mais **managers** (usados em notificações; configurados na aba "Users"). A atribuição usuário→grupo é **estática** (interface) ou **dinâmica** (extraída do LDAP). O grupo é anexado à entidade em que é criado e pode ser visível em subentidades.

> [!quote] Importação de grupos LDAP
> Em `Administration > Groups > LDAP directory link` é possível importar grupos, se autenticação externa é usada e o direito "Auth and sync update" está no perfil; a atribuição de usuários aos grupos é automática. Havendo vários diretórios, escolhe-se; conforme a busca aparecem **Search filter in groups** e/ou **User search filter**. Em multi-entidades, seleciona-se a entidade destino e a visibilidade nas subentidades. Restrição: a importação de grupos **não** pode ser filtrada por entidade e **não** há função de sincronização de grupos — o único modo de atualizar membros a partir do diretório é **ressincronizar os usuários**.

> [!quote] Abas do grupo
> Child groups (subgrupos), Used items, Managed items, LDAP directory link (só com "Auth and sync update"), **Security** (forçar ou não uso de 2FA para o grupo), Users (adiciona usuário definindo se é *manager*), Notifications, Created tickets, Problems, Changes, Notes, Historical.

## Sustenta
- [[Gestão de Grupos (conceito e opções)]]
- [[Campos e opções de Grupo]]
- [[Importação de grupos LDAP (fluxo)]]
