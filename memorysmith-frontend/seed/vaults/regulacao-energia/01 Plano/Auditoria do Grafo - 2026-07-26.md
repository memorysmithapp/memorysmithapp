---
title: Auditoria do Grafo - 2026-07-26
aliases:
  - Auditoria do Grafo
  - Diagnóstico do Vault 2026-07
tags:
  - plano
  - governanca
  - qualidade
type: project
status: growing
source: Varredura programática de knowledge-vault/ e docs/ em 2026-07-26
author: Heitor Rapcinski + Claude
created: 2026-07-26
---

> [!abstract]
> Diagnóstico do grafo após a Fase 1 do [[Plano de Trabalho - Distribuição de Energia Elétrica|Plano de Trabalho]]: conectividade, rastreabilidade, integridade das fontes em `docs/` e prioridade das próximas coletas. Varredura de todas as 53 notas do vault.

## Veredito

O grafo está **saudável na topologia e frágil na rastreabilidade**. Não há uma única nota órfã — mas 21 das 33 notas permanentes não têm caminho de volta ao documento original, e a fonte de 20 delas está corrompida em `docs/`.

| Dimensão | Resultado |
|---|---|
| Notas totais | 53 (15 literature, 29 concept, 4 practice, 4 moc, 1 project) |
| Notas órfãs (sem link de entrada) | **0** ✅ |
| Notas sem link de saída | **0** ✅ |
| Notas isoladas | **0** ✅ |
| Links quebrados | **1** (`[[README]]`, em 2 notas) |
| Frontmatter incompleto | **0** ✅ |
| Permanentes fora de MOC | **0** ✅ |
| Permanentes sem link para literatura | **21 de 33** ⚠️ |
| Pontes entre eixos (conceito em >1 MOC) | **1** ⚠️ |
| Fontes em `docs/` legíveis | **2 de 3** ⚠️ |

Maturidade: 14 `evergreen`, 27 `growing`, 12 `seed`.

---

## 1. Links órfãos e quebrados

### 1.1 Órfãos — nenhum

Todas as 53 notas têm pelo menos um link de entrada e um de saída. A regra 1 de *Conexões e Navegação* está cumprida. O mérito é dos MOCs: `MOC - Geração Distribuída` (28 links) e `MOC - Concessões de Distribuição` (20 links) sustentam quase toda a conectividade de entrada.

### 1.2 Único link quebrado — `[[README]]`

```text
[[README]]  ←  Obrigações das Concessões e Acesso a Informações
            ←  Plano de Trabalho - Distribuição de Energia Elétrica
```

`README.md` está na **raiz do repositório**, fora de `knowledge-vault/`. Se o vault do Obsidian for `knowledge-vault/`, o link nunca resolve.

> [!important] Existem dois vaults do Obsidian configurados
> Há uma pasta `.obsidian/` na **raiz** do repositório **e** outra em `knowledge-vault/`. São dois vaults concorrentes, e a escolha muda o grafo:
>
> | Vault aberto | Efeito |
> |---|---|
> | `knowledge-vault/` | `[[README]]` quebra; `docs/` fica invisível ao grafo |
> | Raiz do repositório | `[[README]]` resolve; mas `docs/Legislacao/Decreto-12068-2024.md` vira nó do grafo — um arquivo sem frontmatter, que por convenção nunca deveria ser nota |
>
> **Recomendação:** manter o vault na **raiz**, adicionar `docs/` aos *Excluded files* das configurações do Obsidian, e apagar `knowledge-vault/.obsidian/`. Isso preserva `[[README]]` como âncora do grafo sem contaminá-lo com as fontes.

### 1.3 Nó fantasma do Plano de Trabalho — ✅ corrigido

O arquivo se chamava `Plano de Trabalho - Distribuicao de Energia Eletrica.md` (sem acentos), mas o `title` e 5 dos 8 links usavam a forma **acentuada** — que só resolvia por alias. Resultado no grafo do Obsidian: um **nó fantasma sem conteúdo** ao lado do nó real.

Era o único arquivo do vault com acentuação removida de propósito — `MOC - Geração Distribuída`, `Solicitação de Acesso para MMGD` e `Área de Elevada Complexidade` todos usam acentos no nome. E o único com `title` ≠ nome do arquivo, contrariando *"o nome do arquivo **é** o identificador da nota"*.

