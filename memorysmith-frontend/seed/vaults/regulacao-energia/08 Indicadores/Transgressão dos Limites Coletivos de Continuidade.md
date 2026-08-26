---
title: Transgressão dos Limites Coletivos de Continuidade
aliases:
  - Transgressão de DEC e FEC
  - Conjuntos acima do limite de continuidade
tags:
  - aneel
  - qualidade
  - dec
  - fec
  - continuidade
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
> Quantos conjuntos de unidades consumidoras encerraram o ano com DEC ou FEC apurado acima do limite anual fixado pela ANEEL — a medida direta de descumprimento do padrão de continuidade que o PRODIST Módulo 8 impõe à distribuidora.

> [!info] Última atualização: 2026-07-27 · Cobertura: 2020-01 a 2025-12 · Cadência: mensal

## Valor atual

| Recorte (ano de 2025)                                      | Valor    | Unidade         |
| ---------------------------------------------------------- | -------- | --------------- |
| Conjuntos com apuração completa e limite vigente           | 3.146    | conjuntos       |
| Conjuntos que transgrediram DEC **ou** FEC                 | 881      | conjuntos       |
| **Taxa de transgressão**                                   | **28,0** | % dos conjuntos |
| Conjuntos que transgrediram o limite de DEC                | 810      | conjuntos       |
| Conjuntos que transgrediram o limite de FEC                | 346      | conjuntos       |
| DEC apurado — mediana                                      | 8,65     | horas/ano       |
| Limite de DEC — mediana                                    | 10,00    | horas/ano       |
| Razão apurado/limite de DEC — mediana                      | 0,83     | —               |
| Excedente agregado de DEC (soma das horas acima do limite) | 3.821    | horas           |
| Distribuidoras com ao menos um conjunto em transgressão    | 68       | distribuidoras  |

### Distribuidoras com maior taxa de transgressão (média 2020–2025, ≥ 20 conjuntos)

| Distribuidora       | Conjuntos | % de conjuntos em transgressão | Excedente de DEC acumulado (h) |
| ------------------- | --------: | -----------------------------: | -----------------------------: |
| CEEE-D              |        62 |                           85,7 |                          4.079 |
| EQUATORIAL GO       |       153 |                           80,2 |                         12.712 |
| EQUATORIAL AL       |        40 |                           66,6 |                          1.582 |
| EQUATORIAL PI       |        51 |                           60,8 |                          1.512 |
| Neoenergia Brasília |        25 |                           54,2 |                            412 |
| ENEL CE             |       114 |                           53,0 |                          2.432 |
| EQUATORIAL MA       |        97 |                           50,9 |                          3.450 |
| ENEL RJ             |        81 |                           48,2 |                          1.231 |
| CEMIG-D             |       285 |                           46,2 |                          2.927 |
| ELETROPAULO         |       143 |                           42,1 |                            806 |

## Método de cálculo

1. **Apurado anual.** O conjunto de dados publica DEC e FEC **mensais** por conjunto (`NumPeriodoIndice` = 1…12; não há registro anual na fonte). O valor anual é a soma dos doze meses. Anos com menos de doze meses enviados são descartados da comparação — não estimados.
2. **Limite.** O recurso `indicadores-continuidade-coletivos-limite` traz o limite **anual** por conjunto e indicador (`AnoLimiteQualidade`, `VlrLimite`), fixado pela ANEEL na revisão tarifária ([[Indicadores Coletivos de Continuidade (DEC e FEC)]], PRODIST M8 itens 209–213).
3. **Transgressão.** `apurado > limite`, avaliado separadamente para DEC e FEC; o conjunto conta como transgressor se violar qualquer um dos dois.
4. **Excedente.** `max(apurado − limite, 0)`, somado sobre os conjuntos. Mede o tamanho da falha, não só a sua ocorrência.
5. Junção por `NumCNPJ` + `IdeConjUndConsumidoras` + ano. Valores textuais com vírgula decimal convertidos em `data/scripts/processa_qualidade_fiscalizacao.py`.

Recorte consumido por esta nota: `data/processed/qualidade_conjunto_ano.csv` e `qualidade_distribuidora_ano.csv`.

> [!warning] A agregação exata é ponderada; esta usa a soma simples
> O PRODIST M8, item 202 (Equações 38 a 40), define a agregação temporal ponderada pelo número de unidades consumidoras de cada mês (`NUC_n`). Com `NUC` constante ao longo do ano, a fórmula se reduz à soma dos doze valores mensais — que é o que esta nota faz. O `NUC` por conjunto só está publicado no recurso `atributos`, **cuja série termina em 2014**: a ponderação exata não é reproduzível a partir dos dados abertos para a janela 2020–2025. A diferença é de segunda ordem, mas existe e está declarada.

> [!warning] Não confundir com o critério do Decreto 12.068/2024
> O art. 2º, § 2º do decreto mede continuidade pelos indicadores **globais da concessionária**, não pela contagem de conjuntos acima do limite. Este indicador é uma leitura por conjunto — mais granular e mais severa, porque uma distribuidora pode ter indicador global dentro do limite e ainda assim manter dezenas de conjuntos em transgressão. Ver [[Serviço Adequado (Distribuição)]].

## Leitura

Quase três em cada dez conjuntos do país encerraram 2025 acima do limite de continuidade que a própria ANEEL fixou para eles. O número diz que o descumprimento do padrão de qualidade é **rotina, não exceção** — mas a mediana da razão apurado/limite é 0,83, o que mostra que a distribuição é assimétrica: a maior parte dos conjuntos opera com folga e a transgressão se concentra numa cauda.

O que o número **não** diz: quantos consumidores estão dentro desses 881 conjuntos. A ponderação por unidades consumidoras exigiria o `NUC` por conjunto, indisponível na janela — ver a ressalva acima e [[A transgressão crônica se concentra e não muda de dono]].

## Relação com a norma

Que regra este número mede: o limite anual de DEC e FEC por conjunto, do [[Indicadores Coletivos de Continuidade (DEC e FEC)]] (PRODIST Módulo 8, itens 209 a 213), e o critério de continuidade do [[Serviço Adequado (Distribuição)]] que condiciona a prorrogação da concessão.

---

Fonte: [[Indicadores Coletivos de Continuidade DEC e FEC (ANEEL)]] · Ref: [[Indicadores Coletivos de Continuidade (DEC e FEC)]], [[Serviço Adequado (Distribuição)]]
