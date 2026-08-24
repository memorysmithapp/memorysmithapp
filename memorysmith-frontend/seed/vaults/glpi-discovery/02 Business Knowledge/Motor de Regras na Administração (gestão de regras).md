---
title: Motor de Regras na Administração (gestão de regras)
aliases: [Rules engine (administração), Gestão de regras]
tags: [regras, motor, automacao, doc]
type: capability
maturity: evergreen
reviewed: false
source:
  - "[[EV-2-e2-007 · Motor de regras - usos e comportamentos|EV-2-e2-007]]"
  - "[[EV-2-e2-008 · Tipos de regra na administração e mecanismos auxiliares|EV-2-e2-008]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

O GLPI possui um **motor de regras** que executa automaticamente ações e associações. Na perspectiva de administração, é acessado em **Administration > Rules** e cobre dois grandes usos: **regras de gestão** e **dicionários de dados**.

## Comportamentos do motor
Conforme o tipo de regra, o motor:
- **para após a primeira regra correspondente**; ou
- **aplica todas as regras**; ou
- **aplica as regras passando o resultado à regra seguinte**.

Regras podem ser **desabilitadas** (para escrita/teste). Um botão **Test** no formulário da regra mostra critérios e resultados. Recomenda-se testar e fazer backup antes de cada nova regra.

## Tipos de regra (administração)
- [[Regras de atribuição de autorizações ao usuário]] (entidade + perfil);
- [[Regras de negócio de tickets (administração)]];
- [[Regras de categorização de software]];
- [[Regras de atribuição de item a entidade (inventário)]] e [[Regras de importação e vínculo de computadores]];
- Regras de atribuição de ticket aberto via coletor de e-mail (ver [[Collectors de e-mail no Assistance]] / código [[Coletor de E-mail (MailCollector)]]);
- Regras de localização (Location Rules), como no passo a passo de [[Criação de uma regra (passo a passo)]].
- **Dicionários** de dados: ver [[Dicionários de dados (administração)]].

## Mecanismos auxiliares
- [[Blacklists do motor de regras]] (excluem valores como IP/MAC/serial/UUID/email);
- [[Perfis de transferência inter-entidades]];
- [[Import e Export de regras, dicionários e formulários (XML)]].

> [!note] Ponte doc×código
> Corresponde às notas de código [[Motor de Regras (engine)]], [[Tipos de Regra]] e [[Execução de uma regra (criteria → action)]].
