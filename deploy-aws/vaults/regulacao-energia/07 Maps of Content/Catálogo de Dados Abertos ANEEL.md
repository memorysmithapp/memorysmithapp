---
title: Catálogo de Dados Abertos ANEEL
aliases:
  - Catálogo ANEEL
  - Inventário de datasets ANEEL
tags:
  - moc
  - catalogo
  - dados-abertos
  - aneel
  - inventario
type: moc
maturity: growing
reviewed: false
source: "[[Portal de Dados Abertos ANEEL (CKAN)]]"
author: Curadoria
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: weekly
data_source: https://dadosabertos.aneel.gov.br/api/3/action/package_search
coverage: 71 conjuntos publicados em 2026-07-27
---

> [!abstract]
> Inventário completo dos **71 conjuntos** do Portal de Dados Abertos da ANEEL, catalogados em 2026-07-27. Uma linha por conjunto, com cobertura, cadência, volume e se o schema já foi conferido campo a campo.

> [!info] Catalogado em 2026-07-27 · 71 conjuntos · 26 com schema conferido no DataStore

# Como ler esta tabela

| Coluna | Significado |
|---|---|
| **Cobertura** | Janela temporal **declarada** pela ANEEL no catálogo — não verificada contra o arquivo |
| **Cadência** | Frequência de atualização declarada |
| **Rec.** | Quantidade de recursos (arquivos) no conjunto |
| **DS** | Quantos desses estão no DataStore e respondem a `datastore_search` |
| **Volume** | Linhas da maior tabela, quando conferido |
| **Schema** | ✅ campos conferidos no DataStore · — apenas metadados do catálogo |

## Geração Distribuída _(2)_

| Conjunto | Cobertura | Cadência | Rec. | DS | Volume | Schema |
|---|---|---|---|---|---|---|
| [[Atendimento a Pedidos de Conexão MMGD pós-Lei 14.300 (ANEEL)]] | 07/01/2022 a 07/01/2023, com atualizações posteriores | mensal | 11 | 0 | — | — |
| [[Relação de Empreendimentos de MMGD (ANEEL)]] | a partir de dez/2008 | diária | 11 | 3 | — | ✅ |

## Tarifas e Encargos _(8)_

| Conjunto | Cobertura | Cadência | Rec. | DS | Volume | Schema |
|---|---|---|---|---|---|---|
| [[Bandeiras Tarifárias (ANEEL)]] | a partir de jan/2015 | mensal | 6 | 3 | 14 k | ✅ |
| [[Beneficiários da CDE (ANEEL)]] | a partir de 2017 | anual | 110 | 8 | — | — |
| [[CTR - Curvas de Carga de Consumidores e Redes Tipo (ANEEL)]] | a partir de 2012 | ad hoc / conforme evento | 6 | 2 | 2,8 M | ✅ |
| [[Componentes Tarifárias (ANEEL)]] | 2010 em diante | semanal | 31 | 15 | 621 k / ano | ✅ |
| [[Custeio dos Benefícios Tarifários pela CDE (ANEEL)]] | por ano de referência | anual | 2 | 1 | 373 | ✅ |
| [[SCS - Sistema de Controle de Subvenções e Programas Sociais (ANEEL)]] | a partir de 2011 | mensal | 2 | 1 | 75 k | ✅ |
| [[Subsídios Tarifários (ANEEL)]] | a partir de fev/2013 | mensal | 2 | 1 | 227 k | ✅ |
| [[Tarifas de Aplicação das Distribuidoras (ANEEL)]] | 2010 em diante | semanal | 3 | 1 | 322 k | ✅ |

## Qualidade do Serviço _(13)_

