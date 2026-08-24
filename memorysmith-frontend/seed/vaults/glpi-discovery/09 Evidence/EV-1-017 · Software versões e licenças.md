---
title: EV-1-017 · Software, versões e licenças
aliases: [EV-1-017]
tags: [evidence, dominio/ativos, software, licenca]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-001 · src/Software.php · src/SoftwareVersion.php · src/SoftwareLicense.php · src/Item_SoftwareVersion.php L39 · src/Item_SoftwareLicense.php"
author: CAD Discovery
created: 2026-07-10
---

# EV-1-017 · Software, versões e licenças

> [!quote] classes (grep confirmado)
> ```php
> class Software extends CommonDBTM { ... }               // o produto de software
> class SoftwareVersion extends CommonDBChild { ... }     // versão do software
> class SoftwareLicense extends CommonDBChild { ... }     // licença (tipo, contagem, contrato)
> class Item_SoftwareVersion extends CommonDBRelation {}  // versão INSTALADA num ativo
> class Item_SoftwareLicense extends CommonDBRelation {}  // licença ALOCADA a um ativo
> ```

Modelo de software em quatro peças:
- **Software** — o produto (ex.: "Microsoft Office").
- **SoftwareVersion** — versão específica.
- **Item_SoftwareVersion** — instalação de uma versão **num ativo** (base de auditoria/compliance).
- **SoftwareLicense** + **Item_SoftwareLicense** — licença e sua **alocação** a ativos,
  permitindo controle de conformidade (nº de licenças vs nº de instalações).

## Sustenta
- [[Software, Versões e Licenças]]
- [[Gestão de Software e Licenças (processo)]]
