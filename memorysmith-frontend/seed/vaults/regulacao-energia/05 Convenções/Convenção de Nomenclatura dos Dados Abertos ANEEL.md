---
title: Convenção de Nomenclatura dos Dados Abertos ANEEL
aliases:
  - Prefixos de campo da ANEEL
  - Nomenclatura ANEEL
  - Padrão Dat Dsc Sig Num Vlr
tags:
  - aneel
  - dados-abertos
  - convencao
  - engenharia-de-dados
  - schema
type: convention
maturity: growing
reviewed: false
source: "[[Portal de Dados Abertos ANEEL (CKAN)]]"
author: Curadoria
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: ad-hoc
data_source: https://dadosabertos.aneel.gov.br/api/3/action/datastore_search
coverage: schemas de 26 conjuntos inspecionados em 2026-07-27
---

> [!abstract]
> Todo campo dos dados abertos da ANEEL começa por um prefixo de três letras que declara o **tipo semântico** do conteúdo. Conhecer os prefixos permite ler um schema desconhecido sem dicionário e escrever parsers genéricos que valem para dezenas de conjuntos.

## Conceito

A ANEEL adota notação húngara nos nomes de campo, herdada dos sistemas internos que geram as extrações. O prefixo não é decorativo: ele diz o que o campo é, e — importante — **não coincide com o tipo declarado no DataStore**, que é `text` na maioria dos casos.

Isso torna a convenção operacionalmente valiosa: é a partir do prefixo, não do tipo, que se decide o casting.

## Os prefixos

| Prefixo | Significa | Tipo real | Exemplo |
|---|---|---|---|
| `Dat` | Data | data | `DatInicioVigencia`, `DatCompetencia` |
| `Dth` | Data e hora | timestamp | `DthPublicacaoAto`, `DthCarga` |
| `Hor` | Hora | hora | `HorInicial`, `HorFinal` |
| `Anm` | Ano-mês concatenado | texto (`AAAAMM`) | `AnmPeriodoReferencia`, `AnmCompetenciaBalanco` |
| `Dsc` | Descrição textual | texto | `DscClasseConsumo`, `DscFluxoEnergia` |
| `Nom` | Nome próprio | texto | `NomMunicipio`, `NomAgente` |
| `Sig` | Sigla | texto curto | `SigAgente`, `SigUF`, `SigIndicador` |
| `Cod` | Código de domínio externo | texto | `CodMunicipioIbge`, `CodCEG` |
| `Ide` | Identificador interno da ANEEL | numérico | `IdeConjUndConsumidoras`, `IdeNucleoCEG` |
| `Num` | Número (documento, ordem, contagem) | numérico | `NumCNPJ`, `NumPeriodoIndice` |
| `Idc` | Indicador booleano | `S`/`N` ou `0`/`1` | `IdcAtivo`, `IdcGeracao` |
| `Qtd` | Quantidade contável | inteiro | `QtdUCAtiva`, `QtdChamadasAtendidas` |
| `Vlr` | Valor monetário ou de medida | decimal | `VlrTUSD`, `VlrIndiceEnviado` |
| `Mda` | Medida (grandeza física ou estatística) | decimal | `MdaPotenciaInstaladakW`, `MdaMediaSatisfacao` |
| `Pct` | Percentual | decimal | `PctINS`, `PctCarregamentoMax` |

> [!important] `Vlr` não é sempre dinheiro
> Em `VlrIndiceEnviado` o conteúdo é o valor apurado de um indicador — pode ser hora, minuto, percentual ou contagem, conforme o `SigIndicador` da mesma linha. A unidade **não está no nome do campo**; está no domínio do indicador. Ver [[Formato Longo dos Indicadores de Qualidade]].

## Armadilhas de engenharia

> [!warning] O DataStore devolve quase tudo como `text`
> Em 26 conjuntos inspecionados, a maioria absoluta dos campos aparece como `type: text`, inclusive `VlrTUSD`, `MdaPotenciaInstaladakW` e `DatInicioVigencia`. Poucos conjuntos (nível de tensão, DEC/FEC 2020–2029, SAMP recente) tipam `numeric` e `timestamp`. Um pipeline que confie no tipo declarado vai somar strings.

