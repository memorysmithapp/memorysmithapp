---
title: Campos da aba Gestão (financeiro e administrativo)
aliases: [campos Management, campos financeiros, campos Infocom]
tags: [data, campos, management, financeiro, infocom, garantia]
type: data
status: confirmed
source: "[[EV-2-g2-010 · Aba Management (informações financeiras e administrativas)|EV-2-g2-010]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Campos da [[Aba Gestão (Management) financeira e administrativa]], agrupados em três blocos.

## Lifecycle (ciclo de vida)
| Campo | Semântica |
|---|---|
| Data do pedido | Data em que o material foi pedido |
| Data de compra | Data em que o equipamento foi comprado |
| Data de entrega | Data em que o equipamento foi entregue |
| Data de implementação / Startup date | Data em que foi posto em serviço |
| Data do último inventário físico | Último inventário físico do equipamento |
| Data de reforma | Data de baixa/reforma |

## Informações financeiras e administrativas
| Campo | Semântica |
|---|---|
| Fornecedor | Terceiro que vendeu o equipamento (menu Management > Suppliers) |
| Número do pedido | Número do pedido do equipamento |
| Número do ativo (Asset number) | Identificador patrimonial |
| Número da fatura | Número da fatura do equipamento |
| Nota de entrega (Delivery note) | Documento de entrega |
| Valor | Custo do equipamento |
| Valor de extensão de garantia | Custo da extensão (preferir contratos) |
| Valor contábil líquido | Cálculo automático: valor bruto menos depreciação |
| Tipo de depreciação | Linear ou saldo decrescente (declining balance) |
| Período de depreciação | Em anos |
| Coeficiente de depreciação | Aplicado à depreciação linear p/ obter saldo decrescente (só se decrescente) |
| TCO (valor + intervenções) | Custo total de propriedade |
| TCO mensal | TCO dividido pelos meses desde a compra |
| Orçamento | Orçamento sobre o qual o equipamento foi comprado |
| Comentários | Texto livre |

## Informações de garantia (Warranty)
| Campo | Semântica |
|---|---|
| Data de início da garantia | Início da garantia do equipamento |
| Informação da garantia | Texto qualificando a garantia |
| Período da garantia | Duração em meses; gera "Expires on" (vermelho se vencida) |

> [!note] O TCO agrega todos os elementos constituintes de um produto faturado, incluindo o custo das intervenções. Ver [[Infocom (dados financeiros do ativo)]] e [[Orçamentos e Custos]].
