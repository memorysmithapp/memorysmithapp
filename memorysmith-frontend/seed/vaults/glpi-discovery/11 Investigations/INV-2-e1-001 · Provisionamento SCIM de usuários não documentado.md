---
title: INV-2-e1-001 · Provisionamento SCIM de usuários não documentado
aliases: [INV-2-e1-001]
tags: [investigation, consumidor/cad, usuarios, scim, provisionamento, ldap]
type: investigation
status: open
author: CAD Discovery (doc)
created: 2026-07-12
---

# INV-2-e1-001 · Provisionamento SCIM de usuários não documentado

## O que disparou
Em `users.rst` e `users/tabs/authorizations.rst`, a documentação menciona que dados de usuários "importados por um provedor (LDAP, **SCIM**, etc.)" não podem ser editados manualmente. O **SCIM** é citado como fonte de provisionamento ao lado do LDAP, mas **nenhum arquivo da fatia lida descreve** como o SCIM é configurado, quais campos provisiona, ou como interage com perfis/entidades.

## Perguntas abertas
- Como o provisionamento SCIM é habilitado e configurado no GLPI?
- SCIM cria/atualiza usuários, grupos e autorizações? Com qual mapeamento?
- Há sincronização automática (como `glpi:ldap:synchronize_users` para LDAP)?
- SCIM respeita as [[Zonas de permissão (global vs local delegada)|zonas de entidade]]?

## Próximos passos
Buscar documentação de configuração (provavelmente em `modules/configuration/`) ou código relacionado a SCIM. Ligar a [[Autenticação (Auth)]] e [[Fluxo de login e provisionamento]].
