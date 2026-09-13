---
title: Alocação e Uso de Créditos de Energia no SCEE
aliases:
  - Alocação de créditos
  - Uso de créditos do SCEE
tags:
  - geracao-distribuida
  - scee
  - faturamento
  - pratica
type: practice
maturity: growing
reviewed: false
source: Lei 14.300/2022, arts. 12 a 16
author: Presidência da República
created: 2026-07-26
---

Rito de apuração, alocação e consumo do [[Excedente de Energia Elétrica|excedente]] e do [[Crédito de Energia Elétrica|crédito]] no [[Sistema de Compensação de Energia Elétrica (SCEE)|SCEE]], a cada ciclo de faturamento.

## Dinâmica / Passo a Passo

1. **Apurar**, a cada ciclo e **para cada posto tarifário**, o montante de energia ativa consumido e o injetado pela UC com GD *(art. 12, caput)*.
2. **Alocar o excedente na ordem obrigatória** do art. 12, § 1º:
   - primeiro, no **mesmo posto tarifário**;
   - em seguida, **sequencialmente nos demais postos da mesma UC**;
   - só então, para uma ou mais das opções: **(I)** mesma UC, virando crédito para ciclos seguintes; **(II)** outras UCs do mesmo consumidor-gerador, inclusive matriz e filiais, na mesma distribuidora; **(III)** outras UCs do empreendimento com múltiplas unidades consumidoras; **(IV)** UCs de titular integrante de geração compartilhada, mesma distribuidora.
3. **Faturar a UC remota**, quando o consumo ocorre em local diferente da geração, deduzindo o percentual de excedente alocado e o crédito acumulado, **por posto tarifário** *(art. 12, § 2º)*.
4. **Aplicar a relação entre componentes tarifárias** sempre que excedente ou crédito de UC do **Grupo A** for usado em posto tarifário distinto do gerado *(art. 12, § 3º)*.
5. **Consumir créditos em ordem FIFO** — sempre os mais antigos primeiro *(art. 13, § 2º)*.
6. **Respeitar o valor mínimo faturável**: a compensação só é aplicada até o ponto em que o valor faturado permaneça maior ou igual ao mínimo da regulamentação vigente *(art. 16)*.

## Regras e prazos

| Regra | Conteúdo | Dispositivo |
|---|---|---|
| Validade do crédito | **60 meses** do faturamento em que foi gerado; expirado, reverte à modicidade tarifária | art. 13, caput |
| Natureza | Energia ativa; quantidade **não varia** com a tarifa | art. 13, § 1º |
| Ordem de uso | FIFO — créditos mais antigos primeiro | art. 13, § 2º |
| Alteração de percentuais ou ordem | Solicitação do titular; distribuidora tem **30 dias** para operacionalizar | art. 12, § 4º |
| Definição de beneficiárias | Cabe ao titular fixar percentuais **ou** ordem de prioridade | art. 14 |
| Restrição de alocação | Em múltiplas UCs e geração compartilhada, só para UCs do próprio empreendimento | art. 14, p.ú. |
| Permissionárias | Excedentes gerados em permissionária podem ser alocados na concessionária onde ela se localiza | art. 15 |
| Bandeiras tarifárias | Incidem **só** sobre o consumo faturado, não sobre a energia compensada | art. 19 |

## Encerramento da relação contratual (art. 13, §§ 3º a 5º)

| Situação | Tratamento |
|---|---|
| Titular tem outra UC na mesma distribuidora | Créditos **realocáveis** para a UC remanescente |
| Titular não solicita alocação em **30 dias** | Realocação **automática** para a UC de maior consumo, e assim sucessivamente |
| Múltiplas UCs ou geração compartilhada, com saldo na UC geradora | Titular pode solicitar distribuição do saldo às demais UCs do empreendimento, com **30 dias** de antecedência do fim da relação |
| Nenhuma das anteriores | Créditos mantidos em nome do titular pelo prazo de 60 meses |

## Exemplo

UC com minigeração em tarifa horária gera excedente de 400 kWh no posto fora ponta e 0 kWh na ponta. Pelo art. 12, § 1º, os 400 kWh são alocados primeiro no **próprio posto fora ponta**; o que sobrar vai sequencialmente ao posto ponta da mesma UC; só o remanescente pode ir a outras UCs do titular. Se a UC beneficiária for do Grupo A e o crédito for usado na ponta, aplica-se a relação entre as componentes de compra de energia dos dois postos *(§ 3º)*.

## Dados de contexto

- [[Relação de Empreendimentos de MMGD (ANEEL)]] — `QtdUCRecebeCredito` — quantas unidades consumidoras recebem o excedente de cada empreendimento

> [!warning] Fichado, não medido
> Os conjuntos acima estão **fichados** em `knowledge-vault/03 Datasets/`, com fonte e schema. Nenhum foi baixado e nenhum valor foi extraído — não há número aqui para citar. Quando houver, o indicador ou a série entram no `context-vault/` e são linkados daqui.

---
Ref: [[Crédito de Energia Elétrica]], [[Excedente de Energia Elétrica]], [[Sistema de Compensação de Energia Elétrica (SCEE)]], [[Lei 14.300-2022 04]]
