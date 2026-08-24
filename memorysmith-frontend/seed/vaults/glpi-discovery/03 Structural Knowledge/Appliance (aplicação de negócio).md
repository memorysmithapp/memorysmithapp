---
title: Appliance (aplicação de negócio)
aliases: [Appliance, Appliances, Aplicação, Servidor lógico]
tags: [management, appliance, aplicacao, ativo-logico]
type: component
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-d2-001 · Appliances (appliance.rst)|EV-2-d2-001]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Appliance (aplicação de negócio)

Na visão do usuário, um **Appliance** representa **software e aplicações gerenciadas** dentro do GLPI: soluções instaladas em máquinas de usuários, servidores e outros dispositivos da organização (aplicações de escritório, software de negócio, sistemas operacionais, utilitários etc.). É um objeto lógico do módulo **Management**, distinto dos ativos físicos.

Segue o [[Modelo de Ativos (padrão comum)]]: possui os campos básicos comuns (nome, [[Campos comuns de um ativo (formulário)|status, localização, técnico/grupo responsável]] etc.) e campos específicos próprios (tipo e ambiente do appliance) — detalhados em [[Campos do formulário de Appliance]].

> [!note] Ligações
> Um appliance pode ser vinculado a outros itens GLPI pela aba **Items** e inclusive **a outro appliance**. Também se liga a [[Domínio (Internet domain)|domínios]], [[Contratos (Contract)|contratos]], documentos, certificados e à base de conhecimento. Participa da [[Aba Análise de Impacto (diagrama de dependências)|análise de impacto]] de infraestrutura.

Insere-se na [[Gestão de Ativos e Configuração (SACM)]] e é referenciado pela aba *Appliances* de outros objetos (ex.: [[Banco de dados (database)]], [[Instância de banco de dados (database instance)]]).
