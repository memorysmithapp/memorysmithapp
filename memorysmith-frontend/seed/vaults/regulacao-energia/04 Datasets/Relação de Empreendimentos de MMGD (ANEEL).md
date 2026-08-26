---
title: Relação de Empreendimentos de MMGD (ANEEL)
aliases:
  - relacao-de-empreendimentos-de-geracao-distribuida
tags:
  - geracao-distribuida
  - mmgd
  - empreendimentos
  - dados-abertos
  - aneel
type: dataset
maturity: growing
reviewed: false
source: "[[Portal de Dados Abertos ANEEL (CKAN)]]"
author: ANEEL
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: daily
data_source: https://dadosabertos.aneel.gov.br/dataset/relacao-de-empreendimentos-de-geracao-distribuida
coverage: a partir de dez/2008
---

> [!abstract]
> Cadastro empreendimento a empreendimento de toda a micro e minigeração distribuída conectada no país, com titular, modalidade de habilitação, fonte, potência instalada, município e coordenadas. É o dataset central do eixo GD.

> [!info] Catalogado em 2026-07-27 · Cobertura declarada: a partir de dez/2008 · Cadência da fonte: diária

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL — Agência Nacional de Energia Elétrica |
| Portal | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br/dataset/relacao-de-empreendimentos-de-geracao-distribuida) |
| Licença | Open Data Commons ODbL |
| Formatos | ZIP, PARQUET, CSV |
| Recursos | 11 (3 no DataStore, consultáveis por API) |
| Granularidade | empreendimento / município / diária |
| Cadência declarada | diária |

## Como obter

```bash
# metadados e lista de recursos
curl -s "https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=relacao-de-empreendimentos-de-geracao-distribuida"
```

Rotina reexecutável: `data/scripts/aneel_ckan.py --dataset relacao-de-empreendimentos-de-geracao-distribuida`
Destino: `data/raw/aneel/relacao-de-empreendimentos-de-geracao-distribuida/<AAAA-MM-DD>/`

Convenção de campos: [[Convenção de Nomenclatura dos Dados Abertos ANEEL]]

## Estrutura

### `empreendimento-geracao-distribuida.zip / .parquet — dicionário oficial v2.3 (17-11-2025)`

| Campo | Tipo | Descrição |
|---|---|---|
| `DatGeracaoConjuntoDados` | data | Data/hora da carga de publicação |
| `AnmPeriodoReferencia` | texto(7) | Ano e mês de referência |
| `NumCNPJDistribuidora / SigAgente / NomAgente` | texto | Distribuidora conectada |
| `CodClasseConsumo / DscClasseConsumo` | texto | Classe de consumo da UC |
| `CodSubGrupoTarifario / DscSubGrupoTarifario` | texto | Subgrupo A1…A4, AS, B1…B4. **`CodSubGrupoTarifario` não existe mais na base do novo sistema** |
| `codUFibge / SigUF` | texto(2) | UF do IBGE |
| `codRegiao / NomRegiao` | texto | Mesorregião do IBGE |
| `CodMunicipioIbge / NomMunicipio / CodCep` | texto | Município e CEP |
| `SigTipoConsumidor` | texto(2) | PF ou PJ |
| `NumCpfCnpj / NomeTitularEmpreendimento` | texto | Titular — **tarjado** na publicação |
| `CodEmpreendimento` | texto(21) | Código do empreendimento de GD — chave da linha |
| `DthAtualizaCadastralEmpreend` | data/hora | Última atualização cadastral |
| `SigModalidadeEmpreendimento` | texto(1) | P/R/C/M. **Descontinuado no novo sistema** |
| `DscModalidadeHabilitado` | texto(50) | Modalidade: com micro/minigeração, autoconsumo remoto, geração compartilhada, múltiplas UC |
| `QtdUCRecebeCredito` | numérico(16,2) | Quantidade de UCs beneficiárias do excedente — mede o alcance do SCEE |
| `SigTipoGeracao` | texto(10) | UFV, EOL, CGH, PCH, UHE, UTE, UTN, CGU |
| `DscFonteGeracao` | texto(50) | Combustível, quando aplicável |
| `DscPorte` | texto(12) | Microgeração ou Minigeração |
| `NumCoordNEmpreendimento / NumCoordEEmpreendimento` | numérico(20,1) | Latitude e longitude aproximadas do centroide |
| `MdaPotenciaInstaladakW` | medida(6,2) | Potência instalada em kW — a métrica central do eixo |
| `NomSubEstacao / NumCoordESub / NumCoordNSub` | texto / numérico | Subestação vinculada e suas coordenadas |
## Ressalvas do dado

> [!warning] Schema conferido; conteúdo não
> Os campos e as contagens de linha acima vêm do **DataStore da ANEEL**, consultados em 2026-07-27 — são reais. O arquivo em si **não foi baixado** e nenhum valor foi extraído. Ao coletar, conferir encoding, separador decimal, valores sentinela e completude das séries antigas.

> [!important] Quase tudo vem como `text`
> A maioria dos campos numéricos e de data é publicada com tipo `text` no DataStore. Casting explícito é obrigatório antes de qualquer agregação — ver [[Convenção de Nomenclatura dos Dados Abertos ANEEL]].



## Derivados no `context-vault/`

_Nenhum indicador, série ou insight extraído até o momento._

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC: [[Dados - Geração Distribuída]] · Ref: [[Geração Distribuída (GD)]], [[Microgeração Distribuída]], [[Minigeração Distribuída]], [[Sistema de Compensação de Energia Elétrica (SCEE)]]
