---
title: EV-2-e1-001 · Ficha de Usuário — aba Users, impersonate e vcard
aliases: [EV-2-e1-001]
tags: [evidence, usuarios, ficha-usuario, impersonate, vcard, ldap]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-002 · modules/administration/users/users.rst · Users / Impersonate / Vcard / abas"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-e1-001 · Ficha de Usuário — aba Users, impersonate e vcard

> [!quote] Aba Users (users.rst, "Users")
> "The Users tab allows you to manage their information (mail, name, authorization, etc.)." Alguns dados podem não ser editáveis conforme a origem da importação — por exemplo, o e-mail de um usuário importado de LDAP(S) não pode ser modificado. É possível **desativar** um usuário: se desativado, deixa de ser selecionável em dropdowns de tickets/inventários, mas mantém itens e tickets associados. As **datas de validade** ("Valid since" / "Valid until") definem a janela de atividade da conta e podem ser definidas independentemente. Uma foto pode ser adicionada manualmente ou importada de um diretório (LDAP).

> [!quote] Impersonate (users.rst, "Impersonate")
> Para depuração ou administração, uma conta "super-admin" (ou qualquer perfil com direitos de configuração) pode **assumir temporariamente** a conta de outro usuário sem saber sua senha, por um ícone no topo do formulário. Um banner permanente indica o modo ativo e permite sair; ao sair, o usuário recupera sua sessão anterior. O histórico registra "user (xxx) impersonated by admin (yyy)". Restrição: só é possível personificar usuários cujo perfil seja igual ou menos privilegiado que o do ator — um técnico pode personificar self-service, mas não admins (evita escalonamento de privilégio).

> [!quote] Vcard e abas da ficha
> Há um ícone para baixar o **vcard** do usuário. A ficha inclui as abas: User Information, Contact information, Password and access keys, Authorizations, Groups, Settings, Used items, Managed items, Consumables, Created tickets, Problems, Changes, Documents, Reservations, Synchronization, Links, Certificates, Licenses, Contracts, Historical. A aba **Synchronization** só aparece com direito *Update Authentication and Synchronization*; **Reservations** exige direito de leitura de reservas; **Settings** exige direito de modificação da configuração geral.

## Sustenta
- [[Ficha de Usuário (abas e visão geral)]]
- [[Campos da ficha de Usuário]]
- [[Personificação de usuário (Impersonate)]]