| Conjunto | Cobertura | Cadência | Rec. | DS | Volume | Schema |
|---|---|---|---|---|---|---|
| [[IndQual - Inadimplência (ANEEL)]] | a partir de 2012 | mensal | 3 | 1 | 1,1 M | ✅ |
| [[IndQual - Município (ANEEL)]] | a partir de 2001 | mensal | 2 | 1 | 43 k | ✅ |
| [[Indicadores Coletivos de Continuidade DEC e FEC (ANEEL)]] | a partir de 2000 | mensal | 17 | 4 | 2,8 M | ✅ |
| [[Indicadores de Atendimento a Ocorrências Emergenciais (ANEEL)]] | a partir de 2000 | mensal | 3 | 1 | 1,2 M | ✅ |
| [[Indicadores de Conformidade do Nível de Tensão - DRP e DRC (ANEEL)]] | a partir de 2012 | mensal | 5 | 2 | 1,8 M | ✅ |
| [[Indicadores de Qualidade do Atendimento Telefônico (ANEEL)]] | a partir de jan/2014 | mensal | 2 | 1 | 5,9 k | ✅ |
| [[Interrupções de Energia Elétrica nas Redes de Distribuição (ANEEL)]] | a partir de 2017 | mensal | 16 | 0 | — | — |
| [[Ocorrências Emergenciais nas Redes de Distribuição (ANEEL)]] | a partir de 2017 | mensal | 20 | 0 | — | — |
| [[Ouvidoria Setorial ANEEL]] | a partir de 2014 | diária | 19 | 13 | 231 k / ano | ✅ |
| [[Qualidade do Atendimento Comercial (ANEEL)]] | a partir de 2011 | mensal | 3 | 2 | 1,5 M | ✅ |
| [[Reclamações no 1º e 2º Nível da Distribuidora (ANEEL)]] | a partir de jan/2010 | mensal | 10 | 2 | 6,0 M | ✅ |
| [[Segurança do Trabalho e das Instalações (ANEEL)]] | conforme envio das distribuidoras | mensal | 3 | 1 | 428 k | ✅ |
| [[Índice ANEEL de Satisfação do Consumidor - IASC (ANEEL)]] | a partir de 2006 | anual | 2 | 1 | 1,5 k | ✅ |

## Distribuição e Rede _(4)_

| Conjunto | Cobertura | Cadência | Rec. | DS | Volume | Schema |
|---|---|---|---|---|---|---|
| [[Base de Dados Geográfica da Distribuidora - BDGD (ANEEL)]] | envio anual das distribuidoras | anual | 6 | 0 | — | ✅ |
| [[GCEM - Campos Elétricos e Magnéticos (ANEEL)]] | a partir de 2010 | ad hoc / conforme evento | 4 | 2 | — | — |
| [[INDGER - Indicadores Gerenciais da Distribuição (ANEEL)]] | a partir de 2023 | mensal | 13 | 4 | 1,4 M | ✅ |
| [[PDD - Plano de Desenvolvimento da Distribuição (ANEEL)]] | por ano de referência | anual | 2 | 1 | 5,5 k | ✅ |

## Mercado e Consumo _(3)_

| Conjunto | Cobertura | Cadência | Rec. | DS | Volume | Schema |
|---|---|---|---|---|---|---|
| [[Composição Societária - Polímero (ANEEL)]] | a partir de dez/2020 | trimestral | 3 | 1 | — | — |
| [[SAMP - Balanço Energético (ANEEL)]] | a partir de 2003 | mensal | 3 | 1 | 545 k | ✅ |
| [[SAMP - Sistema de Acompanhamento de Informações de Mercado (ANEEL)]] | 2003 em diante | mensal | 49 | 24 | 644 k / ano | ✅ |

## Geração _(12)_

