---
title: EV-2-f2-001 · Processo geral de autenticação e criação on-the-fly
aliases: [EV-2-f2-001]
tags: [evidence, authentication, login, provisioning]
type: evidence
status: confirmed
source: "SRC-002 · modules/configuration/authentication/index.rst · modules/configuration/authentication/configuration.rst"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-f2-001 · Processo geral de autenticação e criação on-the-fly

> [!quote] authentication/index.rst — "Authentication"
> O GLPI usa uma base interna própria de usuários. Usuários são criados no próprio GLPI ou importados de uma ou mais fontes externas. Conforme o tipo de fonte, a importação pode ser em massa ou no momento do login (se o usuário ainda não é conhecido pelo GLPI mas existe num servidor de autenticação externo com credenciais correspondentes).

> [!quote] authentication/index.rst — nota "The authentication process is as follows"
> 1. O usuário informa login e senha. 2. Se ainda não registrado, o GLPI tenta os métodos configurados **um após o outro na ordem Internal > LDAP > IMAP > Other**; ao autenticar com sucesso, o usuário é criado e o método usado é **armazenado com ele**; se nenhum método autentica, é exibido erro de usuário/senha incorretos. 3. Se o usuário já existia (ou foi importado), o GLPI tenta autenticar **apenas com a última fonte que teve sucesso**; se falhar, erro. 4. O **motor de autorização** é então executado: se concede uma ou mais autorizações, o usuário acessa o GLPI; se nenhuma, o usuário é conhecido pelo GLPI mas **não consegue logar**.

> [!quote] index.rst / configuration.rst — criação on-the-fly e ações de exclusão
> Para o GLPI criar usuários automaticamente a partir de fontes externas ao tentarem logar, isso deve ser habilitado no formulário **Setup > Authentication > Setup** (Configuration > Authentication > Configuration). Com diretórios LDAP, é possível configurar a ação que o GLPI toma quando um usuário deixa de existir no diretório (lixeira, remover permissões, desativar) e o tratamento para usuários restaurados (nada, restaurar da lixeira, reativar). Diretórios LDAP também permitem recusar a criação de usuários sem autorizações. Não há limite de fontes de autenticação. Para usar fonte externa pode ser preciso habilitar extensões PHP (ex.: `php-ldap`). O fuso horário do GLPI também é definido nesse nível.

## Sustenta
- [[Processo de autenticação e login (visão do administrador)]]
- [[Fontes de autenticação externa (configuração)]]
