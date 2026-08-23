---
title: Pets vs Cattle
aliases:
  - Pets e Cattle
  - Bichos de Estimação e Gado
tags:
  - infrastructure
  - devops
  - cloud-native
  - operations
type: concept
status: growing
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Analogia que contrapõe servidores tratados como indivíduos insubstituíveis (pets) a servidores tratados como unidades intercambiáveis e descartáveis (cattle).

## Conceito

O **pet** tem nome próprio, configuração única, histórico de ajustes manuais. Quando adoece, você cuida dele — investiga, corrige, restaura. Sua morte é um incidente.

O **cattle** tem número, não nome. Nasce de um template, é idêntico aos irmãos e, quando falha, é abatido e substituído. Sua morte é um evento rotineiro que não interrompe o negócio.

## Características

A analogia não é sobre estética operacional — ela é o **pré-requisito de três práticas**:

| Prática | Por que depende de cattle |
|---|---|
| [[Infrastructure as Code]] | Só faz sentido reprovisionar se o resultado for idêntico |
| [[Immutable Infrastructure]] | Servidor imutável é, por definição, descartável |
| [[DevSecOps]] | Fonte única da verdade é o que torna a varredura de segurança automatizável |

> [!important] O caminho da segurança passa pela imutabilidade
> Com um único código como fonte da verdade e um pipeline compartilhado, mover a segurança "para a esquerda" deixa de ser aspiração. Sem isso, cada servidor exige inspeção individual.

## Comparação

| | Pet | Cattle |
|---|---|---|
| Identidade | Nome | Número |
| Configuração | Manual, acumulada | Declarada em código |
| Na falha | Restaura | Substitui |
| Escala | Vertical | Horizontal |
| Recuperação | Minutos a horas | Segundos |

## Veja também

- [[Immutable Infrastructure]]
- [[Infrastructure as Code]]
- [[Cloud Native]]
- [[DevSecOps]]
