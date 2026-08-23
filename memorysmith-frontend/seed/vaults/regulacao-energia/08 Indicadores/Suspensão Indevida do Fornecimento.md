---
title: Suspensão Indevida do Fornecimento
aliases:
  - Corte indevido
  - Suspensão indevida
tags:
  - aneel
  - qualidade-comercial
  - suspensao
  - ren-1000
  - indger
  - dados-abertos
type: indicator
status: growing
source: "[[INDGER - Indicadores Gerenciais da Distribuição (ANEEL)]]"
author: ANEEL
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: monthly
data_source: https://dadosabertos.aneel.gov.br/dataset/indger-indicadores-gerenciais-da-distribuicao
coverage: 2023-01 a 2025-12
---

> [!abstract]
> Quantas vezes as distribuidoras cortaram o fornecimento sem que houvesse causa que o justificasse, e quanto pagaram de compensação por isso — o descumprimento normativo em que a distribuidora age contra o consumidor por iniciativa própria, não por omissão.

> [!info] Última atualização: 2026-07-27 · Cobertura: 2023-01 a 2025-12 · Cadência: mensal

## Valor atual

| Recorte | 2023 | 2024 | 2025 |
|---|---:|---:|---:|
| Suspensões **indevidas** | 31.363 | 58.584 | 80.687 |
| Compensação paga por suspensão indevida (R$) | 2.079.813,61 | 4.519.893,59 | 5.478.136,67 |
| Compensação média por caso (R$) | 66,32 | 77,15 | 67,89 |
| Suspensões por inadimplência | 17.637.566 | 17.437.793 | 17.754.087 |
| Unidades consumidoras ativas (média mensal) | 95.122.355 | 96.829.798 | 100.274.681 |
| Suspensões indevidas por 100 mil UC | 33,0 | 60,5 | 80,5 |
| Solicitações de ressarcimento por dano elétrico | 372.878 | 352.797 | 326.571 |
| Ressarcimento por dano efetivamente pago (R$) | 133.979.598,05 | 184.217.363,68 | 130.190.609,20 |

### Distribuidoras com maior incidência em 2025 (≥ 100 mil UC)

| Distribuidora | UC ativas (média) | Suspensões indevidas | Por 100 mil UC |
|---|---:|---:|---:|
| Companhia Piratininga de Força e Luz | 1.998.351 | 13.669 | 684,0 |
| Ampla Energia e Serviços | 3.115.003 | 18.660 | 599,0 |
| Companhia Paulista de Força e Luz | 5.102.237 | 29.311 | 574,5 |
| CPFL Santa Cruz | 520.105 | 1.480 | 284,6 |
| RGE Sul | 3.157.442 | 6.968 | 220,7 |
| Neoenergia Brasília | 1.212.704 | 678 | 55,9 |
| Enel CE | 4.296.991 | 1.753 | 40,8 |

## Método de cálculo

1. Recurso `indger-dados-comerciais.csv`, granularidade **município × mês**, agregado para distribuidora × ano.
2. `QtdSuspIndev` = suspensões indevidas; `VlrTotCompSuspIndevida` = compensação paga; `QtdUCSuspInadimplemento` = suspensões por inadimplência; `QtdUCAtiva` = unidades consumidoras ativas.
3. UC ativas: soma dos municípios em cada mês, depois **média dos meses** do ano — evita contar doze vezes o mesmo consumidor.
4. Taxa por 100 mil UC = 100.000 × suspensões indevidas ÷ UC ativas médias.
5. Recorte consumido: `data/processed/indger_comercial_distribuidora_ano.csv`.

> [!warning] A série começa em 2023
> O INDGER só publica dados comerciais a partir de 2023. Não há como situar o crescimento observado em uma janela mais longa, nem verificar se 2023 é um piso real ou apenas o primeiro ano de envio consolidado. Um salto no primeiro ano de uma obrigação de reporte costuma ser **melhoria de cobertura**, não piora do fenômeno.

> [!warning] A compensação por caso varia em duas ordens de grandeza entre distribuidoras
> Em 2025, a CPFL Piratininga registra 13.669 suspensões indevidas e R$ 49,5 mil de compensação (R$ 3,62 por caso), enquanto a Enel CE registra 1.753 casos e R$ 2,16 milhões (R$ 1.234 por caso). A REN 1.000/2021 prevê critério único; uma diferença de 340× entre concessionárias indica divergência de interpretação, de classificação do evento, ou erro de envio. **Não interpretar o valor agregado sem essa ressalva.**

> [!question]
> O dispositivo da REN 1.000/2021 que fixa a compensação por suspensão indevida não foi verificado contra o texto — a REN está em `docs/ANEEL/REN-1000-2021.pdf`, mas ainda sem nota de literatura do capítulo correspondente. Sem ela não é possível dizer se a dispersão acima é irregularidade ou é permitida pela regra.

## Leitura

O corte indevido mais que dobrou em dois anos, de 33 para 80,5 casos por 100 mil unidades consumidoras — enquanto o corte por inadimplência ficou estável em torno de 17,6 milhões por ano, o que afasta a explicação mais simples ("cortou-se mais, logo errou-se mais"). O volume absoluto continua pequeno diante da base (0,08% das UCs em 2025), mas a direção é inequívoca e a compensação média por caso, de R$ 68, é baixa o bastante para não funcionar como desincentivo.

O que o número **não** diz: se o crescimento é do fenômeno ou do reporte. Ver a ressalva sobre o início da série.

## Relação com a norma

Que regra este número mede: as condições de suspensão do fornecimento e a compensação devida ao consumidor por suspensão indevida, da REN 1.000/2021, e o critério de qualidade do [[Serviço Adequado (Distribuição)]].

---

Fonte: [[INDGER - Indicadores Gerenciais da Distribuição (ANEEL)]] · Ref: [[Serviço Adequado (Distribuição)]]
