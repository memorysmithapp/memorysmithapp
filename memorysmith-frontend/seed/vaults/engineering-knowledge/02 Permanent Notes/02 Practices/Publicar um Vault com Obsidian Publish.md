---
title: Publicar um Vault com Obsidian Publish
aliases:
  - Publicar com Obsidian Publish
  - Setup do Obsidian Publish
  - Publish Setup
tags:
  - obsidian
  - publish
  - pkm
  - css
  - practice
type: practice
status: evergreen
source: Obsidian Help — obsidian.md/help
author: Obsidian
created: 2026-08-07
---
Publicar um vault não é exportar arquivos: é escolher, nota a nota ou pasta a pasta, qual subconjunto do vault vira site — e depois assumir a manutenção de URLs que outras pessoas passarão a linkar. O que muda em relação ao vault local é o custo do erro: uma nota renomeada localmente tem os links atualizados sozinha, mas na web vira um 404 até que se crie o redirect.

## Dinâmica / Passo a Passo

1. **Faça login e ative o core plugin.** **Settings → General → Account → Your account → Log in**, depois **Settings → Core plugins → Publish**. O diálogo **Publish changes** abre pela ribbon (ícone de envio), pela Command palette (**Publish: Publish changes...**) ou por hotkey.
2. **Crie o site** informando o **Site ID** — o caminho da URL: `my-amazing-site` responde em `publish.obsidian.md/my-amazing-site`. Depois defina o **Site name** em **Change site options → General**.
3. **Defina Homepage File e Logo** nas site options: o Homepage File é o Markdown que serve de landing page; o Logo é a imagem do banner, e ela **precisa estar publicada**.
4. **Marque o que entra.** `publish: true` no frontmatter inclui a nota automaticamente; `publish: false` a ignora. Em **Manage publish filters** existem as listas de **Included folders** e **Excluded folders**.
5. **Publique com Add linked.** No diálogo, **NEW** lista o que ainda não foi publicado; **Add linked** inclui as notas e imagens linkadas para evitar links quebrados — respeitando as exclusões. Revise a seleção antes de confirmar. **CHANGED** atualiza o já publicado e **UNCHANGED** permite despublicar.
6. **Aplique os metadados por property:** `permalink` encurta a URL (`permalink: about` transforma `/Company/About+us` em `/about`, com redirect automático do endereço antigo), `description` e `image`/`cover` alimentam os cartões de link social.
7. **Aplique um tema.** No file explorer do sistema, entre em `.obsidian/themes`, copie o CSS do tema, cole na **raiz do vault**, renomeie para `publish.css` e publique o arquivo. Por padrão `publish.css` e `publish.js` não aparecem no file explorer do app, mas aparecem no diálogo de publicação.
8. **Adicione o favicon** — `favicon-32.png`, `favicon-32x32.png` ou `favicon.ico` — em qualquer lugar do vault, desde que publicado.
9. **Ajuste site options e navegação.** As seções **Reading experience** e **Components** ligam ou desligam recursos como o graph view; **Customize navigation** permite arrastar notas e pastas para reordenar e usar **Hide in navigation** para esconder itens publicados.
10. **Restrinja o acesso, se for o caso:** **Passwords** protege o site inteiro; **Disallow search engine indexing** adiciona um `robots.txt` contra crawlers respeitosos.
11. **Configure o custom domain no Cloudflare** — o único provedor oficialmente suportado. Crie um registro **CNAME** no domínio e defina, em **SSL/TLS**, o modo de criptografia como **Full**.
12. **Verifique `/sitemap.xml` e `/rss.xml`**, gerados automaticamente, e registre o site no Google Search Console se quiser acompanhar o SEO.

## Regras

- **`publish: true` sobrepõe pasta excluída.** *"If a file has `publish: true`, it will still be published even if it is in a folder or filter that is excluded."* O controle mais específico vence.
- **Renomeou uma nota? Crie o redirect e apague o antigo à mão.** O alias precisa conter o **caminho completo** da nota antiga (`Guides/Making friends`, não `Making friends`) — só o nome funciona no vault local, não no Publish. E a deleção de notas renomeadas ou removidas exige marcar o checkbox manualmente no passo de publicação: por segurança, ele não vem selecionado.
- **O Publish não lê a configuration folder.** *"Publish does not read from the configuration folder."* CSS só entra pelo `publish.css` na raiz do vault publicado.
- **`publish.js` e Analytics exigem custom domain.** JavaScript customizado e analytics não funcionam no domínio `publish.obsidian.md`.
- **SSL/TLS em "Flexible" causa redirect loop.** Se o site entrar em loop depois do custom domain, o modo do Cloudflare provavelmente ficou em Flexible em vez de Full.
- **A busca do site é de texto simples e tem ordem de preferência:** nomes de arquivo, aliases e headers primeiro; só depois o texto das notas. Nomes descritivos e múltiplos aliases servem, ao mesmo tempo, à busca do site e ao grafo local.
- **Limites e ausências:** arquivos de até 50 MB; plugins que exigem code block para renderizar não funcionam; resultados de busca embutidos não são suportados; o grafo publicado não tem as opções de ordenação e visualização do app.
- **Despublicar não apaga nada localmente.** As notas permanecem no vault.

## Exemplo

Um vault com `02 Permanent Notes` inteiramente público e `00 Inbox` privado: em **Manage publish filters**, `02 Permanent Notes` entra em **Included folders** e `00 Inbox` em **Excluded folders**. Uma única nota de rascunho útil como landing page recebe `publish: true` mesmo estando na pasta excluída, e vira o **Homepage File**.

Meses depois, `Ligar Notas.md` é renomeada para `Ligar Notas em Três Granularidades.md`. Localmente, nada quebra. No site, quebraria — a correção é adicionar no frontmatter da nota nova:

```yaml
---
aliases:
  - 02 Permanent Notes/Practices/Ligar Notas
permalink: linking
---
```

e, no diálogo **Publish changes**, marcar manualmente o checkbox de deleção do arquivo antigo.

---
Ref: [[Obsidian Publish]], [[Alias (Obsidian)]], [[Properties (Frontmatter)]], [[CSS Snippet]], [[Theme (Obsidian)]], [[DNS]], [[Transport Layer Security (TLS)]], [[Graph View]]
