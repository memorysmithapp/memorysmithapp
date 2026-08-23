# Regulação de Energia

> [!info]
> Base de conhecimento viva sobre a **regulação do setor elétrico brasileiro**: leis, decretos, resoluções normativas, procedimentos de rede, regras de comercialização e documentos de planejamento, decomposta em um grafo de conhecimento e evoluída continuamente.

Este vault não é um repositório de resumos de normas. Cada norma lida é **decomposta em conceitos atômicos permanentes** que se conectam entre si e à norma que os originou. O valor não está na norma isolada: está na rede que elas formam: qual resolução revoga qual, que conceito atravessa ANEEL e CCEE, que regra de comercialização depende de que procedimento de rede.

A essa rede de fatos soma-se uma segunda, o **grafo de contexto**, alimentado por dados abertos das mesmas instituições. A regra diz *como deveria ser*; o dado diz *como está sendo*. As duas redes se linkam.

> **Normas mudam. Conceitos permanecem. Dados atualizam. Conhecimento conectado e rastreável gera valor.**

## Os dois eixos

| | Fatos (pastas 01 a 07) | Medidas (pastas 08 a 10) |
|---|---|---|
| **O que contém** | O que a norma estabelece e o que a fonte de dados publica | O que os números mostram |
| **Pergunta que responde** | *Como deveria ser?* · *O que existe?* | *Como está sendo?* · *Quanto é?* |
| **Natureza temporal** | Estável: muda quando a norma ou o catálogo mudam | Volátil: muda a cada publicação da fonte |
| **Ciclo de vida** | Criada, enriquecida, raramente reescrita | Criada e **reatualizada por cadência** |
| **Datas no frontmatter** | `created` (fichas de dataset também trazem `updated`) | `created` **e** `updated` |

> [!important] A ficha do dataset é fato, não medida
> "O conjunto existe, é publicado pela ANEEL, tem 18 campos e cadência mensal" é um **fato**: muda quando a fonte muda o conjunto, não a cada publicação. O que é volátil não é a ficha: é o **número que sai dela**.

> [!warning] Dado sem `updated` é dado sem validade
> Um número de mercado sem data de atualização é indistinguível de um número errado. Nas pastas de medida, `updated` vencido em relação ao `refresh_frequency` marca a nota como vencida: ela continua no grafo, mas declarada como tal, e não sustenta conclusão.

## Rastreabilidade é requisito, não conveniência

Toda afirmação normativa em uma nota aponta para o dispositivo (artigo, anexo) da norma original, identificada por número e ano. Uma nota sem `source` verificável não entra no vault. Em matéria regulatória isso é inegociável: interpretação errada propaga silenciosamente pelo grafo.

## Onde cada nota entra

A árvore de pastas do vault, com a descrição de cada pasta, é a regra de entrada: antes de escrever, leia a descrição da pasta de destino. Ela diz o que se guarda ali e o que pertence a outra pasta.

> [!important] A separação Dataset × Indicador × Série × Insight
> A **ficha** descreve a fonte e seus campos. O **indicador** extrai um recorte com significado, na data da última atualização. A **série** lê a mesma medida como trajetória. O **insight** é a leitura que só existe ao confrontar série e norma. Os três últimos **vencem**; a ficha só muda se a estrutura do conjunto mudar.

## Frontmatter obrigatório

```yaml
---
title: Geração Distribuída (GD)
aliases: [GD, Micro e Minigeração Distribuída]
tags: [aneel, geracao-distribuida, marco-legal]
type: concept        # literature | concept | practice | moc | project | dataset | convention | indicator | series | insight
status: growing      # seed | growing | evergreen
source: Lei 14.300/2022; REN ANEEL 1.059/2023
author: ANEEL
created: 2026-07-26
---
```

Notas de medida (pastas 08 a 10) e fichas de dataset acrescentam: `updated`, `refresh_frequency`, `data_source` e `coverage`.

> [!warning] Vigência é parte do conteúdo
> Uma nota `evergreen` pode descrever regra revogada. Sempre que a vigência importar, ela é declarada no corpo com a norma que alterou ou revogou, e a nota linka para a sucessora.

## Fontes

ANEEL (REN, REH, PRODIST, PRORET), ONS (Procedimentos de Rede), CCEE (Regras e Procedimentos de Comercialização), MME (portarias e política), EPE (PDE, PNE, BEN) e a legislação de base (Planalto). Os documentos originais vivem fora deste vault; a nota cita a norma por identificação oficial (`REN 1.000/2021`, `Lei 14.300/2022`) e o dataset pela URL do portal de dados abertos.

## Regras de conexão

1. Todo conceito aponta sua **base normativa** com norma e dispositivo.
2. Toda nota de medida linka a ficha do dataset de onde saiu e o conceito que mede; todo conceito com dado disponível ganha uma seção `## Dados de contexto` apontando de volta.
3. Conceito novo entra no MOC do seu eixo no momento em que é criado.
4. Links para notas inexistentes são desejáveis dentro de um cluster em construção ativa.
