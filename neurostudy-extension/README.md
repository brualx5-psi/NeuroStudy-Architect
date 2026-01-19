# NeuroStudy Capture - Chrome Extension

Extensão Chrome para capturar transcrições de vídeos de cursos online e enviar diretamente para o NeuroStudy.

## 🎯 Funcionalidades

- ✅ Detecta automaticamente plataformas de curso (Hotmart, Eduzz, Kiwify, etc.)
- ✅ Extrai legendas/transcrições com timestamps
- ✅ Integra diretamente com sua conta NeuroStudy
- ✅ Seleciona pasta e estudo de destino
- ✅ Marca como fonte principal ou complementar

## 📦 Instalação (Desenvolvimento)

1. Abra `chrome://extensions/` no Chrome
2. Ative "Modo do desenvolvedor" (canto superior direito)
3. Clique em "Carregar sem compactação"
4. Selecione a pasta `neurostudy-extension`

## 🔧 Estrutura

```
neurostudy-extension/
├── manifest.json           # Configuração Manifest V3
├── icons/                  # Ícones da extensão
├── popup/                  # Interface do popup
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── content/                # Script injetado nas páginas
│   └── content.js
├── background/             # Service worker
│   └── background.js
└── lib/                    # Módulos compartilhados
    ├── auth.js
    ├── api.js
    └── extractors.js
```

## 🚀 Como usar

1. Instale a extensão
2. Clique no ícone e faça login com sua conta NeuroStudy
3. Abra uma aula em qualquer plataforma de curso
4. Clique no ícone da extensão
5. Selecione a pasta e o estudo
6. Clique em "Enviar para NeuroStudy"

## 🔒 Requisitos

- Plano **Pro** ou **Plus** do NeuroStudy
- Vídeo com legendas/transcrições disponíveis

## 🛠️ Desenvolvimento

### Ícones

Para gerar os ícones, use uma imagem PNG 128x128 do logo NeuroStudy e redimensione para:
- `icon16.png` (16x16)
- `icon48.png` (48x48)
- `icon128.png` (128x128)

### Publicação na Chrome Web Store

1. Crie uma conta de desenvolvedor ($5 taxa única)
2. Acesse: https://chrome.google.com/webstore/devconsole
3. Clique em "Novo item"
4. Faça upload do .zip da extensão
5. Preencha os detalhes e screenshots
6. Envie para revisão

## 📄 Licença

Propriedade de NeuroStudy - Todos os direitos reservados.
