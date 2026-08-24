---
title: EV-2-e2-007 · Motor de regras - usos e comportamentos
aliases: [EV-2-e2-007]
tags: [evidence, regras, motor, doc]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-002 · modules/administration/rules/rulesmanagement.rst · Rules engine"
author: CAD Discovery (doc)
created: 2026-07-12
---

> [!quote] Documentação (rulesmanagement.rst, Rules engine)
> "GLPI contains a rules engine which enables a certain number of actions and associations to be carried out automatically."

O motor de regras é usado para dois grandes grupos:
- **Regras de gestão (management rules)**: atribuir um ativo a uma entidade; conceder permissões a um usuário; atribuir categoria a um software; rotear tickets para entidades; ações automáticas na abertura de ticket.
- **Dicionários de dados**: fabricantes, software, impressoras, tipos e modelos de ativos, campos relacionados a sistema operacional.

O motor **se comporta de forma diferente conforme o tipo de regra**:
- **parar após a primeira regra correspondente** (stop after first matching rule);
- **aplicar todas as regras** (apply all rules);
- **aplicar regras e passar o resultado à regra seguinte** (pass rule result to next rule).

Regras podem ser **desabilitadas** (ex.: durante escrita/teste). `.. hint::` recomenda-se testar bem antes de usar e fazer backup antes de cada nova regra; no formulário da regra, um botão **Test** abre uma janela mostrando critérios e resultados.

Exportação/importação/duplicação é possível para todas as regras — global (página principal) ou em lote via ações massivas nos resultados de busca (útil para migrar regras de pré-produção para produção). `.. note::` export/import usam formato **XML**.

## Sustenta
- [[Motor de Regras na Administração (gestão de regras)]]
- [[Import e Export de regras, dicionários e formulários (XML)]]
