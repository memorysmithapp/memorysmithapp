---
title: Aba Componentes de Hardware (ativos)
aliases: [Components tab, Aba Componentes]
tags: [assets, tab, components, hardware, computer]
type: component
status: confirmed
source: "[[EV-2-c3-002 · Aba Componentes de Hardware de um Computador|EV-2-c3-002]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Aba **Components** da ficha de um `Computer`, para gerenciar os componentes de hardware (processador, memória, interface de rede, etc.). É a visão de administrador da [[Composição de um Ativo (componentes)]] descrita no código.

> [!note] Adição por família
> Adiciona-se um componente escolhendo primeiro sua **família** na lista suspensa, depois o **nome** e a **quantidade**. O catálogo de componentes é mantido em **Setup > Components**. Componentes do mesmo tipo são **agrupados** na visão.

> [!note] Edição e ações em massa
> Um componente é modificado pelo link sob seu nome. Sobre vários componentes atua-se pelo botão `Actions` (ações em massa): modificar um elemento, ativar/alterar informações contábeis, excluir. Se tipos diferentes com características distintas são selecionados, o GLPI pergunta a qual componente aplicar a modificação. Ver [[Ações em massa (massive actions)]].

Ao editar um componente para um único computador (aba *Elements* > **Update**), abrem-se abas específicas: características (Element), [[Infocom (dados financeiros do ativo)|Management (administrativo/contábil)]], Documents ([[Documentos (Document)]]), History, Contract ([[Contratos (Contract)]]), Debug (só em modo Debug) e All.

Adições/remoções são registradas no histórico e podem vir do [[Inventário automático (processo)]].
