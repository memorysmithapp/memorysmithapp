---
title: Importação e sincronização de usuários LDAP (procedimento)
aliases: [Sincronização LDAP, Importação LDAP, glpi:ldap:synchronize_users]
tags: [authentication, ldap, synchronization, provisioning, procedure]
type: flow
status: confirmed
source: "[[EV-2-f2-002 · Autenticação, sincronização e abas de configuração LDAP-AD|EV-2-f2-002]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Importação e sincronização de usuários LDAP (procedimento)

Como o GLPI importa e mantém sincronizados os usuários de diretórios LDAP/AD. Detalha o comportamento de [[Diretório LDAP e Active Directory (configuração)]].

## Modos de importação
- **No login (on-the-fly)**: no primeiro login o usuário é criado; a cada login a informação pessoal é sincronizada com o diretório. Se um receptor/collector recebe um e-mail não associado a usuário existente, o endereço é buscado no diretório para criar o usuário.
- **Em massa**: via interface web ou pela CLI `glpi:ldap:synchronize_users`.

## As 3 partes do processo
1. **Autenticação** — no primeiro login o GLPI busca todos os diretórios configurados até achar o usuário; se a importação está ativa, cria o usuário e grava o identificador do **método** e do **servidor LDAP**. A cada login seguinte, autentica **apenas** no diretório gravado (se desativado nele, não conecta por outra fonte).
2. **Controle de acesso** — atribuição de permissões via Regras de Atribuição de Autorizações; estar autenticado não garante o direito de conectar.
3. **Recuperação dos dados pessoais** — sincronização dos atributos mapeados.

## Ações sobre usuários ausentes/restaurados
No formulário de configuração define-se o que fazer quando o usuário **some do diretório** (lixeira, remover permissões, desativar) e quando é **restaurado** (nada, restaurar da lixeira, reativar). Ver [[Fontes de autenticação externa (configuração)]].

> [!warning]
> Se o limite de registros retornados pelo LDAP é atingido, a exclusão automática de usuários pode não funcionar e o GLPI exibe aviso na importação/sincronização. Contorna-se com **Pagination of results** (aba Advanced Information).

Complementa a nota de código [[Fluxo de login e provisionamento]] e [[Usuários e Grupos]].
