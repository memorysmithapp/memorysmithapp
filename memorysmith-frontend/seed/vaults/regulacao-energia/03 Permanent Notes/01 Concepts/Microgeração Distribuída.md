---
title: Microgeração Distribuída
aliases:
  - Microgeração
  - MicroGD
tags:
  - geracao-distribuida
  - legislacao
  - conceito
type: concept
maturity: growing
reviewed: false
source: Lei 14.300/2022, art. 1º, XI
author: Presidência da República
created: 2026-07-26
---

> [!abstract]
> Central geradora de energia elétrica com potência instalada em corrente alternada **menor ou igual a 75 kW**, que utilize cogeração qualificada ou fontes renováveis, conectada à rede de distribuição por meio de instalações de unidades consumidoras.

## Conceito

A microgeração é o degrau mais baixo da geração distribuída — na prática, o telhado solar residencial e o pequeno comércio. O que a define não é a tecnologia, e sim três atributos cumulativos: **potência ≤ 75 kW em CA**, **fonte renovável ou cogeração qualificada**, e **conexão pela instalação de uma unidade consumidora** (não por conexão dedicada de gerador).

O limite de 75 kW não é apenas classificatório: é a fronteira econômica que separa quem paga reforço de rede de quem não paga. Ver [[Minigeração Distribuída]] para o outro lado dessa fronteira.

## Base normativa

| Norma | Dispositivo | O que estabelece |
|---|---|---|
| Lei 14.300/2022 | art. 1º, XI | Define a modalidade e o limite de 75 kW |
| Lei 14.300/2022 | art. 8º, § 4º | Sistema de medição é responsabilidade **técnica e financeira da distribuidora** |
| Lei 14.300/2022 | art. 8º, § 6º | Melhorias e reforços exclusivamente em função da microgeração são **integralmente da distribuidora** |
| Lei 14.300/2022 | art. 26, § 3º, I | Prazo de **120 dias** do parecer de acesso para iniciar a injeção, qualquer fonte |
| Lei 14.300/2022 | art. 28 | Caracteriza-se como produção de energia para **consumo próprio** |

## Características

- Potência instalada em corrente alternada **≤ 75 kW**
- Fonte: cogeração qualificada (conforme regulamentação da ANEEL) ou renovável
- Conectada **pela instalação da unidade consumidora**
- Dispensada de [[Garantia de Fiel Cumprimento]] (art. 4º alcança apenas faixas acima de 500 kW)
- Participa do [[Sistema de Compensação de Energia Elétrica (SCEE)]]

## Comparação

| | Microgeração | [[Minigeração Distribuída]] |
|---|---|---|
| Potência (CA) | ≤ 75 kW | > 75 kW; ≤ 5 MW despachável, ≤ 3 MW não despachável |
| Medição | Custo da distribuidora | Custo do interessado |
| Reforço de rede | Custo da distribuidora | Participação financeira do consumidor-gerador |
| Garantia de fiel cumprimento | Não se aplica | 2,5% (500–1.000 kW) ou 5% (≥ 1.000 kW) |
| Prazo para injetar (art. 26, § 3º) | 120 dias | 12 meses (solar) ou 30 meses (demais) |

## Dados de contexto

- [[Relação de Empreendimentos de MMGD (ANEEL)]] — `DscPorte` separa micro de minigeração; `MdaPotenciaInstaladakW` permite validar o corte de 75 kW

> [!warning] Fichado, não medido
> Os conjuntos acima estão **fichados** em `knowledge-vault/03 Datasets/`, com fonte e schema. Nenhum foi baixado e nenhum valor foi extraído — não há número aqui para citar. Quando houver, o indicador ou a série entram no `context-vault/` e são linkados daqui.

## Veja também

- [[Minigeração Distribuída]]
- [[Consumidor-Gerador]]
- [[Sistema de Compensação de Energia Elétrica (SCEE)]]
- [[Lei 14.300-2022 01]]
