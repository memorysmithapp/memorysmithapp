---
title: Matriz de Compatibilidade de Dependências
aliases:
  - Compatibility Matrix
  - Baseline de Versões
tags:
  - software-engineering
  - devops
  - governance
  - frontend
type: practice
status: evergreen
source: Integrated Architecture Guide (PWA + AWS Serverless)
author: Heitor Rapcinski
created: 2026-07-25
---
Documentar, em uma tabela versionada junto ao código, quais versões das dependências principais foram validadas em conjunto, com a versão mínima exigida e a razão de cada restrição.

O resultado é que a decisão de atualizar deixa de ser tentativa e erro em ambiente local e passa a ser uma mudança rastreável com justificativa registrada.

## Dinâmica / Passo a Passo

1. **Liste os pares que realmente interagem** — não o `package.json` inteiro. O que importa são as combinações onde a incompatibilidade é conhecida: framework × bundler, framework × biblioteca de estado, bundler × plugin, runtime × SDK.
2. **Registre, por par**: status, versão mínima e a nota que explica *por que* aquela mínima.
3. **Fixe a data da validação.** Uma matriz sem data é uma afirmação sobre um passado indeterminado.
4. **Documente as exceções de instalação** (como flags de resolução de dependência de par) com o motivo e o link para a issue upstream que as tornará desnecessárias.
5. **Registre as mudanças incompatíveis relevantes** da versão principal adotada e a ação correspondente no código.
6. **Reveja no kickoff de cada projeto** e antes de cada atualização de versão principal.

| Par | Status | Versão mínima | Nota |
|---|---|---|---|
| Framework × bundler | ✅ | `x.0.0` | Suporte explícito, testado na CI do próprio bundler |
| Framework × store | ✅ | `5.0.13` | Patches anteriores tinham conflito de peer dependency |
| Bundler × plugin PWA | ✅ | `1.3.0` | Versão anterior limitava o peer à major antiga |
| Runtime × SDK | ✅ | — | Suporte oficial |

## Regras

- **Versão mínima com motivo, sempre.** "Use 5.0.13" sem explicação é regra que alguém vai quebrar na próxima atualização
- **Distinga atraso de declaração de incompatibilidade real.** Um peer dependency desatualizado que funciona em runtime resolve-se com flag e uma nota; incompatibilidade real bloqueia
- **Toda exceção tem link para a issue upstream** e é reavaliada quando ela fecha — senão a exceção vira permanente por inércia
- **Atualização de versão principal é um item de trabalho próprio**, com sua migração, nunca carona em outra entrega
- **A matriz vive no repositório**, versionada com o código que ela descreve

## Exemplo

Ao subir o bundler para a versão principal seguinte, o build quebra no plugin de PWA. A matriz já registra que o plugin só passou a declarar suporte a essa major a partir de `1.3.0`, com a data da validação. A correção é uma linha, e a próxima pessoa não repete a investigação.

---
Ref: [[Pipeline de CI-CD]], [[Versionamento Semântico (SemVer)]], [[Software Development and Management]], [[Arquitetura Evolutiva]]
