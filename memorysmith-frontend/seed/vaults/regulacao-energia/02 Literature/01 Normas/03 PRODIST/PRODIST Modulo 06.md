---
title: PRODIST Modulo 06
aliases:
  - PRODIST Módulo 6
  - PRODIST Modulo 6
  - Informações Requeridas e Obrigações
tags:
  - aneel
  - prodist
  - distribuicao
  - dados-abertos
  - obrigacoes
type: literature
maturity: growing
reviewed: false
source: REN ANEEL 956/2021, Anexo VI — PRODIST Módulo 6, v17
author: ANEEL
created: 2026-07-26
---

## Identificação

| Campo | Conteúdo |
|---|---|
| Norma | Anexo VI da REN ANEEL nº 956, de 7.12.2021 |
| Título | Módulo 6 — Informações Requeridas e Obrigações |
| Versão | v17, consolidada com a REN 1.137/2025 |
| Extensão | 1,7 MB — o mais extenso do PRODIST em conteúdo tabular |
| Situação | Vigente |
| Arquivo original | `docs/ANEEL/PRODIST/PRODIST-Modulo-06.pdf` |

## Resumo executivo

É o módulo terminal do PRODIST: recolhe, em tabelas, **toda** obrigação de envio de informação da distribuidora à ANEEL gerada pelos demais módulos. Para cada informação define fluxo, conteúdo, caráter, periodicidade e prazo. Onze seções, das quais nove espelham um a um os outros módulos.

Para o objetivo declarado do repositório — *acesso às informações e dados* — este é o módulo mais importante dos onze. É aqui que se lê o que a distribuidora **é obrigada** a produzir e entregar, o que por sua vez determina o que existe nos portais de dados abertos da Agência.

## Estrutura

| Seção | Espelha | Objeto |
|---|---|---|
| 6.1 | — | Obrigações gerais, cronograma, protocolo e meios; acesso da ANEEL às informações de distribuidoras, transmissoras e CCEE |
| 6.2 | Mód. 2 | Planejamento da expansão |
| 6.3 | Mód. 3 | Acesso ao sistema de distribuição |
| 6.4 | Mód. 4 | Procedimentos operativos |
| 6.5 | Mód. 5 | Sistema de medição |
| 6.6 | Mód. 7 | Cálculo de perdas |
| 6.7 | Mód. 8 | Qualidade da energia elétrica |
| 6.8 | Mód. 9 | Ressarcimento de danos elétricos |
| 6.9 | Mód. 10 | SIG-R |
| 6.10 | Mód. 11 | Fatura de energia |
| 6.11 | — | Atendimento, serviços e demais dados da prestação do serviço |

## Principais dispositivos

| Item | Obrigação |
|---|---|
| 76 | Dever geral de cumprir **prazos e periodicidades** estabelecidos na legislação |
| 89 | Para cada informação requerida ficam estabelecidos fluxo, conteúdo, caráter e periodicidade |
| 23-A | Envio às áreas de fiscalização de relatório com discriminação de despesas ou custos incorridos |
| 23-M | Envio regular dos **alertas meteorológicos** que justifiquem acionamento de plano de contingência |
| — | **DEC e FEC anuais** — envio até o último dia útil do mês subsequente ao período de apuração |
| — | **TMP, TMD, TME** (tempos médios de preparação, deslocamento e execução) — apuração mensal, envio até o último dia útil do mês subsequente |
| — | **Plano de manejo vegetal** — atualização anual |
| — | Por interrupção de longa duração em cada conjunto de unidades consumidoras, conjunto de dados específico à ANEEL |
| — | Indicadores de transgressão de conformidade de tensão das medições amostrais |

> [!important] O módulo que produz os dados abertos
> Praticamente toda série publicada nos portais da ANEEL sobre distribuição nasce de uma linha de tabela deste módulo. Ao construir o `context-vault/`, o caminho correto é partir da obrigação aqui declarada e só então procurar o dataset que a materializa — não o inverso. Assim se sabe o que **deveria** existir, e não apenas o que está publicado.

> [!warning] Densidade tabular
> As obrigações estão em tabelas com colunas de definição, unidade, periodicidade e prazo, muitas vezes quebradas na extração de texto. Citação de dispositivo deste módulo exige conferência na página do PDF, não no texto extraído.

## Conceitos apresentados

Candidatos a nota permanente: Fluxo de Informação Regulatória · Periodicidade de Envio · Conjunto de Unidades Consumidoras · Interrupção de Longa Duração · TMP/TMD/TME · Alerta Meteorológico Regulatório.

## Alterações e revogações

| Norma | Efeito |
|---|---|
| REN 1.137/2025 | Acrescenta obrigações de resiliência — alertas meteorológicos (23-M), plano de manejo vegetal, dados de interrupção de longa duração. Versão 17 do anexo |

---
Ref: [[REN 956-2021]], [[PRODIST Modulo 04]], [[PRODIST Modulo 08]], [[PRODIST Modulo 10]], [[MOC - Acesso a Dados e Transparência]]
