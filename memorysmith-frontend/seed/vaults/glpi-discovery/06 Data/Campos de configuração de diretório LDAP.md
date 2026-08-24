---
title: Campos de configuração de diretório LDAP
aliases: [Campos LDAP, BaseDN, RootDN, Login field, Synchronization field]
tags: [data, ldap, authentication, fields]
type: entity
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-f2-002 · Autenticação, sincronização e abas de configuração LDAP-AD|EV-2-f2-002]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Campos de configuração de diretório LDAP

Campos da aba **LDAP directory** ao configurar um diretório em [[Diretório LDAP e Active Directory (configuração)]].

| Campo | Significado |
|---|---|
| **Default server** | Servidor padrão; só um pode ser definido; escolher aqui remove de outro. |
| **Server** | Endereço do diretório LDAP. LDAPS via prefixo `ldaps://`. |
| **Port** | Porta (LDAPS padrão 636). |
| **Connection filter** | Filtro que restringe a busca de usuários (ex.: `(objectclass=inetOrgPerson)`; filtro AD para usuários habilitados). Pré-preenchido pelo template AD. |
| **BaseDN** | Local do diretório a partir do qual as buscas são feitas (ex.: `dc=mycompany,dc=fr`). |
| **RootDN** | DN da conta usada para autenticar no LDAP quando não há bind anônimo. |
| **Password** | Senha da conta do RootDN (se houver). |
| **Login field** | Campo do diretório correspondente ao login (`uid` em LDAP, `samaccountname` em AD). |
| **Synchronization field** | Campo único por usuário usado para sincronização (`employeeuid` em LDAP, `objectguid` em AD). |

> [!warning]
> **RootDN** e **BaseDN** são case sensitive e **não** devem conter espaços entre as partes (`cn=Admin,ou=users,dc=mycompany` correto; com espaços, incorreto).

## Aba Advanced Information (campos)
- **Timezone** — quando o servidor LDAP está em fuso diferente do GLPI.
- **Pagination of results** — divide requisições para contornar limites de registros.
- **Page size** — resultados por "página".
- **Maximum number of results** — limite total de registros (evita uso alto de memória).

## Aba Replicates (campos)
- **Name** (exibido no GLPI), **Server**, **Port**, **Timeout** — servidor réplica usado só quando o principal está inacessível.

Relaciona-se a [[Campos de mapeamento de usuários e grupos LDAP]].
