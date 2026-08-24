---
title: Campos administrativos e de endereço da entidade
aliases: [Entity address fields]
tags: [entidades, campos, endereco, dados, doc]
type: table
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-e2-003 · Abas da entidade - Endereço e Avançado (regras genéricas e LDAP)|EV-2-e2-003]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Campos da aba **Address** de uma entidade (dados administrativos/de contato):

| Campo | Descrição |
|---|---|
| Phone | Telefone |
| Administrative number | Número administrativo |
| Fax | Fax |
| Website | Site |
| Email | E-mail |
| Postal code | CEP/código postal |
| Address | Endereço |
| City | Cidade |
| State | Estado/província |
| Country | País |
| Location on map | Localização no mapa |
| Longitude / Latitude / Altitude | Coordenadas geográficas |

## Aba Advanced information (identificação técnica)
Usada por regras de atribuição automática e busca de usuários LDAP:
- **TAG** da ferramenta de inventário representando a entidade;
- **Atributo LDAP** representando a entidade (ex.: `DN`);
- **Domínio de e-mail** substituto da entidade;
- **LDAP directory** e **LDAP filter** associados (para importar usuários).

Ver [[Abas de configuração da Entidade]] e [[Regras de atribuição de autorizações ao usuário]].
