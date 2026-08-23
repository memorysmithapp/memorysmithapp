---
title: Modelagem de Custo AWS Serverless
aliases:
  - Cost Model Serverless
  - Estimativa de Custo AWS
tags:
  - finops
  - aws
  - cloud
  - governance
type: practice
status: evergreen
source: AWS Pricing (páginas públicas por serviço, maio de 2026); Integrated Architecture Guide (PWA + AWS Serverless)
author: Heitor Rapcinski; Amazon Web Services
created: 2026-07-25
---
Estimar, antes de construir, em que volume de uso cada serviço da arquitetura começa a gerar fatura — e desenhar o sistema sabendo quais componentes cobram desde o primeiro uso.

O resultado é uma arquitetura cujo custo é previsível por decisão, e não descoberto no fechamento do mês.

## Dinâmica / Passo a Passo

1. **Liste os serviços da arquitetura** e classifique cada um em três zonas: camada gratuita permanente, camada gratuita de 12 meses (só conta nova) e **sem camada gratuita**.
2. **Identifique a dimensão de cobrança** de cada serviço — não é a mesma coisa em nenhum deles:

   | Serviço | Dimensão que gera fatura |
   |---|---|
   | Computação (funções) | Invocações **e** GB-segundo |
   | Banco chave-valor | Unidades de leitura/escrita + armazenamento |
   | Gateway HTTP / WebSocket | Chamadas; mensagens e minutos de conexão |
   | Identidade | Usuários ativos no mês (MAU) |
   | Objetos | Armazenamento + requisições + saída para a internet |
   | CDN | Saída + requisições |
   | Fila | Requisições de API (send, receive, delete) |
   | Barramento de eventos | **Eventos publicados — sem camada gratuita** |
   | Observabilidade | GB de log + **métricas customizadas** + alarmes + dashboards |
   | Gerenciador de segredos | **Segredo por mês — sem camada gratuita** |
   | Consulta analítica | **Terabyte varrido — sem camada gratuita** |

3. **Calcule o teto gratuito** de cada serviço convertido para uma unidade de negócio: quantos usuários, requisições ou uploads por mês.
4. **Marque os três sem camada gratuita** como itens de decisão consciente no desenho, não como detalhe de implementação.
5. **Configure orçamento com alarme** por conta e ambiente antes do primeiro deploy em produção.
6. **Reveja a estimativa a cada mudança de arquitetura** que acrescente um serviço ou multiplique um evento.

## Regras

- **Cobrança por dimensão composta engana**: a computação cobra por invocação *e* por duração — o limite atingido primeiro é o que importa
- **Mais memória frequentemente custa menos.** A CPU é proporcional à memória; dobrar a memória e reduzir a duração à metade sai igual, e o ganho de latência é de graça
- **Métrica customizada é o item que mais surpreende** na observabilidade — planeje `4 × número de funções` só nos alarmes obrigatórios
- **Consulta analítica sem particionamento custa uma a duas ordens de grandeza a mais.** Particione antes de habilitar em produção
- **Saída para a internet é sempre cobrada; para a CDN, não.** Todo download de usuário passa pela CDN
- **Um bug em loop é um item de fatura.** Retry sem limite, laço de trigger e polling agressivo têm preço linear

## Exemplo

Projeto novo, sem usuários: a fatura é praticamente zero — computação, banco, identidade, CDN e fila cabem na camada gratuita. Os únicos lançamentos são os três serviços sem camada gratuita: alguns centavos de eventos publicados, o custo fixo por segredo armazenado e, se houver relatório, o terabyte varrido. Saber disso no desenho leva a decisões diferentes: consolidar segredos, manter o payload do evento enxuto e particionar a exportação analítica desde o primeiro dia.

---
Ref: [[FinOps]], [[Amazon CloudWatch]], [[Amazon Athena]], [[Amazon EventBridge]], [[Serverless]], [[Service Financial Management]]
