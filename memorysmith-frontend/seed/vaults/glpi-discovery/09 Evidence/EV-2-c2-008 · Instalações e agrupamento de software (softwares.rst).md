---
title: EV-2-c2-008 · Instalações e agrupamento de software (softwares.rst)
aliases: [EV-2-c2-008]
tags: [evidence, software, installation, grouping, multi-entity, doc]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-002 · modules/assets/softwares.rst · Installations / Grouping"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-c2-008 · Instalações e agrupamento de software

> [!quote] Seção "Installations"
> "The installation of a software on a computer is visualized through a version and can be consulted on a software form (list of computers having at least one version installed), on a version form (computers having this version installed) and finally on a computer form (list of versions of installed software, sorted by category)."
> Notas: coluna `license` preenchida só quando a licença é afetada ao computador; exibição inicial de categorias depende das preferências do usuário.
> **Install**: instala manualmente uma versão de software no computador, selecionando software e versão; se houver licença associada, a use version da licença é selecionada automaticamente.
> **Uninstall**: via mass actions — selecionar versões e "Suppress definitively"; se houver licença afetada ao computador ela permanece afetada mas sua use version é apagada.
> Após a lista de versões instaladas, exibe-se a lista de licenças afetadas mas não instaladas; mass action **Install** instala uma use version das licenças selecionadas.

> [!quote] Seção "Grouping" (só multi-entidade)
> "This section describes how to group software having same names in sub-entities, allowing to group software of child entities into mother entity." Passos: criar na entidade-mãe software com nome estritamente idêntico; abrir o formulário; ativar recursividade (sub-entities = Yes) fazendo aparecer a aba `Grouping`; abrir a aba (lista software de mesmo nome nas filhas); selecionar linhas e validar. **Não pode ser desfeito.**
> Efeitos: licenças ficam anexadas ao software da entidade-mãe mas permanecem nas sub-entidades de origem; versões são mescladas (sem duplicatas na mãe); softwares antigos vão para a lixeira.
> Com inventário de terceiros: esvaziar a lixeira após o agrupamento (senão a sincronização restaura o software antigo em nova versão) e associar o mesmo fornecedor ao novo software (a sincronização verifica o nome do fornecedor).

## Sustenta
- [[Instalação e desinstalação de software (procedimento)]]
- [[Agrupamento de software em multi-entidade (procedimento)]]
