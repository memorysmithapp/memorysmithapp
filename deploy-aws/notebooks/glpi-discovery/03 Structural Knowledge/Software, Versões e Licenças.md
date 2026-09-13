---
title: Software, Versões e Licenças
aliases: [Software, SoftwareVersion, SoftwareLicense]
tags: [concept, software, licenca, dominio/ativos]
type: concept
maturity: evergreen
reviewed: false
source: "[[EV-1-017 · Software versões e licenças|EV-1-017]]"
author: CAD Discovery
created: 2026-07-10
---

# Software, Versões e Licenças

Modelo de gestão de software em quatro peças:

- **Software** — o produto (ex.: "LibreOffice"), com editor/fabricante e categoria.
- **SoftwareVersion** — uma versão do produto, com sistema operacional aplicável.
- **Item_SoftwareVersion** — a **instalação** de uma versão num ativo. É a base do inventário
  de software e da auditoria.
- **SoftwareLicense** — a licença adquirida (tipo, contagem/quantidade, validade, contrato
  associado); **Item_SoftwareLicense** aloca licenças a ativos.

## Conformidade
Cruzando **instalações** (`Item_SoftwareVersion`) com **licenças** (`SoftwareLicense`), o GLPI
apoia o controle de conformidade (over/under-licensing). Regras de dicionário de software
(`RuleDictionarySoftware`) normalizam nomes vindos do inventário.

Ver [[Gestão de Software e Licenças (processo)]].
