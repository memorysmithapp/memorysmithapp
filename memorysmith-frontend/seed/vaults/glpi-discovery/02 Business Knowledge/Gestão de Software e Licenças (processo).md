---
title: Gestão de Software e Licenças (processo)
aliases: [Software Asset Management, SAM, licenças]
tags: [process, software, licenca, dominio/ativos]
type: process
maturity: evergreen
reviewed: false
source: "[[EV-1-017 · Software versões e licenças|EV-1-017]]"
author: CAD Discovery
created: 2026-07-10
---

# Gestão de Software e Licenças (processo)

Processo de controle do software instalado no parque e da conformidade de licenciamento,
apoiado por [[Software, Versões e Licenças]].

## Fluxo
1. **Descoberta** — o [[Inventário automático (processo)]] reporta softwares/versões
   instalados; regras de **dicionário** (`RuleDictionarySoftware`) normalizam nomes/edições.
2. **Consolidação** — cada instalação vira `Item_SoftwareVersion` no ativo.
3. **Licenciamento** — cadastro de `SoftwareLicense` (tipo OEM/volume/assinatura, quantidade,
   validade, contrato) e **alocação** a ativos (`Item_SoftwareLicense`).
4. **Conformidade** — comparação instalações × licenças → excedente/déficit; alertas.
5. **Custos** — licenças ligam-se a contratos e Infocom para visão financeira.

Suporta auditoria de software e otimização de custos (objetivos do README).
