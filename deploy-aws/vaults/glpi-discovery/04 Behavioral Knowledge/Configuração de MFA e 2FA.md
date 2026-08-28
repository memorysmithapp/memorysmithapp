---
title: Configuração de MFA e 2FA
aliases: [MFA, 2FA, Two-factor authentication, Autenticação de dois fatores, "Configuração de MFA/2FA"]
tags: [flow, mfa, 2fa, authentication, security, otp]
type: flow
maturity: evergreen
reviewed: false
source: "[[EV-2-a1-009 · Preferências do usuário (abas e campos)|EV-2-a1-009]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Configuração de MFA e 2FA

A **autenticação multifator (MFA)** é nativa do GLPI e reforça o acesso à conta com dupla autenticação: após a senha, o usuário insere um código de acesso fornecido por um app autenticador (Free OTP, Authy, Authenticator, etc.). Configura-se na aba *Two-factor authentication (2FA)* das [[Personalização da Experiência do Usuário (capacidade)|preferências]].

## Procedimento de ativação
1. Baixar um app autenticador (ex.: Authy).
2. Ir às preferências (canto superior direito) → *my settings > Two-factor authentication (2FA)*.
3. No app, tocar em "+"/novo e **escanear o QR code** (ou inserir o código diretamente, se não puder escanear).
4. Inserir no GLPI o código gerado pelo app e clicar em **verify**.
5. MFA ativado.

## Backup codes
Guardar os **backup codes**: se o app ficar inacessível, eles permitem acessar o GLPI. Pela aba é possível **desabilitar** o MFA (os códigos são perdidos; para reativar, repetir o procedimento) e **regenerar** os backup codes (os antigos são sobrescritos).

## Relações
- Parte de: [[Personalização da Experiência do Usuário (capacidade)]]; reforça [[Acesso e Login no GLPI (fluxo)]].
- Ponte de código: [[Autenticação (Auth)]], [[Autenticação e Single Sign-On (processo)]].
