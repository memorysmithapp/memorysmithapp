---
title: Perfis pré-definidos do GLPI
aliases: [7 perfis, Default profiles, Super-Admin, Self-Service]
tags: [perfis, rbac, super-admin, self-service, technician]
type: concept
maturity: evergreen
reviewed: false
source: "[[EV-2-e1-004 · Perfis de usuário — conceito, 7 perfis pré-definidos e permissões padrão|EV-2-e1-004]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Perfis pré-definidos do GLPI

Por padrão, **7 perfis** vêm pré-registrados. São a base do RBAC ([[Perfil de Usuário (conceito e composição)]]).

| Perfil | Descrição |
|---|---|
| **Super-Admin** | Todas as permissões. |
| **Admin** | Administração de todo o GLPI, com restrições em regras, entidades e certos itens. |
| **Supervisor** | Incorpora *Technician* + gestão de equipe/organização (alocação de tickets etc.). |
| **Technician** | Técnico de manutenção; leitura de inventário e helpdesk para tratar tickets. |
| **Hotliner** | Hotline; abre e acompanha tickets, mas não os assume como *Technician*. |
| **Observer** | Leitura de todo inventário/gestão; abre/recebe ticket, mas não administra assistência. |
| **Self-Service** | O mais limitado; única interface **simplificada**. Declara ticket, adiciona follow-up, consulta FAQ, reserva ativo. É o **perfil padrão**. |

> [!warning] Sobre o Super-Admin
> Se o perfil Super-Admin for **excluído**, ou se a **interface simplificada** for associada a ele, o acesso à configuração do GLPI pode ser **perdido permanentemente**.

## Relações
- Interfaces: [[Interface Simplificada (Helpdesk-Self-Service)]], [[Interface Padrão (Standard)]], [[Interface padrão vs simplificada]].
- Papéis de service desk no código: [[Modelo de Atores ITIL]].
- Atores de chamado (visão do usuário): [[Atores e papéis de um chamado (visão do usuário)]].
