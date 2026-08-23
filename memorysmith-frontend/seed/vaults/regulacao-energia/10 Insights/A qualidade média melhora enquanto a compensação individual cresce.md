---
title: A qualidade média melhora enquanto a compensação individual cresce
aliases:
  - Divergência entre média e cauda da continuidade
  - Melhora coletiva com piora individual
tags:
  - aneel
  - qualidade
  - continuidade
  - compensacao
  - prodist-8
  - insight
type: insight
status: growing
source: "[[Evolução da Transgressão dos Limites de DEC e FEC (2020–2025)]]"
author: Análise própria (assistida por IA)
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: quarterly
data_source: https://dadosabertos.aneel.gov.br/dataset/indicadores-coletivos-de-continuidade-dec-e-fec
coverage: 2020-01 a 2025-12
---

> [!abstract]
> Entre 2020 e 2025 a transgressão dos limites coletivos de continuidade caiu de 42,2% para 28,0% dos conjuntos e o excedente de horas caiu 61% — mas a compensação paga por violação de limite individual subiu 57%, de R$ 637 milhões para R$ 1,00 bilhão. As duas curvas apontam para lados opostos porque medem consumidores diferentes.

> [!info] Leitura feita em 2026-07-27 · Baseada em: [[Evolução da Transgressão dos Limites de DEC e FEC (2020–2025)]], [[Evolução da Compensação por Continuidade e das Multas (2020–2025)]] · Cadência de revisão: trimestral

## O achado

O indicador coletivo é uma **média**: o DEC de um conjunto é a soma das durações de interrupção de todas as suas unidades consumidoras dividida pelo número delas (PRODIST M8, Equação 36). O indicador individual é o **caso**: o DIC de uma unidade consumidora específica.

Uma rede pode melhorar na média e piorar na cauda ao mesmo tempo — e é exatamente o que os dois conjuntos de dados mostram na mesma janela:

|                                         |            2020 |              2025 |   Variação |
| --------------------------------------- | --------------: | ----------------: | ---------: |
| Conjuntos acima do limite coletivo      |           42,2% |             28,0% | −14,2 p.p. |
| DEC mediano do conjunto                 |         10,69 h |            8,65 h |       −19% |
| Excedente agregado de DEC               |         9.889 h |           3.821 h |       −61% |
| **Compensação por violação individual** | **R$ 637,1 mi** | **R$ 1.003,4 mi** |   **+57%** |

Não é contradição: é a diferença entre o consumidor médio e o consumidor mal atendido. O primeiro melhorou muito; o segundo continua sendo compensado — e cada vez mais.

## Evidência

| Nota de contexto | O que ela mostra |
|---|---|
| [[Evolução da Transgressão dos Limites de DEC e FEC (2020–2025)]] | Queda monotônica da transgressão coletiva; painel equilibrado de 2.417 conjuntos confirma (41,8% → 28,1%) |
| [[Transgressão dos Limites Coletivos de Continuidade]] | Excedente agregado de DEC cai 61%, mais rápido que a contagem de transgressores (−33%) |
| [[Evolução da Compensação por Continuidade e das Multas (2020–2025)]] | Compensação sobe de R$ 637 mi para R$ 1.122 mi (pico em 2024), recuando para R$ 1.003 mi em 2025 |
| [[Compensação por Violação dos Limites Individuais de Continuidade]] | R$ 5,33 bi acumulados; rubrica mensal responde por quase todo o crescimento |

## Confronto com a norma

O achado **confirma** o desenho do [[Indicadores Coletivos de Continuidade (DEC e FEC)]] e da [[Compensação por Violação dos Limites de Continuidade]]: as duas camadas existem justamente porque a média esconde o caso. Se o PRODIST M8 tivesse só a camada coletiva, os R$ 5,33 bilhões devolvidos ao consumidor no período não existiriam — e a melhora da média teria sido lida como melhora geral.

O que ele tensiona é o uso do indicador coletivo como **critério isolado** de [[Serviço Adequado (Distribuição)]]. O Decreto 12.068/2024, art. 2º, § 2º, mede continuidade pela frequência e duração médias das interrupções. Uma concessionária pode atender esse critério, ter a prorrogação recomendada, e ao mesmo tempo estar pagando compensação individual crescente — porque o critério não enxerga a cauda.

## Hipóteses alternativas

| Hipótese | O que descartaria |
|---|---|
| **Endurecimento dos limites individuais**, não piora do serviço — os limites individuais são vinculados aos coletivos (item 216), e os coletivos endureceram (mediana de 11 h para 10 h). Régua mais curta gera mais violação a igual desempenho | Recalcular a compensação com os limites de 2020 congelados. Exige a tabela de limites individuais por classe, que **não está** no conjunto de dados coletivos |
| **Efeito de preço, não de quantidade** — a compensação é indexada e o valor por violação subiu com a tarifa, sem que as violações aumentassem | Deflacionar a série pelo IPCA e pela evolução da tarifa média. Os dados de tarifa estão fichados em [[Tarifas de Aplicação das Distribuidoras (ANEEL)]], ainda não coletados |
| **Crescimento do mercado** — mais unidades consumidoras, logo mais violações individuais em termos absolutos | As UCs ativas passaram de 95,1 mi (2023) para 100,3 mi (2025), +5,4%, muito abaixo dos +57% da compensação. Enfraquece a hipótese, mas a série de UCs só começa em 2023 |
| **Melhora do reporte** — as distribuidoras passaram a registrar e pagar compensações que antes deixavam de pagar | Cruzar com autuações por não pagamento de compensação e com as reclamações de 2º nível. Conjuntos fichados, não coletados |
| **Efeito climático** — mais eventos severos concentrados em poucos consumidores elevam o DIC sem mover o DEC do conjunto | A rubrica DICRI (dia crítico) sobe de R$ 25,4 mi para R$ 57,6 mi entre 2020 e 2024, recuando a R$ 31,6 mi em 2025 — variação grande, mas pequena diante dos R$ 1 bi da rubrica mensal. Explica parte, não o todo |

## O que invalidaria esta leitura

1. **Deflacionar a compensação e a alta desaparecer.** Se em termos reais e por unidade consumidora a compensação for estável, o achado se reduz a efeito de preço e mercado. Este é o teste mais importante e ainda não foi feito.
2. **Demonstrar que o endurecimento dos limites individuais explica sozinho o aumento.** Nesse caso a cauda não piorou — a régua encurtou, e o achado vira uma leitura sobre a regra, não sobre o serviço.
3. **Uma quebra de série não detectada.** A rubrica mensal salta de R$ 518 mi (2021) para R$ 734 mi (2022) no mesmo ano em que as rubricas anual e trimestral desaparecem. Se parte desse salto for realocação contábil e não violação nova, o crescimento de 57% está superestimado. **Esta é a fragilidade conhecida do achado** e está declarada em [[Compensação por Violação dos Limites Individuais de Continuidade]].

> [!question]
> Qual foi exatamente a mudança que fez as rubricas de compensação por apuração anual e trimestral desaparecerem a partir de 2022? A REN 956/2021 revisou o PRODIST e está em `docs/ANEEL/REN-956-2021.pdf`, mas o dispositivo específico não foi verificado. Sem essa resposta, a série 2020–2025 de compensação convive com uma quebra não explicada.

---

Fonte: [[Evolução da Transgressão dos Limites de DEC e FEC (2020–2025)]], [[Evolução da Compensação por Continuidade e das Multas (2020–2025)]] · Ref: [[Indicadores Coletivos de Continuidade (DEC e FEC)]], [[Compensação por Violação dos Limites de Continuidade]]