**Correção aplicada:** arquivo renomeado para `Plano de Trabalho - Distribuição de Energia Elétrica.md`. Os 5 links acentuados passam a apontar direto para o arquivo; os 3 sem acento e o caminho no `README.md` foram atualizados; a grafia antiga virou `alias`, para que nenhum link legado quebre.

> [!tip] Por que renomear em vez de padronizar os links
> Depender de alias para o link principal é frágil: editar o frontmatter quebraria 5 links de uma vez. Com o nome do arquivo casando com o `title`, o alias vira rede de segurança em vez de infraestrutura.

### 1.4 Falso positivo verificado

`[[Aporte de Capital na Concessão\|Aporte de capital]]` em `Decreto 12.068-2024 03` (linha 56) usa `\|` para escapar o pipe dentro de célula de tabela. É a sintaxe correta do Obsidian — **não é link quebrado**.

---

## 2. Rastreabilidade rompida — o achado principal

A regra 3 do README exige que *toda nota permanente linke para a nota de literatura da norma que a originou*. **21 de 33 não linkam.**

O padrão do erro é consistente: a norma aparece como **texto simples** na tabela *Base normativa*, não como wikilink.

```markdown
❌ | Lei 14.300/2022 | art. 1º, I | Define a modalidade |
✅ | [[Lei 14.300-2022 01|Lei 14.300/2022]] | art. 1º, I | Define a modalidade |
```

Consequência prática: a nota é alcançável **a partir** da literatura e dos MOCs, mas não leva **de volta** ao dispositivo. O caminho de auditoria — conceito → capítulo → arquivo em `docs/` — está cortado em dois terços do vault.

### Notas a corrigir

**Eixo Lei 14.300/2022** (alvo: `Lei 14.300-2022 NN`, o capítulo correspondente)

- [ ] Autoconsumo Local — cap. 01
- [ ] Autoconsumo Remoto — cap. 01
- [ ] Consumidor-Gerador — cap. 01
- [ ] Crédito de Energia Elétrica — cap. 01 e 04
- [ ] Empreendimento com Múltiplas Unidades Consumidoras — cap. 01
- [ ] Excedente de Energia Elétrica — cap. 01 e 04
- [ ] Fontes Despacháveis — cap. 01
- [ ] Geração Compartilhada — cap. 01
- [ ] Microrrede — cap. 01
- [ ] Minigeração Distribuída — cap. 01
- [ ] Sistema de Compensação de Energia Elétrica (SCEE) — cap. 01 e 04
- [ ] Garantia de Fiel Cumprimento — cap. 02
- [ ] Parecer de Acesso — cap. 02 e 06
- [ ] Conta de Desenvolvimento Energético (CDE) — cap. 01 e 05

**Eixo Decreto 12.068/2024** (alvo: `Decreto 12.068-2024 NN`)

- [ ] Serviço Adequado (Distribuição) — cap. 01
- [ ] Aporte de Capital na Concessão — cap. 01 e 03
- [ ] Caducidade da Concessão de Distribuição — cap. 01 e 02
- [ ] Área de Elevada Complexidade ao Combate às Perdas — cap. 02 e 05
- [ ] Plano de Resultados — cap. 03
- [ ] Prorrogação da Concessão de Distribuição — caps. 01 a 03
- [ ] Separação Tarifária e Contábil — cap. 05

As 12 que já fazem certo servem de modelo — `Microgeração Distribuída`, `Regra de Transição do Fio B` e as 4 Practices.

---

## 3. Ilhas sem ponte

O grafo tem **dois clusters que praticamente não se tocam**: Geração Distribuída (Lei 14.300) e Concessões de Distribuição (Decreto 12.068). Apenas **um** conceito — `Termo Aditivo ao Contrato de Concessão` — aparece em mais de um MOC.

Pela regra 5 do README, isso é sintoma, não resultado. As travessias que a leitura já sugere e que ninguém escreveu:

