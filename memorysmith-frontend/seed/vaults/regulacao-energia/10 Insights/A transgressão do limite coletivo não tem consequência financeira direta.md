---
title: A transgressão do limite coletivo não tem consequência financeira direta
aliases:
  - Limite coletivo sem sanção
  - DEC e FEC transgredidos sem consequência
tags:
  - aneel
  - qualidade
  - continuidade
  - fiscalizacao
  - prodist-8
  - insight
type: insight
status: growing
source: "[[Transgressão dos Limites Coletivos de Continuidade]]"
author: Análise própria (assistida por IA)
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: quarterly
data_source: https://dadosabertos.aneel.gov.br/dataset/indicadores-coletivos-de-continuidade-dec-e-fec
coverage: 2020-01 a 2025-12
---

> [!abstract]
> Transgredir o limite anual de DEC ou FEC de um conjunto não gera compensação ao consumidor nem, na prática, multa: em seis anos houve 274 combinações distribuidora-ano com conjuntos acima do limite e apenas 23 autos de infração por continuidade — dos quais nenhum em 2021 e 2023, e os cinco de 2025 sem valor pecuniário.

> [!info] Leitura feita em 2026-07-27 · Baseada em: [[Transgressão dos Limites Coletivos de Continuidade]], [[Autos de Infração e Multas Aplicados a Distribuidoras]], [[Evolução da Compensação por Continuidade e das Multas (2020–2025)]] · Cadência de revisão: trimestral

## O achado

O PRODIST Módulo 8 monta duas camadas de limite de continuidade. Os limites **coletivos** (DEC e FEC por conjunto) são fixados na revisão tarifária e alimentam o ranking de continuidade das distribuidoras (itens 205 a 213). Os limites **individuais** (DIC, FIC, DMIC, DICRI, DISE) são derivados dos coletivos (item 216) e, esses sim, geram compensação automática na fatura quando violados (item 219).

A consequência disso é que **a violação do limite coletivo — a régua que define o padrão de qualidade do conjunto — não tem sanção automática associada.** A única resposta possível é discricionária: o auto de infração. E ela quase não acontece.

Em 2025, 881 dos 3.146 conjuntos com apuração completa (28,0%) encerraram o ano acima do limite. Em toda a janela 2020–2025, 68 distribuidoras registraram transgressão em 274 anos-empresa. No mesmo período, a ANEEL e as agências conveniadas lavraram **23 autos** com natureza "Indicadores de Continuidade" contra distribuidoras — 8,4% dos anos-empresa em transgressão — somando R$ 199,1 milhões, ou 9,4% de todo o valor lavrado contra distribuidoras.

Enquanto isso, a compensação por violação **individual**, que ninguém precisa decidir aplicar, somou R$ 5,33 bilhões: 26,8 vezes o valor das multas por continuidade.

## Evidência

| Nota de contexto | O que ela mostra |
|---|---|
| [[Transgressão dos Limites Coletivos de Continuidade]] | 881 conjuntos (28,0%) acima do limite em 2025; 274 distribuidora-ano em transgressão em 2020–2025 |
| [[Autos de Infração e Multas Aplicados a Distribuidoras]] | 23 autos por continuidade contra distribuidoras em 2020–2025; taxa de autuação de 8,4%; R$ 199,1 mi |
| [[Evolução da Compensação por Continuidade e das Multas (2020–2025)]] | Zero autos por continuidade em 2021 e 2023; os cinco de 2025 sem valor de multa; compensação 2,5× a multa total |
| [[Compensação por Violação dos Limites Individuais de Continuidade]] | R$ 5,33 bi pagos por violação **individual**, sem intervenção do regulador |

## Confronto com a norma

O achado tensiona [[Indicadores Coletivos de Continuidade (DEC e FEC)]] e [[Serviço Adequado (Distribuição)]].

O desenho não é uma lacuna acidental: o PRODIST M8 nunca prometeu compensação por DEC/FEC coletivo. O que o dado revela é que **a camada coletiva funciona como sinalização, não como obrigação exigível** — ela produz ranking (item 207) e alimenta o critério de prorrogação do [[Decreto 12.068-2024]], mas não produz custo imediato para quem a descumpre. O custo chega, quando chega, por via indireta: pelo limite individual derivado dela.

Isso importa porque o Decreto 12.068/2024 escolheu justamente a continuidade como um dos dois critérios de [[Serviço Adequado (Distribuição)]], com três anos de descumprimento reprovando a prorrogação e dois abrindo [[Caducidade da Concessão de Distribuição]]. Um critério que, até 2024, não vinha acompanhado de consequência corrente.

## Hipóteses alternativas

| Hipótese | O que descartaria |
|---|---|
| **A fiscalização é seletiva por materialidade** — pune só quem transgride muito, não quem transgride pouco | Cruzar os 23 autos com o excedente de horas da distribuidora no ano anterior. Se os autuados forem os de maior excedente, a taxa de 8,4% é desenho e não omissão |
| **A sanção existe mas por outro caminho** — determinação, termo de compromisso, ajuste no ciclo tarifário, sem virar auto | Os conjuntos de dados `Termo de Intimação (ANEEL)` e as decisões da diretoria, ainda não coletados |
| **A compensação automática é considerada suficiente** — o regulador entende que R$ 5,3 bi já cumprem a função dissuasória | Nota técnica ou voto da ANEEL declarando essa posição. Não está em `docs/` |
| **Defasagem de registro** — o auto é lavrado anos depois do fato e a série 2020–2025 ainda não "amadureceu" | A janela 2018–2019 já madura mostra 9 e 31 autos contra distribuidoras, sem concentração em continuidade. Enfraquece a hipótese, não a elimina |
| **A base de autos de infração é incompleta** para as agências estaduais conveniadas | Comparar com os relatórios de fiscalização da ANEEL. O conjunto declara cobertura a partir de mai/2018 e traz 11 agências estaduais |

## O que invalidaria esta leitura

1. **Encontrar consequência não capturada.** Se os termos de intimação, as determinações de fiscalização ou os ajustes no reposicionamento tarifário responderem sistematicamente à transgressão coletiva, a afirmação "não tem consequência" cai — o que existe é uma consequência que não passa pelo auto de infração.
2. **Descobrir que a taxa de 8,4% é materialidade e não tolerância.** Se os 23 autos se concentrarem nos anos-empresa de maior excedente, a leitura muda de "quase não se pune" para "pune-se de forma concentrada".
3. **Uma nova REN criando compensação por limite coletivo.** Nesse caso o achado passa a ser histórico e a nota precisa declarar a data de corte.
4. **Erro na identificação das distribuidoras.** A separação distribuidora × gerador foi feita por CNPJ contra o cadastro de conjuntos de unidades consumidoras. Se distribuidoras autuadas ficaram de fora por não terem conjunto na base, os 141 autos estão subestimados — e a taxa de 8,4%, também.

> [!question]
> Como o excedente de continuidade de um ano se traduz — se é que se traduz — no reposicionamento tarifário do ciclo seguinte? A resposta está no PRORET Submódulo 2.x (fator X, componente Q), presente em `docs/ANEEL/PRORET/` mas ainda sem nota de literatura. É a hipótese mais forte de "consequência por outro caminho".

---

Fonte: [[Transgressão dos Limites Coletivos de Continuidade]], [[Autos de Infração e Multas Aplicados a Distribuidoras]] · Ref: [[Indicadores Coletivos de Continuidade (DEC e FEC)]], [[Serviço Adequado (Distribuição)]]