| Conjunto | Cobertura | Cadência | Rec. | DS | Volume | Schema |
|---|---|---|---|---|---|---|
| [[Acréscimo Anual da Potência Instalada (ANEEL)]] | a partir de 1999 | anual | 2 | 1 | — | — |
| [[Agentes de Geração de Energia Elétrica (ANEEL)]] | cadastro corrente | mensal | 2 | 1 | — | — |
| [[Atos de Outorgas de Geração (ANEEL)]] | a partir de 2015 | mensal | 2 | 1 | — | — |
| [[CFURH - Compensação Financeira pela Utilização de Recursos Hídricos (ANEEL)]] | a partir de 1993 | mensal | 18 | 7 | — | — |
| [[Capacidade Instalada por Unidade da Federação (ANEEL)]] | a partir de 2006 | trimestral | 2 | 1 | — | — |
| [[Empreendimento Hidrelétrico em Estudo (ANEEL)]] | fases de pré-outorga | mensal | 3 | 1 | — | — |
| [[FSB - Fiscalização de Segurança de Barragens (ANEEL)]] | a partir de 2016 | mensal | 2 | 1 | — | — |
| [[Liberação para Operação Comercial de Empreendimentos de Geração (ANEEL)]] | 1997 em diante | ad hoc / conforme evento | 6 | 2 | — | — |
| [[Quantidade de Empreendimentos de Geração em Operação (ANEEL)]] | a partir de 2001 | trimestral | 2 | 1 | — | — |
| [[Quantidade de Usinas Termelétricas por Tipo (ANEEL)]] | desde 2012 | trimestral | 2 | 1 | — | — |
| [[RALIE - Acompanhamento da Expansão da Oferta de Geração (ANEEL)]] | a partir de 2021 | ad hoc / conforme evento | 12 | 3 | — | — |
| [[SIGA - Sistema de Informações de Geração (ANEEL)]] | cadastro corrente | diária | 5 | 2 | 25 k | ✅ |

## Transmissão _(4)_

| Conjunto | Cobertura | Cadência | Rec. | DS | Volume | Schema |
|---|---|---|---|---|---|---|
| [[BPR - Banco de Preços de Referência: Linha de Transmissão (ANEEL)]] | versões sucessivas do banco | mensal | 50 | 25 | — | — |
| [[BPR - Banco de Preços de Referência: Subestação (ANEEL)]] | versões sucessivas do banco | mensal | 8 | 4 | — | — |
| [[Desempenho das Concessionárias de Transmissão (ANEEL)]] | série histórica | ad hoc / conforme evento | 4 | 0 | — | — |
| [[SIGET - Sistema de Gestão da Transmissão (ANEEL)]] | a partir de 2005 | diária | 34 | 17 | — | — |

## Leilões _(1)_

| Conjunto | Cobertura | Cadência | Rec. | DS | Volume | Schema |
|---|---|---|---|---|---|---|
| [[Resultado de Leilões de Geração e Transmissão (ANEEL)]] | série histórica | mensal | 4 | 2 | — | — |

## Fiscalização _(4)_

| Conjunto | Cobertura | Cadência | Rec. | DS | Volume | Schema |
|---|---|---|---|---|---|---|
| [[Auto de Infração (ANEEL)]] | a partir de mai/2018 | mensal | 3 | 1 | — | — |
| [[TIPE - Termos de Intimação das Penas dos Editais (ANEEL)]] | série corrente | mensal | 10 | 5 | — | — |
| [[Termo de Intimação - TI (ANEEL)]] | a partir de mai/2018 | mensal | 2 | 1 | — | — |
| [[Termo de Notificação (ANEEL)]] | a partir de mai/2018 | mensal | 3 | 1 | — | — |

## Institucional _(7)_

| Conjunto | Cobertura | Cadência | Rec. | DS | Volume | Schema |
|---|---|---|---|---|---|---|
| [[Audiências e Consultas Públicas (ANEEL)]] | a partir de 2013 | trimestral | 2 | 1 | — | — |
| [[Cadastro de Agentes do Setor Elétrico (ANEEL)]] | cadastro corrente | mensal | 2 | 1 | 9,9 k | ✅ |
| [[Pautas e Atas das Reuniões Públicas da Diretoria (ANEEL)]] | a partir de set/2017 | semanal | 2 | 1 | — | — |
| [[Reuniões Públicas da Diretoria (ANEEL)]] | set/2017 em diante | mensal | 4 | 1 | — | — |
| [[SIGEC - Sistema de Gestão de Créditos (ANEEL)]] | a partir de 1998 | diária | 5 | 2 | — | — |
| [[SLC - Sistema de Licitações e Contratos da ANEEL]] | até 2020 | ad hoc / conforme evento | 2 | 1 | — | — |
| [[TFSEE - Taxa de Fiscalização de Serviços de Energia Elétrica (ANEEL)]] | série corrente | diária | 2 | 1 | — | — |

