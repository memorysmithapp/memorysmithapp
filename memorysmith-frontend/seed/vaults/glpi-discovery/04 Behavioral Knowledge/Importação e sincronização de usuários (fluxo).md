---
title: Importação e sincronização de usuários (fluxo)
aliases: [Import users, Importar usuários, LDAP user import]
tags: [usuarios, importacao, ldap, sincronizacao, fluxo, entidades]
type: flow
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-e1-002 · Importação e sincronização de usuários (LDAP e fontes externas)|EV-2-e1-002]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Importação e sincronização de usuários (fluxo)

Na lista de usuários (`Administration > Users`), três opções permitem adicionar usuários:

1. **Add user** — formulário de criação manual; exige direito de **criação** de usuário.
2. **...From an external source** — importa de fonte externa; exige o direito de usuário **External add**.
3. **LDAP directory link** — importa e sincroniza de diretório LDAP; exige **External add**.

## Importação de fonte externa
Conhecido o identificador do usuário, o GLPI o busca nos diretórios (*Import from directories*) ou em outras fontes (*Import from other sources*).
> [!warning]
> - Se mais de um usuário casa com o identificador, a adição **não** é realizada.
> - Com diretório de e-mail para autenticação, não há lista de importação; usuários de servidor de e-mail **não** recebem informações pessoais.

## Importação/sincronização LDAP
- A interface fica **restrita às entidades** autorizadas ao usuário conectado; em multi-entidades seleciona-se a entidade.
- Critérios de busca baseados nos dados pessoais do diretório, com sintaxe similar à do [[Busca na Interface (uso do motor de busca)|motor de busca]] do GLPI. O link *Activate date filtering* limita a usuários adicionados/modificados numa janela.
- A **interface simplificada** não exige direito de escrita sobre usuários — um técnico/gestor de ativos pode importar sem ter acesso posterior aos importados (útil para call center). Requer diretório configurado para a entidade (`Administration > Entity`) ou diretório padrão.
- O **Expert Mode** é reservado a quem tem direito de atualização de configuração geral ou de entidades; não filtra por entidade e usa apenas os critérios diretório, base e filtro de busca.
- Ao importar, o GLPI guarda o **DN** (`distinguishedName`) além do identificador de conexão, permitindo atualizar o identificador de conexão sem recriar o usuário.

## Relações
- Manutenção recorrente por CLI: [[Sincronização LDAP de usuários (CLI e manutenção)]].
- Autenticação subjacente: [[Autenticação (Auth)]], [[Autenticação e Single Sign-On (processo)]], [[Fluxo de login e provisionamento]].
- Multi-tenancy: [[Modelo de Entidades (multi-tenancy)]].
- Ver também [[Importação de grupos LDAP (fluxo)]].
