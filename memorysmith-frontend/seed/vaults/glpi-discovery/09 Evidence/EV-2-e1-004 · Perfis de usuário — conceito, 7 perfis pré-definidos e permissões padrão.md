---
title: EV-2-e1-004 · Perfis de usuário — conceito, 7 perfis pré-definidos e permissões padrão
aliases: [EV-2-e1-004]
tags: [evidence, perfis, rbac, permissoes, entidades, recursividade]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-002 · modules/administration/profiles/profiles.rst · User profiles / Permissions description / The different tabs"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-e1-004 · Perfis de usuário — conceito, 7 perfis pré-definidos e permissões padrão

> [!quote] Conceito (profiles.rst)
> "Profile is central in GLPI configuration: profile is the key for users permissions granting and for securing and isolating data." Um perfil associa-se a um **usuário** e a uma **entidade**, de forma **recursiva** ou **dinâmica**. Para propagar direitos às entidades filhas, o perfil deve ser associado recursivamente. Perfis diferentes podem ser associados ao mesmo usuário conforme a entidade (adicionando o perfil ao usuário por entidade em que deva ser diferente).

> [!quote] Os 7 perfis pré-registrados
> - **Super-Admin**: todas as permissões. Aviso: se excluído, ou se associado à interface simplificada, o acesso à configuração pode ser perdido permanentemente.
> - **Admin**: direitos de administração de todo o GLPI, com algumas restrições em regras, entidades e itens que alteram comportamento.
> - **Supervisor**: incorpora o *Technician* e adiciona gestão de equipe/organização (alocação de tickets etc.).
> - **Technician**: técnico de manutenção; leitura de inventário e helpdesk para tratar tickets.
> - **Hotliner**: serviço de hotline; abre e acompanha tickets, mas não os assume como um *Technician*.
> - **Observer**: leitura de todo inventário e gestão; em assistência pode abrir/receber ticket, mas não administra (atribuir, roubar).
> - **Self-Service**: o mais limitado; único com **interface simplificada**. Pode declarar ticket, adicionar follow-up, consultar FAQ ou reservar ativo. É o **perfil padrão**.

> [!quote] Permissões padrão e regras
> Não há dedução de permissão (ex.: para modificar um objeto é preciso também o direito de leitura). Migração converte o antigo *Write* em Read/Update/Create/Delete/Purge. Sete permissões padrão para a maioria dos objetos: **Read** (exibe o objeto, frequentemente controla presença nos menus), **Update** (modifica dados), **Create**, **Delete** (envia à lixeira; ausência = objeto sem lixeira), **Purge** (remove da lixeira/BD permanentemente), **Read notes**, **Update notes**. As sete abas de permissão correspondem aos menus: Assets, Assistance, Life cycle, Management, Tools, Administration, Configuration; além de abas Users (entidades onde o perfil é atribuído; "D"=dinâmico, "R"=recursivo), Historical, All. A permissão **Internet** (Assets) aplica-se a IP de porta de rede, associação de nome de rede à porta e parte Internet de dropdowns. Em Management, **Financial and administrative information** aplica-se também a objetos com dados financeiros (ex.: não se purga um computador com info financeira sem *Purge* sobre a info financeira). A exibição da gestão de perfis depende do perfil do usuário conectado.

## Sustenta
- [[Perfil de Usuário (conceito e composição)]]
- [[Perfis pré-definidos do GLPI]]
- [[Permissões padrão de objetos]]
