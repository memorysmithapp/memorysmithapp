---
title: Software (ativo, versões e licenças)
aliases: [Software, Versões, Licenças, Software asset]
tags: [assets, software, version, license, structural, doc]
type: component
maturity: evergreen
reviewed: false
source: "[[EV-2-c2-007 · Software, versões e licenças (softwares.rst)|EV-2-c2-007]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Software (ativo, versões e licenças)

Visão de administrador do ativo **Software**, complementando o modelo de código [[Software, Versões e Licenças]]. O GLPI gerencia software, suas **versões** e **licenças** (associadas ou não a versões). Um software é, por padrão, associado a uma **entidade**.

## Hierarquia (Software → Versão → Licença)
- **Software**: contêiner lógico. Campos específicos: **Upgrade From** (informativo), **Software category** (agrupa na lista de software de um ativo), **Associable to a ticket** (aparece no drop-down "Hardware" do ticket). Ver [[Campos do formulário de Software]].
- **Versão**: "o elemento que pode ser instalado em um ativo". Status segue a **DSL** (biblioteca de versões autorizadas, recomendação ITIL). Ver [[Campos de Versão de Software]].
- **Licença**: gerencia direitos de uso, disponibilidade e custo. Ver [[Campos de Licença de Software]] e a nota de processo [[Gestão de Software e Licenças (processo)]].

> [!note] Gestão financeira no nível da licença
> "Financial management is done at the level of licenses; the financial management at software level is only a model for the licenses associated with this software." Liga a [[Gestão Financeira de TI]].

## Ordem recomendada e importação
- Criar primeiro o software (sem nº de versão no nome), depois as versões e por último as licenças.
- Importação por ferramenta de inventário de terceiros; **dicionários** (Administration > Dictionaries) filtram/limpam os dados — ver [[Dicionário de dados (dictionary)]].
- Suporta [[Templates de itens (modelos)]].

## Procedimentos relacionados
- [[Instalação e desinstalação de software (procedimento)]]
- [[Agrupamento de software em multi-entidade (procedimento)]]
