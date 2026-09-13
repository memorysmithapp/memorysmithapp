---
title: Autos de Infração e Multas Aplicados a Distribuidoras
aliases:
  - Autos de infração contra distribuidoras
  - Multas da fiscalização da distribuição
tags:
  - aneel
  - fiscalizacao
  - auto-de-infracao
  - penalidade
  - concessoes
  - dados-abertos
type: indicator
maturity: growing
reviewed: false
source: "[[Auto de Infração (ANEEL)]]"
author: ANEEL
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: monthly
data_source: https://dadosabertos.aneel.gov.br/dataset/auto-de-infracao
coverage: 2020-01 a 2025-12
---

> [!abstract]
> Quantos autos de infração a ANEEL e as agências estaduais conveniadas lavraram contra distribuidoras de energia, por que natureza e com que valor de multa — a face discricionária da consequência do descumprimento normativo.

> [!info] Última atualização: 2026-07-27 · Cobertura: 2020-01 a 2025-12 · Cadência: mensal

## Valor atual

| Recorte (2020–2025)                                        | Valor            | Unidade                                 |
| ---------------------------------------------------------- | ---------------- | --------------------------------------- |
| Autos de infração na base inteira (todos os agentes)       | 1.580            | autos                                   |
| Autos lavrados contra **distribuidoras**                   | 141              | autos                                   |
| Multa aplicada a distribuidoras                            | 2.126.309.149,86 | R$                                      |
| Autos com natureza "Indicadores de Continuidade"           | 23               | autos                                   |
| Multa dos autos de continuidade                            | 199.055.071,78   | R$                                      |
| Distribuidoras autuadas por continuidade                   | 17               | distribuidoras                          |
| Distribuidora-ano com ao menos um conjunto em transgressão | 274              | de 567                                  |
| **Taxa de autuação por continuidade**                      | **8,4**          | % das distribuidora-ano em transgressão |

### Autos contra distribuidoras por natureza da fiscalização (2020–2025)

| Natureza                                                         | Autos | Multa (R$ mi) |
| ---------------------------------------------------------------- | ----: | ------------: |
| Comercial                                                        |    44 |         856,1 |
| Técnica                                                          |    35 |         984,2 |
| Indicadores de Continuidade                                      |    23 |         199,1 |
| Apoio ao Processo Decisório, Anuência e Conformidade Regulatória |    11 |          16,4 |
| Anuência — Contrato entre Partes Relacionadas                    |     7 |          12,5 |
| Apoio ao Processo Decisório e Conformidade Regulatória           |     6 |           4,1 |
| Acesso ao Sistema de Distribuição                                |     2 |          21,2 |
| Indicadores de reclamações — DER e FER                           |     2 |          10,8 |
| Qualidade de Atendimento ao Consumidor                           |     2 |           3,5 |
| Demais                                                           |     9 |          18,4 |

## Método de cálculo

1. Recurso `auto-infracao.csv` (encoding **latin-1**, ao contrário dos demais conjuntos do portal, que vêm em UTF-8).
2. **Identificação das distribuidoras**: `NumCPFCNPJAgenteFiscalizado` normalizado para 14 dígitos e cruzado com o conjunto de CNPJ presentes no cadastro de conjuntos de unidades consumidoras da base de continuidade. É a única chave confiável — o campo `NomAgenteFiscalizado` traz a mesma empresa sob grafias diferentes (`ELETROPAULO Metropolitana…` e `ELETROPAULO METROPOLITANA…` são registros distintos).
3. Ano = `DatLavraturaAutoInfracao`; multa = `VlrPenalidade` (valor originalmente lavrado, antes de recurso).
4. Denominador da taxa de autuação: distribuidora-ano com ao menos um conjunto em transgressão, de `qualidade_distribuidora_ano.csv`.
5. Recorte consumido: `data/processed/auto_infracao_limpo.csv` e `fiscalizacao_agente_ano.csv`.

> [!warning] `VlrPenalidade` é o valor lavrado, não o valor final
> A base traz também `VlrMultaAposJuizo` e `VlrMultaAposDiretoria`, preenchidos apenas quando houve decisão. Nesta nota, os R$ 2,13 bi são o valor **originalmente lavrado**; o valor efetivamente arrecadado é menor e não é apurável só com este conjunto — muitos autos aparecem com recurso acatado total ou parcialmente. Não citar como "multa paga".

> [!warning] A base é dominada por geração, não por distribuição
> Dos 1.580 autos, 673 são da natureza "Procedimento Desempenho Eólicas e Fotovoltaicas" e apenas 141 atingem distribuidoras na janela. O pico de 711 autos em 2024 é **integralmente** um fenômeno de geração — usá-lo como evidência sobre distribuição é erro de leitura.

> [!question]
> O enquadramento das penalidades (grupos I a IV, `DscEnquadramentoAI`) remete à REN 846/2019, que **não está em `docs/`**. Sem ela não é possível verificar se a natureza "Indicadores de Continuidade" corresponde ao mesmo dispositivo ao longo de toda a série, nem qual grupo de multa se aplica à transgressão de DEC/FEC.

## Leitura

A fiscalização punitiva sobre continuidade é **rara e concentrada**: 23 autos em seis anos, contra 274 combinações distribuidora-ano em que houve transgressão de limite — uma taxa de 8,4%. E o valor é pequeno diante do que as mesmas empresas devolveram ao consumidor por compensação automática: R$ 199 milhões de multa por continuidade contra R$ 5,33 bilhões de compensação ([[Compensação por Violação dos Limites Individuais de Continuidade]]).

O que o número **não** diz: se a baixa taxa reflete tolerância regulatória, priorização por materialidade, ou desenho deliberado — a ANEEL pode entender que a compensação automática já cumpre a função dissuasória. A distinção exige o texto da REN 846/2019 e os relatórios de fiscalização, ainda não coletados.

## Relação com a norma

Que regra este número mede: o poder sancionador da ANEEL sobre o descumprimento do [[Serviço Adequado (Distribuição)]] e dos limites do [[Indicadores Coletivos de Continuidade (DEC e FEC)]]; e, no limite, os gatilhos de [[Caducidade da Concessão de Distribuição]].

---

Fonte: [[Auto de Infração (ANEEL)]], [[Termo de Notificação (ANEEL)]] · Ref: [[Serviço Adequado (Distribuição)]]
