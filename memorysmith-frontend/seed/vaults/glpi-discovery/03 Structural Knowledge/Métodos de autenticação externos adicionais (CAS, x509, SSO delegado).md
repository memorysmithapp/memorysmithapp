---
title: Métodos de autenticação externos adicionais (CAS, x509, SSO delegado)
aliases: [CAS, x509, SSO, LemonLDAP, Shibboleth, Single Sign-On]
tags: [authentication, cas, x509, sso, single-sign-on]
type: component
status: confirmed
maturity: evergreen
reviewed: false
source:
  - "[[EV-2-f2-004 · Métodos externos adicionais CAS x509 e SSO delegado|EV-2-f2-004]]"
  - "[[EV-2-f2-010 · Outros dropdowns tipos modelos documentos SO unicidade login|EV-2-f2-010]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Métodos de autenticação externos adicionais (CAS, x509, SSO delegado)

Além de interno, LDAP e IMAP, o GLPI integra outros métodos em **Setup > Authentication > Other authentication methods**. Visão de administrador do [[Autenticação e Single Sign-On (processo)]].

## CAS (Central Authentication Service)
Configurado por endereço, porta (padrão 443) e diretório base opcional; um endereço de retorno redireciona após logout. Uma vez ativado, **toda autenticação é redirecionada ao servidor CAS**; para logar numa conta interna ou por outro método, adiciona-se `?noAUTO=1` à URL de login. Requer `php-curl` ou `php-dom`.

## x509 (certificado de cliente)
O **Email attribute for x509 authentication** indica qual atributo olhar na variável HTTP `SSL_CLIENT_S_DN`. É possível restringir valores aceitos dos campos `O`, `OR` e `CN` do certificado; múltiplos valores separados por `$`.

## Autenticação automática delegada / SSO por cabeçalho
O GLPI pode confiar em sistemas externos: **autenticação Apache básica**, **domínio Windows**, ou servidor de autenticação como **LemonLDAP::NG, Shibboleth** etc. O GLPI verifica a presença de uma variável nos **cabeçalhos HTTP** com o login; se presente, autentica. Os dados transmitidos podem ser **mapeados** para os campos da conta (nome, sobrenome, e-mail, idioma...). Opção para remover o domínio do login (`testuser@example.com` → `testuser`). A lista de nomes de cabeçalho aceitos é configurável pelo dropdown **"Fields storage of the login in the HTTP request"** (ver [[Outros dropdowns (tipos, modelos, documentos, SO, redes, unicidade)]]).

Faz parte de [[Fontes de autenticação externa (configuração)]].
