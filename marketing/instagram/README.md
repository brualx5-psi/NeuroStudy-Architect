# Marketing — NeuroStudy

Carrosséis 1080×1920 (9:16) para Instagram, mais o utilitário que recolore os
assets da marca.

## Estrutura

```
marketing/instagram/
├── generate.mjs               # renderiza os carrosséis
├── recolor-logo.mjs           # recolore PNGs da marca por rotação de matiz
├── shot-app.mjs               # captura a tela de login do build (conferência visual)
└── posts/
    ├── 01-apresentacao/       # tema escuro quente — apresenta o produto
    └── 02-repeticao-espacada/ # tema papel — curva do esquecimento
        ├── slides.html
        ├── styles.css
        └── output/slide-1..7.png
```

## Gerar os PNGs

```bash
cd marketing/instagram
npm install            # só na primeira vez
npm run generate       # todos os posts
node generate.mjs 02   # só os posts começando em "02"
```

Saem em `posts/<slug>/output/`. É só passar pro celular e postar como carrossel.

## Identidade

Os dois posts seguem o rebrand "artigo científico" — a mesma paleta do app:

| | valor |
|---|---|
| Papel | `#fdfbf7` |
| Tinta | `#1c1917` |
| Primária | `#0f766e` (teal-700) |
| Primária escura | `#115e59` |
| Acento | `#b45309` (âmbar) |
| Títulos | Merriweather (serifa) |
| Corpo | Inter |

Os tons de fundo com texto branco foram escolhidos para passar WCAG AA
(≥ 4.5:1) — por isso são um passo mais escuros que o padrão do Tailwind.

**Alternar temas entre posts** (escuro → papel → escuro) mantém o feed variado
sem sair da identidade. O tema escuro daqui é *quente* (`#0c1a17`), nunca preto
puro com vidro fosco — esse é o visual do concorrente, e o ponto do rebrand foi
justamente sair dele.

## Convenção para novos posts

1. Crie `posts/NN-slug/` com `slides.html` e `styles.css`.
2. O HTML precisa de 7 `<section class="slide" id="slide-N">`.
3. Logo em `../../../../client/public/logo.png` (relativo ao `slides.html`).
4. Use `class="body"` no bloco de conteúdo: junto com o `margin-top:auto` do
   rodapé, ele centraliza o conteúdo verticalmente sem cálculo de altura.
5. Rode `node generate.mjs NN` para testar só esse post.

## recolor-logo.mjs

Rotaciona o matiz de um PNG em espaço HSL real, preservando saturação,
luminância e transparência — o `hue-rotate` do CSS é uma aproximação matricial
que distorce os três. Detecta o matiz dominante de cada arquivo e o desloca até
o teal da marca, então funciona mesmo com assets de origens diferentes.

```bash
node recolor-logo.mjs --report <png...>   # só analisa
node recolor-logo.mjs <png...>            # reescreve no lugar
```