## P&D e Eficiência Energética _(2)_

| Conjunto | Cobertura | Cadência | Rec. | DS | Volume | Schema |
|---|---|---|---|---|---|---|
| [[Projetos de Eficiência Energética (ANEEL)]] | a partir de 1999 | mensal | 6 | 2 | — | — |
| [[Projetos de P&D em Energia Elétrica (ANEEL)]] | 2008 em diante | mensal | 2 | 1 | — | — |

## Descontinuados _(11)_

| Conjunto | Cobertura | Cadência | Rec. | DS | Volume | Schema |
|---|---|---|---|---|---|---|
| [[Autos de Infração por Área de Fiscalização (descontinuado)]] | 1998 a 2017 | ad hoc / conforme evento | 3 | 0 | — | — |
| [[Compensação Financeira e Royalties (histórico)]] | histórico | ad hoc / conforme evento | 4 | 0 | — | — |
| [[Fiscalização Econômica e Financeira (descontinuado)]] | 2012 a 2018 | ad hoc / conforme evento | 4 | 0 | — | — |
| [[Fiscalização da Geração (descontinuado)]] | 2012 a 2018 | ad hoc / conforme evento | 4 | 0 | — | — |
| [[Fiscalização da Transmissão e Distribuição (descontinuado)]] | 2012 a 2018 | ad hoc / conforme evento | 4 | 0 | — | — |
| [[Indicadores Quantitativos da Fiscalização (descontinuado)]] | 1998 a 2016 | ad hoc / conforme evento | 3 | 0 | — | — |
| [[Projetos P&D - Res. 316-2008, 219-2006 e anteriores (descontinuado)]] | 1999 a 2007 | ad hoc / conforme evento | 4 | 0 | — | — |
| [[Projetos de Eficiência Energética por Tipologia (descontinuado)]] | histórico | ad hoc / conforme evento | 4 | 0 | — | — |
| [[Projetos de P&D - Temas Estratégicos (descontinuado)]] | a partir da REN 316/2008 | ad hoc / conforme evento | 4 | 0 | — | — |
| [[Projetos, Retornos e Investimentos (descontinuado)]] | histórico | ad hoc / conforme evento | 4 | 0 | — | — |
| [[Tarifa Social de Energia Elétrica - Beneficiários (descontinuado)]] | histórico | ad hoc / conforme evento | 4 | 0 | — | — |

# Fontes irmãs

| Repositório | O que traz |
|---|---|
| [[Portal de Dados Abertos ANEEL (CKAN)]] | Os 71 conjuntos acima |
| [[Repositório Público GitLab ANEEL]] | PRODIST e PRORET versionados, relatórios, planilhas, manuais de envio |
| [[Portal Geoespacial ANEEL (ArcGIS Open Data)]] | BDGD e camadas georreferenciadas |

# Convenções de leitura

- [[Convenção de Nomenclatura dos Dados Abertos ANEEL]] — prefixos de campo, tipagem e chaves de junção
- [[Formato Longo dos Indicadores de Qualidade]] — o schema de seis colunas comum a oito conjuntos

# Perguntas de Pesquisa

> [!question]
> - Dos 45 conjuntos ainda sem schema conferido, quais valem a inspeção antes da primeira coleta?
> - Quantos conjuntos declaram cadência que a data de modificação não confirma?
> - Há conjunto do CKAN cujo conteúdo já esteja, mais completo, no GitLab ou no portal geoespacial?

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC pai: [[Dados - Índice Geral]]
