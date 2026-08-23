---
title: PRODIST Modulo 10
aliases:
  - PRODIST Módulo 10
  - BDGD
  - SIG-R
tags:
  - aneel
  - prodist
  - distribuicao
  - dados-abertos
  - geoprocessamento
type: literature
status: growing
source: REN ANEEL 956/2021, Anexo X — PRODIST Módulo 10, v4
author: ANEEL
created: 2026-07-26
---

## Identificação

| Campo | Conteúdo |
|---|---|
| Norma | Anexo X da REN ANEEL nº 956, de 7.12.2021 |
| Título | Módulo 10 — Sistema de Informação Geográfica Regulatório |
| Versão | v4 |
| Extensão | 13 páginas |
| Situação | Vigente |
| Arquivo original | `docs/ANEEL/PRODIST/PRODIST-Modulo-10.pdf` |

## Resumo executivo

Institui a **Base de Dados Geográfica da Distribuidora (BDGD)** — o modelo de dados que representa o sistema elétrico real de cada distribuidora e alimenta o **Sistema de Informação Geográfica Regulatório (SIG-R)** da ANEEL. Define a estrutura da base, o dicionário de dados e as obrigações de envio, validação e publicação.

Para o `context-vault/` este é o módulo fundacional: a BDGD é a fonte de onde derivam quase todos os dados geoespaciais abertos sobre a rede de distribuição brasileira.

## Estrutura

| Seção | Objeto |
|---|---|
| 10.0 | Introdução |
| 10.1 | **BDGD** — estrutura e conjunto de informações |
| 10.2 | Disposições operacionais e de uso — obrigações, prazos, envio, publicação e uso |

## Principais dispositivos

| Item | Regra |
|---|---|
| 10 | O modelo geográfico da BDGD é uma **simplificação** do sistema elétrico real, para um período estabelecido |
| 11 | A BDGD descreve informações relacionadas à rede, às estruturas, aos equipamentos e aos usuários |
| 12 | A identificação individual de cada elemento deve ser **mantida ao longo do tempo**, para permitir avaliação da evolução |
| 13 | A BDGD **não exige** alteração dos modelos de dados dos sistemas GIS próprios da distribuidora |
| 15 | Modelagem, validação e envio são detalhados no **Manual de Instruções da BDGD** |
| 17 | O **Dicionário de Dados ANEEL do SIG-R (DDA)** estabelece a codificação das informações |
| 18 | A estrutura organiza-se em **Entidades Geográficas** e **Entidades Não Geográficas** |
| 20 | Entidades compõem-se de campos **abertos** (livres ou com regra de formação) e **fechados** (codificados) |
| 20.1 | A lista exaustiva de entidades está no Manual, não na norma |
| 21 | Campos codificados seguem o DDA; campos vinculados observam a codificação da entidade referenciada |
| 22–23 | Entidades geográficas representam feições necessariamente georreferenciadas, detalhadas em tabelas por tipo (Usuário e outros) |

> [!important] A norma delega a especificação ao Manual
> Os itens 15, 20.1 e 21 remetem a estrutura concreta ao **Manual de Instruções da BDGD** e ao **DDA**, documentos fora da REN 956/2021. Consequência prática para o vault: sem o Manual não é possível descrever a BDGD campo a campo. É documento a coletar antes de qualquer nota de dataset.

> [!important] Identificador persistente é requisito regulatório
> O item 12 exige que o identificador de cada elemento sobreviva às atualizações da base. É isso que torna a BDGD uma série temporal da rede, e não uma sucessão de fotografias independentes — o que habilita análise de evolução de ativos entre ciclos.

## Conceitos apresentados

Candidatos a nota permanente: Base de Dados Geográfica da Distribuidora (BDGD) · Sistema de Informação Geográfica Regulatório (SIG-R) · Dicionário de Dados ANEEL (DDA) · Entidade Geográfica · Entidade Não Geográfica · Manual de Instruções da BDGD.

Candidato a **nota de dataset** no `context-vault/`: *Base de Dados Geográfica da Distribuidora (ANEEL)*.

## Alterações e revogações

Versão 4 do anexo, vinculada à REN 956/2021 original.

> [!question] Manual e prazos
> O Manual de Instruções da BDGD e o DDA não foram coletados. A Seção 10.2 fixa prazos de envio que ainda não foram extraídos desta leitura — item para a próxima passada.

---
Ref: [[REN 956-2021]], [[PRODIST Modulo 02]], [[PRODIST Modulo 07]], [[PRODIST Modulo 06]], [[MOC - Acesso a Dados e Transparência]]
