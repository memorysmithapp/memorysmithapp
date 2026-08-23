---
title: Permissões padrão de objetos
aliases: [7 permissões padrão, Standard permissions, Read Update Create Delete Purge]
tags: [perfis, permissoes, rbac, lixeira, notas]
type: concept
status: confirmed
source: "[[EV-2-e1-004 · Perfis de usuário — conceito, 7 perfis pré-definidos e permissões padrão|EV-2-e1-004]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Permissões padrão de objetos

A maioria dos objetos do GLPI compartilha um conjunto de **7 permissões padrão** configuráveis por perfil ([[Perfil de Usuário (conceito e composição)]]).

| Permissão | Efeito |
|---|---|
| **Read** | Exibe o objeto; frequentemente controla a presença do objeto nos menus |
| **Update** | Modifica os dados do objeto |
| **Create** | Cria um novo elemento do tipo |
| **Delete** | Envia o objeto à lixeira (ausência = objeto sem lixeira) |
| **Purge** | Remove da lixeira, apagando permanentemente do banco |
| **Read notes** | Exibe a aba *Notes*, se o objeto tiver |
| **Update notes** | Modifica/exclui o conteúdo de uma nota |

## Regras
> [!warning] Não há dedução de permissão
> Ex.: para **modificar** um objeto é preciso conceder também **Read**. As permissões são independentes.

- **Migração**: o antigo direito *Write* é convertido em Read/Update/Create/Delete/Purge (e depois refinado). Para alguns objetos as permissões são agrupadas por objeto (ex.: FAQ = permissões do objeto Base de Conhecimento).
- A separação Delete/Purge permite distinguir **exclusão temporária** (lixeira) de **exclusão definitiva** (purga) — ver [[Lixeira e purga (trash bin)]].

## Aplicações específicas
- **Internet** (aba Assets): aplica-se ao campo IP de porta de rede, à (des)associação de nome de rede a porta e à parte Internet de dropdowns (redes IP, domínios internet, redes WiFi, nomes de rede).
- **Financial and administrative information** (aba Management): aplica-se também a objetos que contêm informação financeira — ex.: não se pode purgar um computador com info financeira sem o *Purge* sobre a info financeira.

## Relações
- Modelo de código: [[Perfis e Direitos (RBAC)]].
- Governança: [[Zonas de permissão (global vs local delegada)]].
