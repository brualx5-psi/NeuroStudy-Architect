# NeuroStudy-Architect - Instruções para o Codex

## 🌍 Idioma
- **SEMPRE** responda em **português brasileiro (pt-BR)**
- Use linguagem clara, profissional e técnica quando necessário
- Mensagens de commit também em português (ex: `feat: adiciona componente X`)
- Comentários no código podem ser em inglês para padrão internacional

---

## 📋 Sobre o Projeto

**NeuroStudy** é uma plataforma de estudos baseada em neurociência que:
- Gera guias de estudo personalizados usando IA (Gemini)
- Suporta múltiplos modos de estudo: SURVIVAL, NORMAL, HARD, PARETO
- Processa diversos tipos de fonte: PDF, URL, Vídeo, Texto, DOI, EPUB
- Inclui flashcards, quizzes, mapas mentais e checkpoints interativos
- Sistema de revisão espaçada baseado em ciência cognitiva

---

## 🛠️ Stack Técnico

### Frontend
- **React 18** com TypeScript estrito
- **Vite** para build e dev server
- **TailwindCSS** para estilização
- **Framer Motion** para animações
- **Lucide React** para ícones

### Backend/API
- **Vercel Edge Functions** (pasta `/api`)
- **Gemini AI** (@google/genai) para geração de conteúdo
- **Supabase** para autenticação e dados (opcional)

### Estilo Visual
- Design **glassmorphism** com gradientes
- Tema escuro predominante
- Animações suaves e responsivas

---

## 📁 Estrutura do Projeto

```
/client
  /src
    /components    # Componentes React (PascalCase)
    /services      # Serviços (geminiService.ts, etc)
    /types.ts      # Tipos TypeScript
    App.tsx        # Componente principal
    main.tsx       # Entry point
/api               # Serverless functions (Vercel)
/docs              # Documentação
/supabase          # Migrations e config do Supabase
```

---

## ✅ Convenções de Código

### TypeScript
- Tipagem estrita obrigatória
- Evite `any`, prefira tipos explícitos
- Use interfaces para objetos complexos
- Enums para valores fixos (ex: `StudyMode`, `InputType`)

### React
- Componentes funcionais com hooks
- Use `useState`, `useEffect`, `useMemo` apropriadamente
- Evite prop drilling excessivo
- Componentes em arquivos separados (um por arquivo)

### Nomenclatura
- **Componentes**: PascalCase (`ResultsView.tsx`)
- **Funções/variáveis**: camelCase (`handleSubmit`)
- **Constantes**: UPPER_SNAKE_CASE (`API_KEY`)
- **Tipos/Interfaces**: PascalCase (`StudyGuide`)

### CSS/Tailwind
- Use classes do Tailwind
- Mantenha consistência com o design existente
- Glassmorphism: `bg-white/10 backdrop-blur-lg`

---

## 🔧 Comandos Úteis

```bash
# Desenvolvimento
npm run dev       # Inicia servidor de desenvolvimento

# Build
npm run build     # Build para produção

# Lint
npm run lint      # Verifica erros de lint
```

---

## ⚠️ Regras Importantes

1. **Sempre execute `npm run build`** antes de finalizar para garantir que não há erros
2. **Não quebre funcionalidades existentes** - teste o impacto das mudanças
3. **Mantenha o estilo visual** - glassmorphism, tema escuro, animações suaves
4. **Respeite os tipos existentes** em `types.ts`
5. **Gemini API** está em `/client/src/services/geminiService.ts`

---

## 🎯 Modos de Estudo (Contexto)

| Modo | Descrição |
|------|-----------|
| `SURVIVAL` | Estudo rápido, emergencial |
| `NORMAL` | Estudo balanceado padrão |
| `HARD` | Estudo intensivo e profundo |
| `PARETO` | Foco 80/20, essência do conteúdo |

---

## 📚 Componentes Principais

- `App.tsx` - Componente raiz e lógica principal
- `ResultsView.tsx` - Exibição do guia de estudos gerado
- `geminiService.ts` - Integração com Gemini AI
- `Sidebar.tsx` - Navegação lateral
- `QuizView.tsx` - Sistema de quiz interativo
- `FlashcardsView.tsx` - Flashcards para revisão
- `SettingsModal.tsx` - Configurações do usuário

---

*Última atualização: Janeiro 2026*
