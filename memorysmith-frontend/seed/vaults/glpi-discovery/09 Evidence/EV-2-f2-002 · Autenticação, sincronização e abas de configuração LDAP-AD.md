---
title: EV-2-f2-002 · Autenticação, sincronização e abas de configuração LDAP-AD
aliases: [EV-2-f2-002]
tags: [evidence, authentication, ldap, active-directory]
type: evidence
status: confirmed
source: "SRC-002 · modules/configuration/authentication/ldap.rst"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-f2-002 · Autenticação, sincronização e abas de configuração LDAP-AD

> [!quote] ldap.rst — visão geral
> O GLPI pode se conectar a um ou mais diretórios LDAP para autenticar usuários, controlar acesso, recuperar informação pessoal e importar grupos. Todos os diretórios compatíveis com **LDAP v3** são suportados, incluindo o **Active Directory** da Microsoft. Não há limite de diretórios, mas quanto mais, mais longa a busca de um novo usuário. Se nenhuma configuração LDAP é visível, o módulo LDAP do PHP não está instalado.

> [!quote] ldap.rst — importação/sincronização (2 modos)
> (1) No primeiro login o usuário é criado no GLPI; a cada login sua informação pessoal é sincronizada com o diretório. Quando receptores (collectors) são usados e há um e-mail não associado a usuário existente, o endereço é buscado no diretório para criar o usuário. (2) Em massa, via interface web ou pela CLI `glpi:ldap:synchronize_users`.

> [!quote] ldap.rst — 3 partes do processo
> A autenticação divide-se em 3 partes: **autenticação**, **controle de acesso** e **recuperação dos dados pessoais**. No primeiro login o GLPI busca todos os diretórios configurados até achar um que contenha o usuário; se a importação está ativa, o usuário é criado e o identificador do método e do servidor LDAP são gravados. A cada login seguinte o usuário é autenticado **apenas** no diretório cujo identificador está gravado. Se desativado nesse diretório, não pode conectar por outra fonte. O controle de acesso (atribuição de permissões) baseia-se nas **Regras de Atribuição de Autorizações** — estar autenticado não dá direito a conectar.

> [!quote] ldap.rst — aba "LDAP directory" (template AD e campos)
> Há um **template de pré-configuração Active Directory** que pré-preenche vários campos (link **Active Directory** ao adicionar diretório; **Default value(s)** reseta). Campos: **Default server** (só um padrão possível); **Server** e **Port** (endereço/porta; LDAPS via prefixo `ldaps://` e porta 636); **Connection filter** (restringe a busca — ex. `(objectclass=inetOrgPerson)` ou filtro AD para usuários habilitados); **BaseDN** (local a partir do qual as buscas são feitas); **RootDN** (DN da conta para autenticar quando não há bind anônimo); **Password**; **Login field** (`uid` em LDAP, `samaccountname` em AD); **Synchronization field** (único por usuário — `employeeuid` / `objectguid`). RootDN e BaseDN são case sensitive e sem espaços entre as partes.

> [!quote] ldap.rst — abas Test, Users, Groups, Advanced, Replicates
> **Test**: testa a configuração ("Connection test successful"). **Users**: configura o mapeamento entre campos do diretório e do GLPI (a maioria mapeada automaticamente, pode ser alterado). **Groups**: método de recuperação de grupos. **Advanced Information**: fuso horário se o servidor LDAP está em timezone diferente; limite de registros retornados (limite do cliente e do servidor); **Pagination of results** para contornar o limite, com **Page size** e **Maximum number of results** (limite padrão OpenLDAP 500, AD 1000). **Replicates**: servidores LDAP com os mesmos dados em endereço diferente, usados só quando a conexão ao servidor principal se perde — declarados com Name, Server, Port, Timeout; sem limite de réplicas.

## Sustenta
- [[Diretório LDAP e Active Directory (configuração)]]
- [[Importação e sincronização de usuários LDAP (procedimento)]]
- [[Campos de configuração de diretório LDAP]]
- [[Campos de mapeamento de usuários e grupos LDAP]]
