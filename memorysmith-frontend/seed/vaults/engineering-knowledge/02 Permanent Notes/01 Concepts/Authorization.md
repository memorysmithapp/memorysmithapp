---
title: Authorization
aliases:
  - Autorização
  - AuthZ
  - RBAC
  - ABAC
tags:
  - security
  - identity
  - system-design
type: concept
status: evergreen
source: OWASP Authorization Cheat Sheet; NIST SP 800-162 ABAC
author: OWASP · NIST
created: 2026-07-25
---
> [!abstract]
> Autorização é decidir **o que uma identidade já autenticada pode fazer** — e sobre quais objetos especificamente.

## Conceito

[[Authentication]] responde "quem é". Autorização responde "pode isto, sobre aquilo". São decisões separadas, tomadas em momentos diferentes, e tratá-las como uma só é a causa da falha mais frequente em APIs.

## Modelos

| Modelo | Como decide | Bom para |
|---|---|---|
| **ACL** | Lista por objeto de quem pode o quê | Poucos objetos, regras simples |
| **RBAC** | Permissões atreladas a papéis; usuários recebem papéis | Organizações com cargos estáveis |
| **ABAC** | Regras sobre atributos do usuário, do recurso e do contexto | Regras finas e dinâmicas |
| **ReBAC** | Decide pelo relacionamento entre sujeito e objeto | "Só o dono do documento e quem ele compartilhou" |

## A falha número um

> [!warning] Broken Object Level Authorization
> O endpoint `GET /pedidos/42` exige login e valida o token corretamente. Mas não verifica se **aquele usuário** pode ver **aquele pedido** — e trocar `42` por `43` devolve o pedido de outra pessoa.
>
> É a primeira posição do OWASP API Security Top 10 porque a verificação de autorização precisa acontecer **por objeto**, não por rota. Uma checagem no gateway ou num middleware de rota nunca alcança esse nível.

## Regras

- **Negar por padrão.** A ausência de regra explícita deve significar bloqueio, nunca liberação
- **Menor privilégio.** O mínimo necessário, pelo tempo mínimo — princípio central de [[Zero Trust]]
- **Decidir no servidor.** Ocultar o botão na interface é usabilidade; a verificação real é no backend
- **Separar a decisão da aplicação.** Um motor de política central mantém a regra auditável e consistente entre serviços

> [!important]
> Em [[Microservices]], a autorização se espalha: cada serviço precisa decidir sobre os próprios objetos. Centralizar tudo no [[API Gateway]] cobre a rota, não o objeto — e cria a ilusão perigosa de que o problema está resolvido.

## Fonte

- OWASP, [Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) e [API Security Top 10](https://owasp.org/API-Security/)
- NIST, [SP 800-162 — Attribute Based Access Control](https://csrc.nist.gov/pubs/sp/800/162/upd2/final)

## Veja também

- [[Authentication]]
- [[Identity and Access Management (IAM)]]
- [[OAuth 2.0]]
- [[Segurança de API]]
- [[Zero Trust]]
- [[Access to Resources]]
