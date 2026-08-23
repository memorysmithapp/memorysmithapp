---
title: Internacionalização de Aplicação Frontend
aliases:
  - Implementação de i18n
  - Setup i18n
tags:
  - frontend
  - i18n
  - ux
  - architecture
type: practice
status: evergreen
source: i18next documentation; Integrated Architecture Guide (PWA + AWS Serverless)
author: Heitor Rapcinski
created: 2026-07-25
---
Implementar suporte a múltiplos idiomas em uma aplicação de página única, com detecção previsível do locale e uma única fonte de verdade para a preferência do usuário.

O resultado é uma interface que nunca exibe um idioma que o usuário não escolheu nem o navegador sinalizou, e que não perde a preferência ao trocar de dispositivo.

## Dinâmica / Passo a Passo

1. **Declare os locales suportados** com um formato único e explícito (`en_US`, `pt_BR`) e um deles como canônico.
2. **Estruture os arquivos de tradução** espelhados, com o canônico definindo todas as chaves:

   ```
   src/i18n/
   ├── index.ts               # init + detector customizado
   └── locales/
       ├── en_US.json         # canônico — toda chave nasce aqui
       └── pt_BR.json         # espelha exatamente; nem falta nem sobra
   ```

3. **Implemente o detector na ordem correta**: preferência explícita do usuário → idioma do navegador normalizado → fallback. Rode a detecção uma vez, na inicialização.
4. **Defina uma única fonte de verdade para a preferência** — o atributo de perfil no provedor de identidade, que segue o usuário entre dispositivos. O store local é cópia sincronizada no login, usada offline; o armazenamento interno da biblioteca é cache de partida a quente e nunca é lido pelo código da aplicação.
5. **Inicialize antes de renderizar**, no ponto de entrada da aplicação.
6. **Adicione verificação no pipeline**: falha o build se houver chave presente no canônico e ausente em qualquer outro locale, ou vice-versa.
7. **Traduza também o erro da API** a partir do `code` do envelope — nunca exiba a mensagem crua do backend.

## Regras

- **Nenhuma literal visível ao usuário no código.** A revisão de código veta string em JSX
- **A preferência explícita vence o navegador, sempre**
- **Nunca chame a API de idioma do navegador diretamente** fora do detector centralizado
- **Um só formato de tag** em todo o código. `pt`, `pt-br`, `ptBR` e `pt_BR` convivendo produzem falhas de correspondência intermitentes
- **Interpolação, nunca concatenação** — a ordem das palavras muda entre idiomas
- **Plural pela regra do locale**, não por comparação com 1
- **Mudar o idioma persiste imediatamente** na fonte de verdade; senão volta ao anterior no próximo login

## Exemplo

Usuário brasileiro entra pela primeira vez sem preferência salva: o detector percorre os idiomas do navegador, normaliza `pt-BR` para `pt_BR`, encontra correspondência e carrega o português. Ele muda para inglês na tela de preferências — a escolha vai para o atributo de perfil. No dia seguinte, em outro computador com o navegador em português, a aplicação abre em inglês, porque a preferência explícita venceu.

---
Ref: [[Internationalization (i18n)]], [[Amazon Cognito]], [[Contrato de API Padronizado]], [[Progressive Web App (PWA)]]
