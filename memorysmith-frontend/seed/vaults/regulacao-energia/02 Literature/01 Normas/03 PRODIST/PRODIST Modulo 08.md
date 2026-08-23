---
title: PRODIST Modulo 08
aliases:
  - PRODIST Módulo 8
  - PRODIST Modulo 8
  - Qualidade do Fornecimento
  - DEC e FEC
tags:
  - aneel
  - prodist
  - distribuicao
  - qualidade
  - continuidade
type: literature
status: growing
source: REN ANEEL 956/2021, Anexo VIII — PRODIST Módulo 8, v14
author: ANEEL
created: 2026-07-26
---

## Identificação

| Campo | Conteúdo |
|---|---|
| Norma | Anexo VIII da REN ANEEL nº 956, de 7.12.2021 |
| Título | Módulo 8 — Qualidade do Fornecimento de Energia Elétrica |
| Versão | v14, consolidada com a REN 1.137/2025 |
| Extensão | 39 páginas |
| Situação | Vigente |
| Arquivo original | `docs/ANEEL/PRODIST/PRODIST-Modulo-08.pdf` |

## Resumo executivo

O módulo mais consequente do PRODIST. Define o que é fornecimento de qualidade em quatro dimensões — **produto** (conformidade de tensão), **serviço** (continuidade), **comercial** (prazos e atendimento) e **segurança** — e os indicadores que as medem, com limites e compensações.

Seus indicadores de continuidade não ficam confinados ao PRODIST: **DEC e FEC são condição de prorrogação da concessão** no [[Decreto 12.068-2024]], o que faz deste módulo a métrica de sobrevivência contratual da distribuidora. Ver [[Prorrogação da Concessão de Distribuição]].

## Estrutura

| Seção | Objeto |
|---|---|
| 8.1 | Qualidade do **produto** — conformidade de tensão em regime permanente e transitório |
| 8.2 | Qualidade do **serviço** — conjuntos de UCs, indicadores de continuidade, ocorrências emergenciais |
| 8.3 | Qualidade **comercial** — reclamações, atendimento telefônico, cumprimento de prazos, limites do FER |
| 8.4 | **Segurança** do trabalho e das instalações |
| Anexos | 8.A (faixas de tensão), 8.B, 8.C |

## Principais dispositivos

### Conformidade de tensão (Seção 8.1)

| Item | Regra |
|---|---|
| 17 | Desde **1º.1.2023** a distribuidora deve possuir certificação ISO 9000 do processo de medição, coleta, apuração de indicadores e compensações de tensão em regime permanente |
| 18–19 | A tensão medida é comparada à **tensão de referência** (nominal ou contratada) e classificada em **adequada**, **precária** ou **crítica** |
| 21 | Entre distribuidoras: em pontos ≥ 230 kV, contrata-se a tensão nominal; abaixo de 230 kV, entre **95% e 105%** da nominal |
| 22 | Usuários atendidos acima de 2,3 kV: contrato entre **95% e 105%** da nominal, coincidindo com terminal de derivação do transformador. Igual ou abaixo de 2,3 kV: a própria tensão nominal |
| 23–25 | Classificação por faixas em torno da tensão de referência, conforme Tabelas 1 a 11 do **Anexo 8.A** |
| 1254–1255 | Se a medição indicar faixa precária ou crítica, comunicar ao usuário em até **15 dias** da reclamação |

### Indicadores de continuidade (Seção 8.2, itens 173 e ss.)

**Individuais**, por unidade consumidora ou ponto de conexão:

| Sigla | Nome | Unidade |
|---|---|---|
| **DIC** | Duração de Interrupção Individual | horas e centésimos |
| **FIC** | Frequência de Interrupção Individual | número de interrupções |
| **DMIC** | Duração Máxima de Interrupção Contínua | horas e centésimos |
| **DICRI** | Duração da Interrupção Individual em **Dia Crítico** | horas e centésimos |
| **DISE** | Duração da Interrupção Individual em **Situação de Emergência** | horas e centésimos |

**Coletivos**, por conjunto de unidades consumidoras (itens 176–177):

| Sigla | Fórmula | Significado |
|---|---|---|
| **DEC** | Σ DIC(i) / NUC | Duração equivalente de interrupção por unidade consumidora |
| **FEC** | Σ FIC(i) / NUC | Frequência equivalente de interrupção por unidade consumidora |

| Item | Regra |
|---|---|
| 178 | Situações **excluídas** da apuração de DIC e FIC |
| 179 | Exclusões adicionais para o DMIC |
| 180 / 180-A | Exclusões próprias de DICRI e DISE |
| 181 | DICRI e DISE **não se aplicam** a determinadas unidades consumidoras e centrais geradoras |
| 186 | DEC e FEC comparáveis a limites decompõem-se em **DECip/FECip** (origem interna programada) e **DECind/FECind** (origem interna não programada) |
| 194 | Indicador **PIP** — DIC e FIC apurados para unidades em BT na área urbana |

> [!important] DISE é a marca da REN 1.137/2025
> O DISE — duração de interrupção em **Situação de Emergência** — foi introduzido pela resolução de resiliência. Junto com o DICRI (dia crítico), cria uma categoria de interrupção que é apurada e reportada mas tratada à parte dos limites ordinários. A disputa regulatória está inteira na fronteira: o que conta como situação de emergência sai do DEC.

> [!warning] Exclusões são o cerne do indicador
> Os itens 178 a 181 e 187 listam o que **não** entra na apuração. Um indicador de continuidade só é interpretável junto com sua lista de exclusões — comparar DEC entre distribuidoras sem checá-las produz conclusão errada.

## Conceitos apresentados

Já no vault: [[Serviço Adequado (Distribuição)]] · [[Prorrogação da Concessão de Distribuição]].

Candidatos a nota permanente: DEC · FEC · DIC · FIC · DMIC · DICRI · DISE · Tensão Adequada, Precária e Crítica · Dia Crítico · Situação de Emergência · Conjunto de Unidades Consumidoras · Compensação por Transgressão de Limite · FER.

## Alterações e revogações

| Norma | Efeito |
|---|---|
| REN 1.137/2025 | Introduz o indicador **DISE** e o regime de Situação de Emergência; ajusta exclusões (item 180-A). Versão 14 do anexo |

> [!question] Limites numéricos
> Os limites de DEC e FEC não estão no Módulo 8: são fixados por conjunto de unidades consumidoras em ato próprio da ANEEL. Localizar o ato vigente em 2026 e ligá-lo a esta nota.

---
Ref: [[REN 956-2021]], [[Decreto 12.068-2024]], [[PRODIST Modulo 06]], [[PRODIST Modulo 09]], [[Prorrogação da Concessão de Distribuição]]
