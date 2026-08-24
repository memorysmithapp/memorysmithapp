---
title: EV-2-f2-004 · Métodos externos adicionais CAS x509 e SSO delegado
aliases: [EV-2-f2-004]
tags: [evidence, authentication, cas, x509, sso]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-002 · modules/configuration/authentication/other.rst"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-f2-004 · Métodos externos adicionais CAS x509 e SSO delegado

> [!quote] other.rst — "Other external authentication methods"
> A integração do GLPI com fontes além de interno, LDAP e IMAP é configurada em **Setup > Authentication > Other authentication methods**.

> [!quote] other.rst — CAS (Central Authentication Service)
> A configuração de um servidor CAS compreende endereço, porta (padrão 443) e opcionalmente um diretório base; o parâmetro de endereço de retorno redireciona o usuário para uma página específica após logout. Uma vez ativado o CAS, **cada autenticação é automaticamente redirecionada ao servidor CAS**; para logar numa conta interna ou por outro método, é preciso adicionar `?noAUTO=1` à URL de login. As extensões `php-curl` ou `php-dom` são requeridas.

> [!quote] other.rst — x509
> O **Email attribute for x509 authentication** diz ao GLPI qual atributo olhar na variável HTTP `SSL_CLIENT_S_DN`. É possível restringir os valores aceitos dos campos `O`, `OR` e `CN` do certificado do cliente; múltiplos valores por campo são separados pelo símbolo `$`.

> [!quote] other.rst — outras autenticações automáticas (SSO delegado)
> O GLPI pode confiar em outros sistemas externos: autenticação Apache básica, autenticação de domínio Windows, ou vinda de servidor de autenticação como **LemonLDAP::NG, Shibboleth** etc. O GLPI verifica a presença de uma variável nos cabeçalhos HTTP armazenando o login/username; se presente, a autenticação é permitida. É possível mapear os dados transmitidos pelo sistema de autenticação com os campos da conta do usuário no GLPI (nome, sobrenome, e-mail, idioma...). Uma opção permite remover o domínio do login (ex.: `testuser@example.com` > `testuser`). A lista de nomes possíveis de cabeçalho é configurável (dropdown "Fields storage of the login in the HTTP request"), com os mais comuns já providos.

## Sustenta
- [[Métodos de autenticação externos adicionais (CAS, x509, SSO delegado)]]