| Ponte | Liga | Bloqueio |
|---|---|---|
| Continuidade do fornecimento (DEC/FEC) | `Serviço Adequado (Distribuição)` ↔ condição de prorrogação do Decreto 12.068, art. 2º, § 2º | PRODIST Módulo 8 |
| Rito de acesso à rede | `Parecer de Acesso` / `Solicitação de Acesso para MMGD` ↔ conexão ao sistema de distribuição | PRODIST Módulo 3 |
| Componentes tarifárias | `Regra de Transição do Fio B` ↔ Parcela A/B e revisão tarifária | PRORET |
| Custeio setorial | `Conta de Desenvolvimento Energético (CDE)` ↔ encargo na tarifa da distribuidora | PRORET / Lei 10.438/2002 |
| Perdas | `Área de Elevada Complexidade ao Combate às Perdas` ↔ perdas regulatórias | PRODIST Módulo 7 + PRORET |

Note que **todas as pontes dependem de fontes não coletadas**. Não é falha de curadoria — é consequência direta do bloqueio da Camada 2.

### MOCs desbalanceados

| MOC | Links | Situação |
|---|---|---|
| MOC - Geração Distribuída | 28 | Maduro |
| MOC - Concessões de Distribuição | 20 | Maduro |
| MOC - Marco Legal do Setor Elétrico | 5 | Esqueleto (`seed`) |
| MOC - Acesso a Dados e Transparência | 4 | Esqueleto (`seed`) |

---

## 4. Integridade das fontes em `docs/`

> [!warning] `Lei-14300-2022.txt` está corrompida e é irrecuperável no estado atual
> A captura contém **1.911 caracteres de substituição** (`U+FFFD`) — perda de bytes irreversível na conversão latin-1 → UTF-8. `Presid�ncia`, `microgera�o`, `n� 14.300`.
>
> Essa é a fonte de **20 notas de conceito**. A regra 1 de *Trabalhando com Agentes de IA* — "todo artigo citado é verificado contra o arquivo em `docs/`" — não é executável contra um arquivo ilegível.
>
> Testado em 2026-07-26: refazer o download por `web_fetch` **reproduz exatamente a mesma corrupção** (o Planalto serve latin-1 sem declarar charset). Precisa de rota alternativa — navegador, ou fonte que sirva UTF-8.

`Decreto-12068-2024.md` está íntegro, com acentuação correta e URL de origem no cabeçalho. É o padrão a replicar.

### Vigência desatualizada

O texto capturado da Lei 14.300 é a **redação original de 2022**. Já foi alterada por:

- Lei 14.620/2023
- MP 1.300/2025 (referenciada no próprio cabeçalho do Planalto)
- Lei 15.269/2025 (arts. 22 e 25 — custeio pela CDE)

Nenhuma dessas está em `docs/`. As notas de CDE, Fio B e SCEE descrevem regra possivelmente superada.

### Normas citadas em `source:` mas ausentes de `docs/`

`Lei 9.074/1995` (art. 4º — base da prorrogação), `Lei 10.438/2002` (institui a CDE), `Lei 10.848/2004` (art. 2º-D). Aparecem como fundamento em notas permanentes sem documento correspondente.

---

## 5. Coleta desbloqueada

> [!success] `git.aneel.gov.br` está acessível pelo navegador
> O bloqueio registrado no plano era da extensão de download, não do host. Em 2026-07-26 naveguei ao repositório GitLab público da ANEEL e listei os arquivos. **PRODIST (11 módulos), PRORET e Procedimentos de Rede de transmissão estão todos lá**, versionados por resolução.
>
> A rota `www2.aneel.gov.br/cedoc/*.pdf` continua retornando vazio pelo fetch direto. O caminho é o GitLab, pelo navegador.

Dois achados na listagem:

1. **PRODIST Módulo 3 tem uma v9** (`aren2021956_Prodist_modulo_3_v9.pdf`, subida há 2 meses) mais recente que a **v8** linkada na página `gov.br`. Coletar a v9 — e conferir módulo a módulo, o mesmo pode valer para outros.
2. Os módulos **1, 4, 6 e 8** têm prefixo `aren20251137` — foram alterados pela **REN 1.137/2025**. Isso responde parcialmente a pergunta de pesquisa do plano sobre o alcance da REN 1.137.

### URLs diretas (branch `main`)

