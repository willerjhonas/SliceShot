# Arquitetura do SliceShot

Este documento descreve a estrutura e o design do sistema SliceShot.

## Visão Geral
O SliceShot é uma aplicação desktop baseada em **Electron** e **React**, organizada como um monorepo para facilitar a manutenção e o compartilhamento de código.

## Estrutura de Pastas

```text
/ (raiz)
├── apps/
│   ├── electron/        # Processo Principal (Backend do desktop)
│   │   ├── main.js      # Ponto de entrada do Electron
│   │   └── preload.js   # Ponte de segurança (Context Bridge)
│   └── renderer/        # Interface do Usuário (React + Vite + Tailwind)
│       ├── src/
│       │   ├── components/  # Componentes UI (shadcn/ui e customizados)
│       │   └── lib/         # Utilitários e hooks
│       └── index.html
├── packages/
│   └── core/            # Lógica de negócio compartilhada
│       └── slicer.js    # Motor de processamento de imagens/PDF
├── data/                # Diretório padrão para saídas de processamento
└── package.json         # Configuração de workspaces e scripts globais
```

## Comunicação entre Processos (IPC)
A aplicação utiliza o `ipcMain` e `ipcRenderer` para comunicação segura através do `preload.js`:

1. **Renderer -> Main**: A interface solicita ações como abrir diálogos de arquivo ou iniciar o fatiamento.
2. **Main -> Renderer**: O processo principal envia atualizações de progresso em tempo real durante o fatiamento.

## Fluxo de Dados de Fatiamento
1. O usuário seleciona arquivos via `dialog:openFile`.
2. A interface chama `slicer:run` enviando o caminho do arquivo e a altura máxima.
3. O `main.js` invoca a função `sliceImage` do `packages/core`.
4. O `core` processa a imagem usando **Sharp** e envia callbacks de progresso.
5. O `main.js` retransmite o progresso para a interface via `slicer:progress`.

## Melhores Práticas Aplicadas
- **Separação de Preocupações**: Lógica de UI isolada da lógica de processamento de imagem.
- **Segurança**: `contextIsolation` habilitado, expondo apenas APIs necessárias via `electronAPI`.
- **Desempenho**: Otimização de renderização React e processamento de imagem assíncrono.
