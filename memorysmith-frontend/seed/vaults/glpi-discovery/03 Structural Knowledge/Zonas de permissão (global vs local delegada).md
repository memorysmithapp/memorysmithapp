---
title: Zonas de permissão (global vs local delegada)
aliases: [Permissions zones, Zonas de permissão, Global vs local]
tags: [perfis, permissoes, entidades, delegacao, governanca]
type: concept
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-e1-005 · Aba Administration do perfil (direitos sobre usuários, entidades e regras)|EV-2-e1-005]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Zonas de permissão (global vs local delegada)

Na gestão de perfis, algumas permissões aplicam-se **globalmente** a todo o GLPI e outras podem ser **delegadas localmente** por entidade. A distinção é indicada visualmente pela **cor das zonas de permissão** nas telas de perfil (uma legenda no doc explica as cores).

- **Globais**: ex.: **perfis** são definidos para todas as entidades.
- **Locais/delegadas**: ex.: **regras de negócio** para tickets podem variar de uma entidade para outra.

Isso conecta o RBAC ao [[Modelo de Entidades (multi-tenancy)]]: um mesmo perfil rege comportamentos globais, mas certos direitos ganham escopo por entidade (reforçando a associação [[Perfis × Entidades (Profile_User)]]).

## Relações
- Conceito de perfil: [[Perfil de Usuário (conceito e composição)]].
- Permissões base: [[Permissões padrão de objetos]].
- Aba onde a legenda aparece: [[Aba Administration de Perfil (direitos administrativos)]].
