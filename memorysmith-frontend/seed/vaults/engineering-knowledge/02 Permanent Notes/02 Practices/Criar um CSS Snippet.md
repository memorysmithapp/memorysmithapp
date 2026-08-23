---
title: Criar um CSS Snippet
aliases:
  - CSS Snippet na Prática
  - Criar Snippet CSS
  - Custom Callout
tags:
  - obsidian
  - css
  - ui
  - pkm
  - practice
type: practice
status: evergreen
source: Obsidian Help — obsidian.md/help
author: Obsidian
created: 2026-08-07
---
Um CSS snippet é a menor unidade de customização visual do Obsidian: um arquivo `.css` dentro da configuration folder que muda parte da interface sem exigir um tema inteiro. Bem usado, ele serve menos à estética e mais ao método — dar forma visível distinta a um tipo de bloco (uma fonte citada, uma hipótese em aberto) para que a leitura da nota revele a estrutura do pensamento.

## Dinâmica / Passo a Passo

1. **Abra a snippets folder.** No desktop: **Settings → Appearance → CSS snippets → Open snippets folder**. No mobile ou tablet: pelo gerenciador de arquivos, entre na configuration folder do vault (o caminho aparece em **Manage vaults…**) e crie a pasta `snippets` se ela não existir.
2. **Escreva o `.css` preferindo CSS variables** a seletores contra a DOM interna do app. O Obsidian expõe variáveis justamente para isso — um `headers.css` com `--h1-color` a `--h6-color` dentro de `body` recolore os seis níveis de heading sem tocar em nenhuma classe interna.
3. **Defina uma classe para escopo por nota** e aplique-a via `cssclasses`. Com `.red-border img { border-color: #ff0000; border-style: solid; }` no snippet e `cssclasses: [red-border]` no frontmatter, só as notas marcadas mudam.
4. **Defina um tipo de callout customizado** com o seletor `.callout[data-callout="..."]`, onde o valor do atributo é o identificador que vai entre colchetes na nota. Dentro dele, `--callout-color` define a cor de fundo (qualquer cor CSS válida, hex ou `rgb()`) e `--callout-icon` aceita um ID de ícone do lucide.dev ou um elemento SVG inteiro.
5. **Recarregue e habilite:** **Appearance → CSS snippets → Reload snippets** faz o arquivo aparecer na lista; o toggle o ativa.
6. **Se nada acontecer, valide o CSS** com uma ferramenta como o CSS Validation Service — a doc é direta: CSS inválido simplesmente não funciona.
7. **Distribua por sync.** Snippets e temas estão entre os itens padrão do vault configuration sync (**Themes and snippets**), o que os leva aos outros dispositivos.

## Regras

- **Vários snippets ativos ao mesmo tempo; um tema só.** O CLI reflete a assimetria: `obsidian snippets:enabled` lista os snippets habilitados no plural, enquanto `obsidian theme` mostra *o* tema ativo e instalar um tema o aplica imediatamente, revertendo com **Stop using this theme**.
- **Hot reload ao salvar, mas nem sempre basta.** Uma vez habilitado, o Obsidian detecta as mudanças no arquivo e as aplica ao salvar, sem reiniciar; ainda assim, pode ser preciso rodar **Reload Obsidian without saving** para ver o efeito no tema ou na nota atual. Entre dispositivos, mudanças de CSS estão explicitamente na categoria **requires reload** do sync.
- **Snippets não têm loja nem revisão de segurança.** *"We do not have a community store for CSS snippets."* Plugins e temas do diretório oficial passam por varredura automática e recebem um safety scorecard; snippets vêm do fórum ou de repositórios públicos no GitHub e não passam por nada. Leia o CSS antes de colar.
- **CSS inválido não avisa, só não funciona.** Não existe mensagem de erro — o sintoma é o snippet aparecer habilitado e nada mudar.
- **Bundling de assets é exigido**, em snippets e em temas, com uma única exceção: Google Fonts, liberada para preservar desempenho no mobile.
- **Tipo de callout não definido cai no `note`.** Qualquer identificador não suportado e não customizado é renderizado como `note`, e o identificador é case-insensitive.
- **`--callout-color` e `--callout-icon` não são o limite.** Callouts aceitam seletores e propriedades CSS normais, mais variáveis para borda e título — `--callout-border-width`, `--callout-border-opacity`, ou esconder o título com `.callout-title { display: none; }`.
- **Cuidado com a versão dos ícones Lucide.** O Obsidian atualiza o conjunto periodicamente; use ícones da versão incluída ou anteriores.

## Exemplo

Dois tipos de callout para o método de notas deste vault: `[!fonte]` marca uma citação literal da documentação e `[!hipotese]`, uma leitura própria ainda não confirmada. O arquivo `metodo.css` na snippets folder:

```css
.callout[data-callout="fonte"] {
    --callout-color: 62, 122, 174;
    --callout-icon: lucide-quote;
}

.callout[data-callout="hipotese"] {
    --callout-color: 176, 122, 62;
    --callout-icon: lucide-flask-conical;
    --callout-border-width: 2px;
    --callout-border-opacity: 0.35;
}
```

Na nota, o uso é indistinguível de um callout nativo:

```markdown
> [!fonte] Obsidian Help — CSS snippets
> Obsidian looks for CSS snippets inside the vault's configuration folder.

> [!hipotese] A ausência de loja é uma escolha de superfície
> Sem canal oficial de distribuição, o snippet permanece um artefato lido antes de ser colado.
```

---
Ref: [[CSS Snippet]], [[Theme (Obsidian)]], [[Callout]], [[Configuration Folder]], [[Properties (Frontmatter)]], [[Obsidian Plugin]], [[Configurar Sync com Sincronização Seletiva]]
