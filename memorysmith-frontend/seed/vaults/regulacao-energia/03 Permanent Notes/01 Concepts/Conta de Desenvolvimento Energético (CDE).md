---
title: Conta de Desenvolvimento Energético (CDE)
aliases:
  - CDE
tags:
  - encargos
  - tarifa
  - politica-publica
  - conceito
type: concept
maturity: seed
reviewed: false
source: Lei 14.300/2022, art. 1º, IV, arts. 22 e 25; Lei 10.438/2002
author: Presidência da República
created: 2026-07-26
---

> [!abstract]
> Encargo setorial estabelecido pela Lei nº 10.438, de 26 de abril de 2002, destinado a custear políticas públicas do setor elétrico embutidas na tarifa.

## Conceito

A CDE é o veículo pelo qual o setor elétrico financia decisões de política pública que não se sustentariam pela lógica tarifária pura — subsídios, universalização, sistemas isolados, tarifa social. A Lei 14.300 a usa como amortecedor da transição da GD: enquanto o consumidor-gerador não remunera integralmente as componentes de rede, é a CDE que cobre a diferença, evitando que o custo recaia de imediato sobre os demais consumidores da mesma distribuidora.

> [!warning] Nota de escopo
> Esta nota nasce das referências da Lei 14.300. A caracterização completa da CDE depende da leitura da **Lei 10.438/2002** e das regras de rateio, ainda **não coletadas** em `docs/`. Enquanto isso, permanece `seed`.

## Base normativa

| Norma | Dispositivo | O que estabelece |
|---|---|---|
| Lei 10.438/2002 | art. 13 | Institui a CDE e suas destinações (incisos VI e VII referidos pela Lei 14.300) |
| Lei 14.300/2022 | art. 1º, IV | Remete à definição da Lei 10.438/2002 |
| Lei 14.300/2022 | art. 22 | A partir de 12 meses da publicação, custeia as componentes não associadas ao custo da energia nas distribuidoras com mercado **< 700 GWh/ano** |
| Lei 14.300/2022 | art. 25 | Custeia **temporariamente** as componentes não remuneradas pelo consumidor-gerador, na forma do art. 27 |
| Lei 15.269/2025 | — | Dá nova redação ao art. 25 e revoga o parágrafo único do art. 22 |

> [!question]
> Qual a redação vigente em 2026 dos arts. 22 e 25 após a Lei 15.269/2025, e qual o efeito prático sobre o rateio do custeio entre ambiente regulado e livre?

## Dados de contexto

- [[Beneficiários da CDE (ANEEL)]] — quem recebe o desconto, por finalidade e por ano
- [[Custeio dos Benefícios Tarifários pela CDE (ANEEL)]] — de onde vem o recurso que paga o desconto
- [[Subsídios Tarifários (ANEEL)]] — valor por agente e por tipo, com o ato normativo de origem
- [[SCS - Sistema de Controle de Subvenções e Programas Sociais (ANEEL)]] — a Diferença Mensal de Receita da Tarifa Social, mês a mês

> [!warning] Fichado, não medido
> Os conjuntos acima estão **fichados** em `knowledge-vault/03 Datasets/`, com fonte e schema. Nenhum foi baixado e nenhum valor foi extraído — não há número aqui para citar. Quando houver, o indicador ou a série entram no `context-vault/` e são linkados daqui.

## Veja também

- [[Regra de Transição do Fio B]]
- [[Sistema de Compensação de Energia Elétrica (SCEE)]]
