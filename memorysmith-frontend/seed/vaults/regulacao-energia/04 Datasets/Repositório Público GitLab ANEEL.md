---
title: Repositório Público GitLab ANEEL
aliases:
  - git.aneel.gov.br
  - GitLab ANEEL
  - centralconteudo
  - conteudos-externos
tags:
  - aneel
  - gitlab
  - documentos
  - normas
  - fonte
type: dataset
status: growing
source: https://git.aneel.gov.br/publico
author: ANEEL
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: weekly
data_source: https://git.aneel.gov.br/api/v4/groups/publico/projects
coverage: 3 projetos públicos; ~3.300 arquivos
---

> [!abstract]
> Instância GitLab da ANEEL cujo grupo `publico` hospeda o **lastro de arquivos do portal gov.br/aneel**: normas versionadas (PRODIST e PRORET completos, versão a versão), relatórios, planilhas de indicadores, manuais e formulários. Não é um repositório de código — é um repositório de documentos com histórico de versões.

> [!info] Catalogado em 2026-07-27 · Cobertura: 3 projetos, ~3.300 arquivos · Cadência: a cada publicação da ANEEL

## Identificação

| Item | Valor |
|---|---|
| Publicador | ANEEL |
| Endereço | https://git.aneel.gov.br/publico |
| Plataforma | GitLab (API v4) |
| Autenticação | Nenhuma — leitura anônima, sem token |
| Grupo | `publico` (id 3), sem subgrupos |
| Projetos | 3 |

### Os três projetos

