# Carrossel Instagram — NeuroStudy (1080×1920)

Post de 7 slides apresentando o NeuroStudy, pronto para postar no Instagram (Feed/Stories em 9:16).

## Arquivos

- `slides.html` — os 7 slides (edite o copy aqui).
- `styles.css` — identidade visual (paleta indigo/ciano/violeta + glassmorphism).
- `generate.mjs` — script Puppeteer que renderiza cada slide em PNG.
- `output/slide-1.png` … `output/slide-7.png` — imagens finais prontas para upload.

## Como gerar os PNGs

```bash
cd marketing/instagram
npm install     # instala Puppeteer localmente (isolado do app)
npm run generate
```

As imagens caem em `output/`. Transfira para o celular e poste como carrossel.

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
