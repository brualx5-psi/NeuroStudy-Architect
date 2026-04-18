# Carrossel Instagram — NeuroStudy (1080×1920)

Coleção de carrosséis 9:16 (Feed/Stories) prontos para postar no Instagram.

## Estrutura

```
marketing/instagram/
├── generate.mjs           # renderiza todos os posts
├── package.json
└── posts/
    ├── 01-apresentacao/       # tema escuro — apresentação do produto
    │   ├── slides.html
    │   ├── styles.css
    │   └── output/slide-1..7.png
    └── 02-repeticao-espacada/ # tema claro — curva do esquecimento
        ├── slides.html
        ├── styles.css
        └── output/slide-1..7.png
```

## Como gerar os PNGs

```bash
cd marketing/instagram
npm install                # instala Puppeteer (só na primeira vez)
npm run generate           # renderiza todos os posts
npm run generate -- 02     # só os posts que começam com "02"
```

Cada post gera PNGs em `posts/<slug>/output/`. Transfira para o celular e poste como carrossel.

## Convenção para novos posts

1. Crie `posts/NN-slug/` com `slides.html` + `styles.css`.
2. `slides.html` deve ter 7 `<section class="slide" id="slide-N">`.
3. Logo via `../../../../client/public/logo.png` (relativo ao `slides.html`).
4. Rode `node generate.mjs NN` para testar só esse post.

Alterne tema **escuro** (ex.: 01) e **claro** (ex.: 02) para variar o feed.

## Estrutura dos 7 slides

1. **Capa** — Logo + tagline "Estude menos. Aprenda mais."
2. **Problema** — "Horas estudando e pouco ficando na cabeça?"
3. **Solução** — IA + neurociência (Advance Organizers · Active Learning · Spaced Repetition).
4. **Guias com IA** — 4 modos: Survival · Normal · Hard · Pareto.
5. **Memória que dura** — Repetição Espaçada, Quiz, Flashcards, Mapas Mentais, Professor Virtual, Book Mode.
6. **Deep Research** — PubMed, OpenAlex, Pirâmide de Evidências.
7. **CTA** — "Comece hoje" + site + @handle.

## Preview no navegador

Abra `slides.html` direto no navegador; todos os slides aparecem empilhados. Para ver um slide isolado em tamanho real (1080×1920), use a ferramenta de dispositivo do DevTools.

## Ajustes rápidos

- **Trocar @handle ou site** → slide 7 em `slides.html` (classe `.cta-handles`).
- **Ajustar cor** → variáveis de gradiente em `styles.css` (ex.: `.i-indigo`, `.i-cyan`).
- **Editar texto** → direto nas `<section class="slide">` de `slides.html`.

Depois de qualquer ajuste, rode `npm run generate` novamente.