Consequências práticas:

1. **Casting explícito sempre**, guiado pelo prefixo, não pelo tipo.
2. **Separador decimal**: conferir arquivo a arquivo. CSV brasileiro costuma usar vírgula; o DataStore pode normalizar para ponto. Não presumir.
3. **Encoding varia por conjunto, não por portal** (verificado em 2026-07-27): `auto-infracao.csv` vem em **Latin-1**; `termo-notificacao.csv`, os indicadores de continuidade, o INDGER e o IndQual vêm em **UTF-8**. Presumir um só encoding para o portal quebra a ingestão de metade dos conjuntos — detectar por arquivo, com fallback.
4. **CNPJ como texto**: `NumCNPJ` aparece como `text` em uns conjuntos e `numeric` em outros. Como `numeric` ele **perde o zero à esquerda**. Padronizar para string de 14 posições com `zfill` antes de qualquer junção.
5. **Grafias erradas na origem**: `DscMuninicpios` e `DscPropriRegimePariticipacao` (SIGA), `IdeConjUnidConsumidoras` (IndQual Município) contra `IdeConjUndConsumidoras` (DEC/FEC). O mesmo conceito muda de nome entre conjuntos — **não normalizar cegamente por nome de campo**.
6. **`DatGeracaoConjuntoDados` está em toda tabela**: é a data da carga que gerou o arquivo, não a data do fato. Serve para versionar a extração, nunca como dimensão temporal do dado.

## Chaves de junção do ecossistema

| Chave | Liga | Conjunto de referência |
|---|---|---|
| `NumCNPJ` / `NumCPFCNPJ` | Praticamente todos os conjuntos, pelo agente | [[Cadastro de Agentes do Setor Elétrico (ANEEL)]] |
| `IdeConjUndConsumidoras` | Qualidade, emergenciais, nível de tensão, INDGER | [[IndQual - Município (ANEEL)]] |
| `CodMunicipioIbge` | Ouvidoria, reclamações, INDGER, MMGD | IBGE |
| `CodCEG` / `IdeNucleoCEG` | Geração, MMGD, SAMP | [[SIGA - Sistema de Informações de Geração (ANEEL)]] |
| `SigIndicador` | Todo o eixo de qualidade | `dominio-indicadores.csv` |

> [!tip] Comece pelo cadastro de agentes
> Com 9.927 linhas, o cadastro de agentes é pequeno, tem flags de segmento e o CNPJ canônico. É a dimensão natural para um modelo estrela do ecossistema ANEEL.

## Veja também

- [[Formato Longo dos Indicadores de Qualidade]]
- [[Portal de Dados Abertos ANEEL (CKAN)]]

## Armadilha verificada em 2026-07-27 — DataStore ≠ arquivo

O CKAN da ANEEL expõe dois caminhos para o mesmo recurso: o **DataStore** (consultável por `datastore_search` e SQL, e é dele que vêm as contagens de linha das fichas) e o **arquivo** servido pela URL de download. Os dois **não** têm necessariamente o mesmo conteúdo.

| Recurso | Linhas no arquivo | Linhas no DataStore | Falta |
|---|---:|---:|---:|
| `indicadores-continuidade-coletivos-2020-2029` | 4.984.416 | 2.757.500 | 45% |

A ausência é por conjunto e por ano, não por amostragem — há conjuntos com os doze meses de 2025 no arquivo e nenhum registro de 2025 no DataStore.

> [!warning] Sintoma concreto
> Agregações feitas por SQL no DataStore retornam totais plausíveis e **errados**, sem nenhum aviso. Como o número não é absurdo, o erro passa despercebido e vira citação.

**Regra prática:** a contagem de linhas do DataStore serve para dimensionar o esforço de coleta, nunca como universo de análise. Todo número publicado no `context-vault/` sai do arquivo baixado, com hash registrado no `_manifesto.json`.
