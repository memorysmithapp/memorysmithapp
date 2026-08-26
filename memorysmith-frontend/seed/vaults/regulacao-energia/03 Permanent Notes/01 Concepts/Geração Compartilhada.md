---
title: Geração Compartilhada
aliases:
  - Geração compartilhada
tags:
  - geracao-distribuida
  - modalidades
  - conceito
type: concept
maturity: growing
reviewed: false
source: Lei 14.300/2022, art. 1º, X
author: Presidência da República
created: 2026-07-26
---

> [!abstract]
> Modalidade caracterizada pela reunião de consumidores — por consórcio, cooperativa, condomínio civil voluntário ou edilício, ou qualquer outra forma de associação civil instituída para esse fim — composta por pessoas físicas ou jurídicas que possuam unidade consumidora com micro ou minigeração distribuída, com atendimento de todas as unidades pela mesma distribuidora.

## Conceito

É o instrumento que permite a alguém sem telhado próprio participar da GD: um grupo se organiza juridicamente, uma central gera, e o excedente é rateado entre as UCs dos associados. Diferentemente do [[Autoconsumo Remoto]], os titulares são **distintos** — o que os une é o vínculo associativo, não a propriedade comum.

Duas consequências práticas: os participantes podem transferir a titularidade das contas de energia ao consumidor-gerador titular da UC com GD (art. 3º); e a modalidade fica **dispensada** da [[Garantia de Fiel Cumprimento]] quando organizada por consórcio ou cooperativa (art. 4º, § 1º).

## Base normativa

| Norma | Dispositivo | O que estabelece |
|---|---|---|
| Lei 14.300/2022 | art. 1º, X | Define a modalidade |
| Lei 14.300/2022 | art. 3º | Transferência da titularidade das contas ao consumidor-gerador |
| Lei 14.300/2022 | art. 4º, § 1º | Dispensa da garantia de fiel cumprimento (consórcio ou cooperativa) |
| Lei 14.300/2022 | art. 9º, III | Pode aderir ao SCEE |
| Lei 14.300/2022 | art. 12, § 1º, IV | Excedente alocável às UCs dos integrantes, na mesma distribuidora |
| Lei 14.300/2022 | art. 14, p.ú. | Alocação **restrita** às UCs que fazem parte do empreendimento |
| Lei 14.300/2022 | art. 27, § 1º | Regime agravado quando um único titular detém ≥ 25% do excedente |

> [!important] A trava dos 25%
> O art. 27, § 1º agrava o regime tarifário quando, em geração compartilhada acima de 500 kW não despachável, **um único titular detém 25% ou mais** do excedente. A regra distingue o compartilhamento genuíno da estrutura montada para dar aparência associativa a um autoconsumo concentrado.

## Dados de contexto

- [[Relação de Empreendimentos de MMGD (ANEEL)]] — `DscModalidadeHabilitado` isola a modalidade e `QtdUCRecebeCredito` dá o tamanho do rateio — insumo para testar a trava dos 25% do art. 27, § 1º

> [!warning] Fichado, não medido
> Os conjuntos acima estão **fichados** em `knowledge-vault/03 Datasets/`, com fonte e schema. Nenhum foi baixado e nenhum valor foi extraído — não há número aqui para citar. Quando houver, o indicador ou a série entram no `context-vault/` e são linkados daqui.

## Veja também

- [[Autoconsumo Remoto]]
- [[Empreendimento com Múltiplas Unidades Consumidoras]]
- [[Regra de Transição do Fio B]]