| Projeto | Criado | Última atividade | Conteúdo |
|---|---|---|---|
| [`publico/centralconteudo`](https://git.aneel.gov.br/publico/centralconteudo) | 2022-02-04 | 2026-07-22 | Central de conteúdo do portal: normas, relatórios, indicadores, manuais, formulários, notícias |
| [`publico/acessoinfo`](https://git.aneel.gov.br/publico/acessoinfo) | 2022-05-02 | 2026-06-12 | Transparência ativa: licitações, convênios, auditoria, servidores, receitas e despesas, SIC |
| [`publico/conteudos-externos`](https://git.aneel.gov.br/publico/conteudos-externos) | 2022-03-15 | 2026-01-28 | Arquivos avulsos das superintendências (SRD, SFF, SMA, SCE) |

## Estrutura

### `centralconteudo/procreg` — as normas técnicas versionadas

> [!success] É aqui que estão as fontes ANEEL que faltavam ao `knowledge-vault/`
> O repositório publica **cada versão** de cada módulo do PRODIST e de cada submódulo do PRORET, com a REN que a aprovou codificada no nome do arquivo. É exatamente o histórico normativo que o vault precisa e que o portal web não entrega de forma navegável.

| Pasta | Arquivos | Conteúdo |
|---|---|---|
| `procreg/prodist` | 107 PDF | Módulos 1 a 11 do PRODIST, todas as revisões |
| `procreg/proret` | 486 PDF | Submódulos do PRORET, todas as revisões |
| `procreg/regtransm` | — | Regulação da transmissão |

Padrão de nome: `aren<ano><numero>_Prodist_modulo_<n>_v<versao>.pdf` e `Proret_Submod_<x.y>_V_<versao>_aren<ano><numero>.pdf`.
Exemplo: `aren20251137_Prodist_modulo_1_v12.pdf` = versão 12 do Módulo 1, aprovada pela REN 1.137/2025.

### `centralconteudo/relatorioseindicadores` — 2.054 arquivos

| Subpasta | Interesse analítico |
|---|---|
| `distribuicao` | 518 `.xlsm` de simulação do IASC por concessionária e ano, `PDD_base_PowerBI.xlsx`, Observatório de Reclamações |
| `tarifaeconomico` | 292 `.xlsm` de resultado das Contas Bandeiras mês a mês, `Balanco_Energetico_desde_2003.xlsx`, relatório de perdas |
| `infocontabilfinanc` | 125 `.xls` de arrecadação, demonstrações contábeis 2017–2025 |
| `mmgd` | Relatórios mensais de REIDI para MMGD (2024–2025) |
| `geracao`, `transmissao`, `leiloes`, `composicaosocietaria`, `estoquereg`, `instrumentosreg` | Séries e relatórios por eixo |

Formatos: 810 `.xlsm`, 547 `.pdf`, 350 `.zip`, 128 `.xls`, 79 `.xlsx`.

### `centralconteudo/manuaisminstrucoes` — 342 arquivos

Manuais de envio de dados por sistema, inclusive `cartografiageo` (BDGD), `envioarquivos`, `mmgd`, `infoecofinanc`. São os **documentos que definem o schema** dos dados que as distribuidoras enviam — leitura obrigatória antes de interpretar campo ambíguo.

### `conteudos-externos/SFF/BulldozeRR`

> [!success] Único código publicado no grupo
> `dados_bulldozer.py` (42 KB) e `BulldozeRR_20240423.zip` — ferramenta da Superintendência de Fiscalização Econômica e Financeira para processar a **Base de Remuneração Regulatória**. O arquivo define os dicionários de saída do Laudo e das tabelas SDI (AIS, CTB_FIS, ROS, ROD, ROA, LST_MAT, LST_SERV, PPBB, PCBB, BI_VREGUL…). É a especificação de fato do modelo de dados da BRR.

Outros: `conteudos-externos/SRD` traz `AreaatuadistbaseBI.xlsx` (área de atuação das distribuidoras) e o modelo de envio SIGFI/MIGDI.

## Como obter

Leitura anônima, sem token:

```bash
# projetos do grupo
curl -s "https://git.aneel.gov.br/api/v4/groups/publico/projects?per_page=100"

# árvore recursiva de uma pasta
curl -s "https://git.aneel.gov.br/api/v4/projects/publico%2Fcentralconteudo/repository/tree?recursive=true&per_page=100&path=procreg/prodist"

# download de um arquivo
curl -sO "https://git.aneel.gov.br/publico/centralconteudo/-/raw/main/procreg/prodist/modulo01/aren20251137_Prodist_modulo_1_v12.pdf"
```

Rotina reexecutável: `data/scripts/aneel_git.py`

## Ressalvas do dado

> [!important] Não é dado tabular, é acervo documental
> Só uma fração é consumível diretamente por script: os `.xlsx`/`.xlsm` têm layout de planilha de trabalho, com abas, cabeçalhos mesclados e macros. Extração exige tratamento arquivo a arquivo. O valor imediato está no acervo normativo (`procreg`) e nos manuais de envio.

> [!warning] Sem README, sem changelog
> Os três projetos têm README vazio ou de uma linha. Não há documentação da organização das pastas nem registro do que foi adicionado quando. A estrutura precisa ser inferida da árvore.

> [!important] Cadeia de certificados TLS
> `git.aneel.gov.br` apresenta cadeia que ambientes sem os certificados intermediários instalados não validam — o sintoma é `CERTIFICATE_VERIFY_FAILED`. Verificado em 2026-07-27. A correção é instalar as CAs (`apt install ca-certificates` ou `pip install certifi`); `data/scripts/aneel_git.py` traz a flag `--inseguro` como último recurso, com aviso explícito.

> [!question] O histórico de commits é confiável como histórico normativo?
> As versões antigas do PRODIST/PRORET foram todas commitadas de uma vez na criação do repositório (2022) ou têm datas de commit que acompanham a publicação real? Se acompanharem, o `git log` é uma linha do tempo normativa pronta. **Verificar antes de usar datas de commit como data de norma.**

## Derivados

_Nenhum ainda._ Uso prioritário sugerido: alimentar `docs/ANEEL/` com as versões do PRODIST e do PRORET, o que desbloqueia as notas de literatura pendentes registradas no plano de trabalho.

---

Fonte: ANEEL · MOC: [[Dados - Índice Geral]] · Ref: [[Portal de Dados Abertos ANEEL (CKAN)]]
