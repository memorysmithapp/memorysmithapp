---
title: Sincronização LDAP de usuários (CLI e manutenção)
aliases: [glpi:ldap:synchronize_users, LDAP sync CLI]
tags: [ldap, sincronizacao, cli, manutencao, operacao]
type: infra
status: confirmed
source: "[[EV-2-e1-002 · Importação e sincronização de usuários (LDAP e fontes externas)|EV-2-e1-002]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Sincronização LDAP de usuários (CLI e manutenção)

Para a **manutenção regular** da base de usuários, a documentação recomenda o comando de linha do GLPI:

```
glpi:ldap:synchronize_users
```

- Para a **gestão diária**, permanece disponível o mecanismo de importação manual (ver [[Importação e sincronização de usuários (fluxo)]]).
- Se uma **fonte de autenticação externa** está configurada, torna-se possível importar e sincronizar usuários por ela.
- A sincronização de usuários é também o **único** mecanismo para atualizar a lista de membros de grupos a partir do diretório, já que não há função de sincronização de grupos (ver [[Importação de grupos LDAP (fluxo)]]).

## Relações
- Operação/automação relacionada: [[Ações Automáticas (CronTask)]].
- Autenticação: [[Autenticação (Auth)]], [[Autenticação e Single Sign-On (processo)]].
