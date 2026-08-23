---
title: Agrupamento de software em multi-entidade (procedimento)
aliases: [Grouping, Agrupamento de software]
tags: [software, grouping, multi-entity, procedure, doc]
type: use-case
status: confirmed
source: "[[EV-2-c2-008 · Instalações e agrupamento de software (softwares.rst)|EV-2-c2-008]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Agrupamento de software em multi-entidade (procedimento)

Procedimento para agrupar softwares de mesmo nome em sub-entidades dentro da entidade-mãe. **Disponível apenas em plataformas multi-entidade** ([[Modelo de Entidades (multi-tenancy)]]), pois em multi-entidade a lista de software cresce rápido por entradas duplicadas (um software por entidade).

## Passos
1. Se o software não existe na entidade-mãe, criar nela um software com nome **estritamente idêntico** ao das entidades filhas.
2. Abrir o formulário do software da entidade-mãe.
3. Ativar a **recursividade** (sub-entities = Yes, canto superior direito) — faz surgir a aba `Grouping` após a aba `History` (ver [[Recursividade em entidades]]).
4. Abrir a aba `Grouping`: lista os softwares de mesmo nome nas filhas.
5. Selecionar as linhas apropriadas e validar o agrupamento.

> [!warning] Operação irreversível
> "This operation cannot be undone."

## Efeitos
- Licenças ficam anexadas ao software da entidade-mãe, mas **permanecem** nas sub-entidades de origem.
- Versões são mescladas (sem duplicatas na entidade-mãe).
- Os softwares antigos vão para a **lixeira** ([[Lixeira e purga (trash bin)]]).

## Com inventário de terceiros (passos extras obrigatórios)
- Esvaziar a lixeira após o agrupamento; caso contrário a sincronização restaura o software antigo ao chegar uma nova versão.
- Associar o **mesmo fornecedor** ao novo software, pois a sincronização verifica o nome do fornecedor (senão cria novo software).

Liga-se a [[Gestão de Software e Licenças (processo)]].
