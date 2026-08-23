---
title: A transgressão crônica se concentra e não muda de dono
aliases:
  - Concentração da má qualidade
  - Conjuntos cronicamente irregulares
tags:
  - aneel
  - qualidade
  - continuidade
  - concessoes
  - prodist-8
  - insight
type: insight
status: evergreen
source: "[[Transgressão dos Limites Coletivos de Continuidade]]"
author: Análise própria (assistida por IA)
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: quarterly
data_source: https://dadosabertos.aneel.gov.br/dataset/indicadores-coletivos-de-continuidade-dec-e-fec
coverage: 2020-01 a 2025-12
---

> [!abstract]
> Metade de todo o excedente de horas de interrupção de 2025 está em 120 dos 3.146 conjuntos do país (3,8%), e 299 conjuntos transgrediram o limite nos seis anos seguidos. O descumprimento de continuidade não é um risco difuso do setor — é um endereço fixo.

> [!info] Leitura feita em 2026-07-27 · Baseada em: [[Transgressão dos Limites Coletivos de Continuidade]], [[Evolução da Transgressão dos Limites de DEC e FEC (2020–2025)]] · Cadência de revisão: trimestral

## O achado

**Concentração espacial.** Ordenados pelo excedente de DEC em 2025:

| Fatia do excedente total | Conjuntos necessários | % dos 3.146 conjuntos |
|---|---:|---:|
| 50% | 120 | 3,8% |
| 80% | 310 | 9,9% |
| 90% | 434 | 13,8% |

**Persistência temporal.** Dos 2.417 conjuntos com os seis anos completos:

| Anos em transgressão | Conjuntos | % |
|---|---:|---:|
| 0 (nunca) | 821 | 34,0% |
| 1 a 2 | 679 | 28,1% |
| 3 a 5 | 618 | 25,6% |
| **6 (todos)** | **299** | **12,4%** |

Um terço dos conjuntos nunca esteve acima do limite; um oitavo esteve **todos os anos**. A distribuição é bimodal, não gradual — o que descreve dois grupos, não um espectro.

**Severidade, não calibração.** Os 299 crônicos não estão raspando o limite: a razão apurado/limite tem mediana **1,56** (quartis 1,29 e 2,03) contra 0,82 nos demais conjuntos do painel, e apenas 7,6% das suas observações em transgressão ficam até 10% acima da régua. O DEC mediano do crônico é de **20,84 horas por ano**, contra 8,22 horas nos demais — duas horas e meia de interrupção para cada hora do resto do país.

**Persistência empresarial.** Entre as 32 distribuidoras com 20 ou mais conjuntos e presença nos seis anos, **30 tiveram pelo menos um conjunto em transgressão em todos os seis anos.** E as posições no topo do ranking não giram: CEEE-D (85,7% dos conjuntos em transgressão, média do período), EQUATORIAL GO (80,2%), EQUATORIAL AL (66,6%), EQUATORIAL PI (60,8%) e ENEL CE (53,0%) ocupam os primeiros lugares de forma estável.

## Evidência

| Nota de contexto | O que ela mostra |
|---|---|
| [[Transgressão dos Limites Coletivos de Continuidade]] | Pareto do excedente de 2025; ranking de distribuidoras por taxa média de transgressão e excedente acumulado |
| [[Evolução da Transgressão dos Limites de DEC e FEC (2020–2025)]] | Painel equilibrado de 2.417 conjuntos, base da contagem de cronicidade |
| [[Compensação por Violação dos Limites Individuais de Continuidade]] | EQUATORIAL GO e CEEE-D — as duas primeiras em taxa de transgressão — estão entre as sete que mais pagaram compensação |

## Confronto com a norma

O achado tensiona o [[Serviço Adequado (Distribuição)]] e alimenta [[Caducidade da Concessão de Distribuição]] e [[Plano de Resultados]].

O [[Decreto 12.068-2024]], art. 2º, § 5º, reprova a prorrogação quando o critério de continuidade é descumprido por **três anos consecutivos**, e o art. 5º abre caducidade com **dois**. Ambos avaliam o indicador global da concessionária, não a contagem de conjuntos — mas a existência de 299 conjuntos em transgressão contínua por seis anos, distribuídos por 30 das 32 maiores concessionárias, indica que o problema tem endereço conhecido e estável. Um plano de resultados que não priorize esses conjuntos não muda o indicador global.

A concentração também sugere um caminho de fiscalização que os dados mostram não estar sendo usado: com 120 conjuntos responde-se por metade do excedente do país, e foram lavrados 23 autos por continuidade em seis anos ([[A transgressão do limite coletivo não tem consequência financeira direta]]).

## Hipóteses alternativas

| Hipótese | O que descartaria |
|---|---|
| **Conjuntos crônicos são estruturalmente difíceis** — rurais, extensos, de baixa densidade, onde o limite é frouxo mas o custo de melhoria é proibitivo | Cruzar com os atributos do conjunto (extensão de rede, área, densidade de UC). O recurso `atributos` **termina em 2014** e não cobre a janela — a hipótese não é testável hoje com dados abertos |
| ~~**O limite está mal calibrado para esses conjuntos**, e não o serviço mal prestado~~ | **Testada e descartada em 2026-07-27**: a razão apurado/limite dos crônicos tem mediana 1,56, e 83,9% das observações ficam acima de 1,20. Não é ruído de calibração — é serviço distante do padrão |
| **Efeito de subdivisão de conjuntos** — o conjunto "crônico" de hoje não é o mesmo de 2020 | O painel equilibrado exige o mesmo `IdeConjUndConsumidoras` nos seis anos, o que reduz mas não elimina o risco: o identificador pode ser mantido após reagrupamento (PRODIST M8, item 213) |
| **Concentração é artefato de escala** — conjuntos grandes acumulam mais excedente por terem mais consumidores | O excedente aqui é em **horas de DEC**, que já é uma média por unidade consumidora, não um total. A hipótese é fraca, mas a ponderação por UC confirmaria — e não é reproduzível na janela |

## O que invalidaria esta leitura

1. ~~**Descobrir que os crônicos estão logo acima do limite.**~~ Teste feito: mediana de 1,56 e DEC mediano de 20,84 h contra 8,22 h nos demais. A hipótese de calibração está descartada e o achado saiu reforçado.
2. **Instabilidade do identificador de conjunto.** Se `IdeConjUndConsumidoras` for reaproveitado após reagrupamento, o painel equilibrado é ilusório e a persistência é artefato.
3. **Mudança de controle acionário.** Distribuidoras que mudaram de dono no período (caso da CEEE-D, privatizada em 2021) não são a mesma gestão em 2020 e 2025 — "não muda de dono" vale para o conjunto e a concessão, não necessariamente para o controlador.

> [!question]
> Os 299 conjuntos cronicamente em transgressão estão nas mesmas distribuidoras que reprovariam no critério de continuidade do art. 2º, § 2º do Decreto 12.068/2024? Responder exige o indicador **global** por concessionária, que depende da ponderação por número de unidades consumidoras — indisponível nos dados abertos para 2020–2025.

---

Fonte: [[Transgressão dos Limites Coletivos de Continuidade]] · Ref: [[Serviço Adequado (Distribuição)]], [[Caducidade da Concessão de Distribuição]], [[Plano de Resultados]]
