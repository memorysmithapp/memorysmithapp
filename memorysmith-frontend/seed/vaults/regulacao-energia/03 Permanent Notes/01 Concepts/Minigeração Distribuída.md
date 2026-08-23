---
title: Minigeração Distribuída
aliases:
  - Minigeração
  - MiniGD
tags:
  - geracao-distribuida
  - legislacao
  - conceito
type: concept
status: growing
source: Lei 14.300/2022, art. 1º, XIII e parágrafo único
author: Presidência da República
created: 2026-07-26
---

> [!abstract]
> Central geradora renovável ou de cogeração qualificada que **não** se classifica como microgeração e cuja potência instalada em corrente alternada é **maior que 75 kW**, limitada a **5 MW** para fontes despacháveis e **3 MW** para não despacháveis.

## Conceito

A minigeração é a faixa comercial e industrial da GD, e é onde a Lei 14.300 concentrou seus controles. Ao contrário da [[Microgeração Distribuída]], ela custeia a própria medição e participa do custo dos reforços de rede — e, acima de 500 kW, precisa depositar [[Garantia de Fiel Cumprimento]].

O limite superior é **bifurcado por despachabilidade**: 5 MW para [[Fontes Despacháveis]], 3 MW para as demais (tipicamente solar sem armazenamento). O parágrafo único do art. 1º, porém, mantém **5 MW até 31 de dezembro de 2045** para as unidades protegidas pela [[Regra de Transição do Fio B|regra de transição do art. 26]].

## Base normativa

| Norma | Dispositivo | O que estabelece |
|---|---|---|
| Lei 14.300/2022 | art. 1º, XIII | Define a modalidade e os limites de 5 MW / 3 MW |
| Lei 14.300/2022 | art. 1º, p.ú. | Limite de 5 MW até 31.12.2045 para as unidades do caput do art. 26 |
| Lei 14.300/2022 | art. 4º | Garantia de fiel cumprimento: 2,5% (500–1.000 kW) e 5% (≥ 1.000 kW) do investimento |
| Lei 14.300/2022 | art. 8º, § 5º | Adequação do sistema de medição é **custo do interessado** |
| Lei 14.300/2022 | art. 18 | Livre acesso mediante **ressarcimento do custo de transporte** |
| Lei 14.300/2022 | art. 26, § 3º, II e III | 12 meses (solar) ou 30 meses (demais fontes) para iniciar a injeção |
| Lei 14.300/2022 | art. 27, § 1º | Regime agravado acima de 500 kW não despachável em autoconsumo remoto ou geração compartilhada concentrada |

## Características

- Potência em CA **> 75 kW**
- Teto por despachabilidade: **5 MW** despachável, **3 MW** não despachável
- **Vedada** a divisão de central em unidades menores para caber nos limites (art. 11, § 2º), salvo unidades flutuantes fotovoltaicas com medição autônoma georreferenciada (§ 3º)
- Sujeita ao regime agravado do art. 27, § 1º quando > 500 kW, não despachável e em modalidade de autoconsumo remoto ou geração compartilhada concentrada

> [!warning] O regime agravado do art. 27, § 1º
> Minigeração acima de 500 kW, fonte não despachável, em [[Autoconsumo Remoto]] ou em [[Geração Compartilhada]] com titular único detendo ≥ 25% do excedente paga, até 2028, **100%** do Fio B, **40%** das componentes de transmissão e conexão e **100%** dos encargos de P&D, EE e TFSEE — muito acima da escada do caput.

## Dados de contexto

- [[Relação de Empreendimentos de MMGD (ANEEL)]] — `DscPorte` e `MdaPotenciaInstaladakW` permitem separar a faixa de minigeração e testar os limites de 3 MW e 5 MW

> [!warning] Fichado, não medido
> Os conjuntos acima estão **fichados** em `knowledge-vault/03 Datasets/`, com fonte e schema. Nenhum foi baixado e nenhum valor foi extraído — não há número aqui para citar. Quando houver, o indicador ou a série entram no `context-vault/` e são linkados daqui.

## Veja também

- [[Microgeração Distribuída]]
- [[Fontes Despacháveis]]
- [[Garantia de Fiel Cumprimento]]
- [[Regra de Transição do Fio B]]
