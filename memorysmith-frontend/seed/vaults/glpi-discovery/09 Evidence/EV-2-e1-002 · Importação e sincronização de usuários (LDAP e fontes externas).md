---
title: EV-2-e1-002 · Importação e sincronização de usuários (LDAP e fontes externas)
aliases: [EV-2-e1-002]
tags: [evidence, usuarios, importacao, ldap, sincronizacao, cli]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-002 · modules/administration/users/usersimport.rst · Import users / Import from external source / Import and synchronize from LDAP"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-e1-002 · Importação e sincronização de usuários (LDAP e fontes externas)

> [!quote] Opções de adição (usersimport.rst)
> Na lista de usuários há três opções: **Add user** (formulário de criação, exige direito de criação de usuário); **...From an external source** (importa de fonte externa); **LDAP directory link** (importa e sincroniza de diretório LDAP). Os dois modos de importação exigem o direito de usuário *External add*.

> [!quote] Importação de fonte externa
> Conhecido o identificador do usuário, o GLPI busca-o nos diretórios disponíveis (*Import from directories*) ou em outras fontes (*Import from other sources*). Se mais de um usuário casa com o identificador, a adição não é feita; usando diretório de e-mail para autenticação, não há lista de importação disponível. Usuários importados de servidor de e-mail não recebem informações pessoais; de LDAP podem receber (sob condições).

> [!quote] Importação e sincronização de LDAP
> A interface fica restrita à lista de entidades para as quais o usuário conectado tem autorização. Selecionada a entidade (em multi-entidades), exibem-se critérios baseados nos dados pessoais do diretório, com sintaxe de busca similar à do motor de busca do GLPI; o link *Activate date filtering* limita a usuários adicionados/modificados em uma janela. A interface simplificada não exige direito de escrita sobre usuários (um técnico/gestor de ativos pode importar sem ter acesso aos importados — útil para call center). Um **Expert Mode** (link à direita) é reservado a quem tem direito de atualização de configuração geral ou de entidades; nele os resultados não são filtrados por entidade e os critérios são apenas diretório, base e filtro de busca. Ao importar, o GLPI guarda o identificador único LDAP (`distinguishedName`/`DN`) além do identificador de conexão, o que permite atualizar o identificador de conexão sem recriar o usuário. Para manutenção regular recomenda-se o comando CLI `glpi:ldap:synchronize_users`; para o dia a dia, a importação manual.

## Sustenta
- [[Importação e sincronização de usuários (fluxo)]]
- [[Sincronização LDAP de usuários (CLI e manutenção)]]
