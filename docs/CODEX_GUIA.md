# 🚀 Guia Completo do OpenAI Codex CLI

> **Referência rápida** para uso do Codex CLI no projeto NeuroStudy

---

## 📌 O que é o Codex?

Um **agente de codificação** da OpenAI que pode:
- ✅ **Escrever código** adaptado ao seu projeto
- ✅ **Entender codebases** complexas ou legadas
- ✅ **Revisar código** e identificar bugs
- ✅ **Debugar problemas** e sugerir correções
- ✅ **Automatizar tarefas** como refatoração, testes e migrações

---

## 📁 AGENTS.md - Instruções Customizadas

O arquivo `AGENTS.md` dá instruções persistentes ao Codex.

### Locais de Criação:

| Local | Uso |
|-------|-----|
| `~/.codex/AGENTS.md` | **Global** - funciona em todos os projetos |
| `./AGENTS.md` | **Projeto** - específico para o repositório |
| `./pasta/AGENTS.md` | **Subpasta** - sobrescreve regras anteriores |

### Gerar automaticamente:
```bash
/init
```

---

## ⚡ Comandos Principais

### Iniciar o Codex:

```bash
# Modo interativo (TUI completa)
codex

# Resposta rápida sem interação
codex "sua pergunta aqui"

# Execução automática (para scripts/CI)
codex exec "tarefa a executar"
```

### Retomar Conversas Salvas:

```bash
# Lista sessões salvas
codex resume

# Retoma a última sessão diretamente
codex resume --last

# Mostra sessões de todos os diretórios
codex resume --all

# Retoma sessão específica por ID
codex resume <SESSION_ID>
```

---

## 🎛️ Slash Commands (usar dentro do Codex)

### Controle de Sessão:

| Comando | Descrição |
|---------|-----------|
| `/new` | Iniciar nova conversa |
| `/resume` | Retomar conversa salva |
| `/fork` | Criar branch de uma conversa salva |
| `/status` | Ver status da sessão atual |
| `/compact` | Compactar histórico (economiza tokens) |
| `/exit` ou `/quit` | Sair do Codex |

### Modelos e Configuração:

| Comando | Descrição |
|---------|-----------|
| `/model` | Trocar modelo (ver seção abaixo) |

---

## 🧠 Modelos Disponíveis - Quando Usar Cada Um

| Modelo | Descrição | Quando Usar |
|--------|-----------|-------------|
| **gpt-5.2-codex** | Modelo agentico de coding mais recente | ✅ **Padrão recomendado** - Desenvolvimento diário, features novas, refatorações |
| **gpt-5.1-codex-max** | Flagship para raciocínio profundo e rápido | 🧠 **Tarefas complexas** - Debugging difícil, arquitetura, decisões críticas |
| **gpt-5.1-codex-mini** | Mais rápido e barato, menos capaz | ⚡ **Tarefas simples** - Correções pequenas, formatação, perguntas rápidas |
| **gpt-5.2** | Modelo generalista frontier | 📚 **Conhecimento amplo** - Explicações, documentação, pesquisa |

### Guia Rápido de Escolha:

```
Tarefa simples/rápida? → gpt-5.1-codex-mini (economiza tokens)
Desenvolvimento normal? → gpt-5.2-codex (padrão)
Problema complexo?     → gpt-5.1-codex-max (análise profunda)
Docs/Pesquisa?         → gpt-5.2 (conhecimento geral)
```

### Como Trocar:
```bash
/model              # Abre lista para escolher
/model gpt-5.1-codex-max  # Troca direto
```

---

## ⚡ Níveis de Raciocínio (Reasoning Effort)

Além do modelo, você pode ajustar a **profundidade de raciocínio**:

| Nível | Descrição | Quando Usar |
|-------|-----------|-------------|
| **Low** | Respostas rápidas, raciocínio leve | ⚡ Perguntas simples, formatação, tarefas triviais |
| **Medium** (padrão) | Equilibra velocidade e profundidade | ✅ **Uso diário** - maioria das tarefas |
| **High** | Raciocínio mais profundo | 🧠 Problemas complexos, bugs difíceis |
| **Extra High** | Máxima profundidade de análise | 🔬 Arquitetura, decisões críticas, edge cases |

### Dica de Combinação:
```
Tarefa simples    → gpt-5.1-codex-mini + Low
Desenvolvimento   → gpt-5.2-codex + Medium
Bug complexo      → gpt-5.1-codex-max + High
Decisão crítica   → gpt-5.1-codex-max + Extra High
```
| `/approvals` | Mudar modo de aprovação |
| `/init` | Gerar AGENTS.md automático |

### Código e Revisão:

| Comando | Descrição |
|---------|-----------|
| `/review` | Revisão de código do working tree |
| `/diff` | Ver mudanças Git (staged/unstaged) |
| `/mention arquivo` | Adicionar arquivo à conversa |

### Outros:

| Comando | Descrição |
|---------|-----------|
| `/mcp` | Listar ferramentas MCP disponíveis |
| `/feedback` | Enviar feedback para OpenAI |
| `/logout` | Deslogar da conta |

---

## 🛡️ Modos de Aprovação

| Modo | Descrição |
|------|-----------|
| **Auto** (padrão) | Lê, edita e executa comandos na pasta do projeto |
| **Read-only** | Apenas consulta, não faz mudanças |
| **Full Access** | Acesso total à máquina (⚠️ use com cuidado!) |

Para mudar: `/approvals`

---

## 🖼️ Enviar Imagens

```bash
# Uma imagem
codex -i screenshot.png "Explique esse erro"

# Múltiplas imagens
codex --image img1.png,img2.jpg "Analise esses diagramas"
```

Formatos aceitos: PNG, JPEG

---

## 🔍 Busca Web (Opcional)

Habilite em `~/.codex/config.toml`:

```toml
[features]
web_search_request = true

[sandbox_workspace_write]
network_access = true
```

---

## ⚙️ Configuração Avançada

### Arquivo de Configuração Global:
`~/.codex/config.toml`

### Instruções em Português:
Já configurado em `~/.codex/instructions.md`

### Exemplo de AGENTS.md:

```markdown
# Instruções do Projeto

## Idioma
- Sempre responda em português brasileiro (pt-BR)

## Convenções
- Use TypeScript com tipagem estrita
- Siga o padrão de código existente
- Comente código complexo

## Testes
- Sempre execute `npm run build` antes de finalizar
- Valide mudanças com `npm run lint`
```

---

## 🔗 Integrações Disponíveis

| Serviço | Descrição |
|---------|-----------|
| **GitHub** | Issues, PRs, Actions |
| **Slack** | Notificações e comandos |
| **Linear** | Gerenciamento de tarefas |

---

## 💡 Dicas Importantes

1. **`/init`** → Gera um AGENTS.md inicial para seu projeto
2. **`/compact`** → Use quando a conversa ficar muito longa
3. **`codex resume --last`** → Continua de onde parou
4. **`codex exec`** → Perfeito para automação em CI/CD
5. **`/review`** → Peça revisão antes de fazer commit

---

## 🔗 Links Úteis

- [Documentação Oficial](https://developers.openai.com/codex)
- [Quickstart](https://developers.openai.com/codex/quickstart)
- [Modelos Disponíveis](https://developers.openai.com/codex/models)
- [Configuração Avançada](https://developers.openai.com/codex/config-advanced)
- [AGENTS.md Guide](https://developers.openai.com/codex/guides/agents-md)

---

*Documento criado em: 19/01/2026*
*Projeto: NeuroStudy-Architect*
