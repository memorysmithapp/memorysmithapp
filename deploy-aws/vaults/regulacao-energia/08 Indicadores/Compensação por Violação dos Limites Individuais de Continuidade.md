---
title: Compensação por Violação dos Limites Individuais de Continuidade
aliases:
  - Compensação por continuidade
  - Crédito na fatura por DIC/FIC/DMIC
tags:
  - aneel
  - qualidade
  - continuidade
  - compensacao
  - prodist-8
  - dados-abertos
type: indicator
maturity: growing
reviewed: false
source: "[[Indicadores Coletivos de Continuidade DEC e FEC (ANEEL)]]"
author: ANEEL
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: monthly
data_source: https://dadosabertos.aneel.gov.br/dataset/indicadores-coletivos-de-continuidade-dec-e-fec
coverage: 2020-01 a 2025-12
---

> [!abstract]
> Quanto as distribuidoras creditaram na fatura dos consumidores por violar os limites individuais de continuidade (DIC, FIC, DMIC, DICRI, DISE) — a única consequência financeira automática do descumprimento do padrão de qualidade.

> [!info] Última atualização: 2026-07-27 · Cobertura: 2020-01 a 2025-12 · Cadência: mensal

## Valor atual

| Recorte | Valor | Unidade |
|---|---|---|
| Compensação paga em 2025 | 1.003.408.368,70 | R$ |
| Compensação paga em 2020 | 637.138.643,62 | R$ |
| **Acumulado 2020–2025** | **5.333.980.223,81** | R$ |
| Unidades consumidoras compensadas em 2025 | 21.673.877 | créditos |
| Distribuidoras com compensação registrada em 2025 | 84 | distribuidoras |

### Por apuração violada (R$ milhões)

| Ano | Mensal | Trimestral | Anual | DICRI (dia crítico) |
|---|---:|---:|---:|---:|
| 2020 | 440,6 | 89,8 | 81,3 | 25,4 |
| 2021 | 518,3 | 85,2 | 91,7 | 27,8 |
| 2022 | 734,3 | 8,4 | — | 24,3 |
| 2023 | 1.025,9 | 6,7 | — | 49,0 |
| 2024 | 1.055,7 | 8,5 | — | 57,6 |
| 2025 | 964,1 | 7,7 | — | 31,6 |

### Distribuidoras com maior compensação acumulada (2020–2025)

| Distribuidora | R$ milhões |
|---|---:|
| EQUATORIAL GO | 715,6 |
| CEMIG-D | 580,6 |
| ELETROPAULO | 511,4 |
| COELBA | 380,6 |
| RGE SUL | 281,9 |
| EMT | 274,4 |
| CEEE-D | 238,3 |
| ENEL RJ | 214,7 |
| CPFL-PAULISTA | 206,1 |
| ENEL CE | 191,2 |

## Método de cálculo

1. Recurso `indicadores-continuidade-coletivos-compensacao-2020-2029` (usado o PARQUET — mesma tabela do CSV, já tipada e 3× menor).
2. Filtro `SigIndicador` iniciado por **`PGUC`** (valor pago, R$) e **`QTUC`** (nº de unidades consumidoras compensadas). O sufixo do código identifica a apuração violada: sem sufixo = mensal, `T` = trimestral, `A` = anual, `DC` = DICRI, `DS` = DISE. O segmento do meio identifica a tensão e a localização (`AT`, `MTU`, `MTNU`, `BTU`, `BTNU`).
3. Soma por distribuidora e ano de todas as rubricas `PGUC*`; idem para `QTUC*`.
4. Recorte consumido: `data/processed/compensacao_distribuidora_ano.csv` e `compensacao_por_apuracao_ano.csv`.

> [!important] Isto não é compensação por DEC/FEC
> O PRODIST M8, item 219, prevê compensação pela violação dos limites **individuais** — DIC, FIC, DMIC, DICRI e DISE — de cada unidade consumidora. **Não há compensação pela violação do limite coletivo de DEC ou FEC do conjunto.** Os dois convivem no mesmo conjunto de dados e são medidas de coisas diferentes: ver [[Transgressão dos Limites Coletivos de Continuidade]] e o insight [[A transgressão do limite coletivo não tem consequência financeira direta]].

> [!warning] Quebra metodológica em 2022
> As rubricas de apuração **anual** desaparecem a partir de 2022 e a trimestral cai de R$ 85,2 mi (2021) para R$ 8,4 mi (2022) — queda de 90% em um ano, sem transição. O padrão é típico de mudança de regra ou de forma de envio, e coincide com a entrada em vigor da REN 956/2021 (que aprovou a revisão do PRODIST). **A causa não foi verificada contra o texto normativo** — ver a investigação aberta na nota de dataset. Séries que atravessem 2021–2022 nessas rubricas não são comparáveis.

> [!warning] Contagem de UCs compensadas não é comparável antes e depois de 2022
> `QTUC*` cai de ~80 milhões (2020–2021) para ~20–27 milhões (2022–2025) enquanto o valor pago **sobe**. Isso é incompatível com uma leitura de "menos consumidores compensados": ou a unidade de contagem mudou (crédito × unidade consumidora distinta), ou houve dupla contagem nas rubricas anual e trimestral que sumiram. O valor em R$ é a medida confiável desta nota; a contagem de UCs **não deve ser citada em série**.

## Leitura

Mais de **R$ 5,3 bilhões** devolvidos ao consumidor em seis anos por falha de continuidade individual — e a curva sobe: 2025 pagou 57% a mais que 2020. O número mede a falha que chega ao bolso de um consumidor identificável, e é a maior consequência financeira do descumprimento de qualidade no setor de distribuição, maior do que todas as multas somadas ([[Autos de Infração e Multas Aplicados a Distribuidoras]]).

O que o número **não** diz: se o crescimento vem de mais falhas ou de limites individuais mais rígidos. Os limites individuais são vinculados aos coletivos (PRODIST M8, item 216) e os coletivos endureceram no período — ver [[Evolução da Transgressão dos Limites de DEC e FEC (2020–2025)]].

## Relação com a norma

Que regra este número mede: [[Compensação por Violação dos Limites de Continuidade]] (PRODIST Módulo 8, itens 219 a 225) e, indiretamente, o direito ao [[Serviço Adequado (Distribuição)]].

---

Fonte: [[Indicadores Coletivos de Continuidade DEC e FEC (ANEEL)]] · Ref: [[Compensação por Violação dos Limites de Continuidade]]
