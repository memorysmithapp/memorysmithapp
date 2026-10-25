---
name: Achado 001
severidade: alta
---

## Onde está

O Carteira Serpro grava o token do Gov.br em texto claro nas SharedPreferences, visto na [[Sessão 2026-09-14]].

## Como reproduzir

Instalar a versão 4.2 num aparelho com root e ler o arquivo de preferências do aplicativo.

## Recomendação

Guardar o token no Android Keystore, como a equipe do Ricardo Alves já faz no Serpro Assina.
