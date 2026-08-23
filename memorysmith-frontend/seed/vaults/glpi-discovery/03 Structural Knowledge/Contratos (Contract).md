---
title: Contratos (Contract)
aliases: [Contract, Contrato]
tags: [entity, contrato, dominio/gestao]
type: entity
status: confirmed
source: "[[EV-1-023 · Contract com renovação alerta custos e vínculo a itens|EV-1-023]]"
author: CAD Discovery
created: 2026-07-10
---

# Contratos (Contract)

O **Contract** representa acordos com fornecedores (suporte, manutenção, aluguel, garantia
estendida, licenciamento). Estende [[CommonDBTM (Active Record)]] com estado (State).

## Atributos-chave
- **Tipo** (`ContractType`), número, datas de início/duração.
- **Renovação**: nunca / **tácita** / **expressa** (`RENEWAL_*`).
- **Aviso prévio** (`notice`) e **alerta** de vencimento — cujo default é herdado da
  configuração da entidade (`use_contracts_alert`) via [[Herança de configuração por entidade]].
- **Custos** (`ContractCost`) recorrentes/pontuais.

## Relações
- **`Contract_Item`** — vincula o contrato a **qualquer item** (ativo, software, linha…).
- **`Contract_Supplier`** — fornecedores do contrato ([[Fornecedores e Contatos]]).
- Liga-se a documentos e à base de conhecimento.

Processo em [[Gestão de Contratos (processo)]]; papel financeiro em [[Gestão Financeira de TI]].