```text
.../procreg/prodist/modulo01/aren20251137_Prodist_modulo_1_v12.pdf
.../procreg/prodist/modulo02/aren2021956_Prodist_modulo_2_v8.pdf
.../procreg/prodist/modulo03/aren2021956_Prodist_modulo_3_v9.pdf   ← v9, não v8
.../procreg/prodist/modulo04/aren20251137_Prodist_modulo_4_v3.pdf
.../procreg/prodist/modulo05/aren2021956_Prodist_modulo_5_v7.pdf
.../procreg/prodist/modulo06/aren20251137_Prodist_modulo_6_v17.pdf
.../procreg/prodist/modulo07/aren2021956_Prodist_modulo_7_v6.pdf
.../procreg/prodist/modulo08/aren20251137_Prodist_modulo_8_v14.pdf
.../procreg/prodist/modulo09/aren2021956_Prodist_modulo_9_v2.pdf
.../procreg/prodist/modulo10/aren2021956_Prodist_modulo_10_v4.pdf
.../procreg/prodist/modulo11/aren2021956_Prodist_modulo_11_v2.pdf

base: https://git.aneel.gov.br/publico/centralconteudo/-/raw/main/
proret:    .../procreg/proret/
transmissão: .../procreg/regtransm/
```

---

## 6. Prioridade das próximas fontes

Ordenada por **quantas lacunas abertas do vault cada fonte fecha**, não pela sequência do roadmap.

| # | Fonte | O que desbloqueia | Notas que hoje dependem dela |
|---|---|---|---|
| 1 | **PRODIST Módulo 8** (v14) | DEC, FEC, DIC, FIC, DMIC, DICRI e limites anuais globais | `Serviço Adequado (Distribuição)`, `MOC - Concessões`, e **a ponte** com o art. 2º, § 2º do Decreto 12.068 |
| 2 | **PRODIST Módulo 3** (v9) | Rito de conexão que a Lei 14.300 pressupõe | `Parecer de Acesso`, `Solicitação de Acesso para MMGD`, `Microrrede` |
| 3 | **REN 1.059/2023** | Todo o operacional da MMGD | Enriquece as 14 notas do eixo GD — hoje só com a camada legal |
| 4 | **PRODIST Módulo 1** (v12) | Glossário oficial | Alimenta `aliases` do vault inteiro; reduz risco de conceito duplicado |
| 5 | **PRODIST Módulo 6** (v17) | Obrigações de envio de dados à ANEEL | `MOC - Acesso a Dados` — hoje com 4 links |
| 6 | **Lei 14.300 recoletada** + Lei 15.269/2025 | Texto legível e vigência 2026 | Fonte de 20 conceitos; resolve a corrupção e a desatualização |
| 7 | **REN 1.000/2021** | Relacionamento comercial | Fase 2 inteira do plano — nenhuma nota existe ainda |
| 8 | **PRORET** (submódulos de Parcela A/B e revisão) | Formação tarifária | Pontes 3, 4 e 5 da seção 3 |
| 9 | Leis 9.074/1995, 10.438/2002, 10.848/2004 | Fundamento citado sem documento | `Prorrogação da Concessão`, `CDE`, `Exposição Contratual Involuntária` |
| 10 | Contratos de concessão + termo aditivo | Lista oficial das 16 distribuidoras e os R$ 130 bi | `Termo Aditivo`, `Plano de Resultados`, 3 perguntas de pesquisa do plano |

---

## 7. Ações recomendadas, em ordem

1. **Resolver os dois vaults do Obsidian** — decidir a raiz, excluir `docs/` do índice, apagar o `.obsidian/` redundante. Corrige `[[README]]` sem editar nota nenhuma.
2. **Recoletar a Lei 14.300 pelo navegador**, com acentuação e redação vigente. Nada de novo deve ser escrito sobre GD antes disso.
3. **Costurar os 21 wikilinks de literatura faltantes.** É refatoração pura, sem leitura nova — commit próprio, `vault: costura rastreabilidade conceito → literatura`.
4. **Coletar PRODIST 8 e 3 pelo GitLab da ANEEL**, nessa ordem, e escrever as duas pontes que eles desbloqueiam. É o que faz os dois clusters virarem um grafo só.
5. Seguir a tabela da seção 6 a partir do item 3.

---

Ref: [[Plano de Trabalho - Distribuição de Energia Elétrica]], [[README]], [[MOC - Geração Distribuída]], [[MOC - Concessões de Distribuição]], [[MOC - Acesso a Dados e Transparência]], [[MOC - Marco Legal do Setor Elétrico]]
