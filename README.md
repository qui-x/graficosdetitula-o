# Gráficos de investigação

Editor de leituras experimentais para construir gráficos de **pH × volume** e **ΔpH/ΔV**, sem executar uma titulação simulada. O projeto usa **Vite**, **Tailwind CSS** e **TypeScript**, com publicação estática e suporte a PWA.

## Executar localmente

Requer Node.js 22.12 ou mais recente.

```bash
npm install
npm run dev
```

Para validar os cálculos e preparar a versão publicada:

```bash
npm run typecheck
npm test
npm run build
npm run preview
```

Tailwind CSS, TypeScript e Vite são ferramentas de desenvolvimento: os utilizadores recebem os ficheiros estáticos compilados, sem carregar essas dependências pela internet durante o uso.

## Recursos

- Edição manual das colunas Série, Volume (mL) e pH.
- Gráficos pH × volume e ΔpH/ΔV calculado a partir de leituras consecutivas.
- Personalização independente de títulos, nomes, limites e intervalos de eixo; intervalo mínimo de 0,001.
- Rótulos numéricos configuráveis de 3 a 6 casas decimais.
- Cores por série, grade, linhas e marcadores.
- Importação e exportação CSV; exportação do gráfico em SVG; impressão.
- Exportação e importação das configurações em JSON.
- Aparência clara/escura com controles de acessibilidade e interface responsiva.
- Rascunho automático, incluindo leituras, cores e configurações, armazenado localmente no navegador.
- PWA instalável, com manifesto, ícones gerados a partir do SVG principal, atualização automática e cache offline dos arquivos compilados.

## Modelo dos gráficos

O gráfico pH × volume conecta somente os pontos inseridos. A derivada é calculada por `(pH atual − pH anterior) / (volume atual − volume anterior)` para leituras consecutivas da mesma série. Não são estimados pontos ausentes. Valores incompletos ou fora do domínio são identificados e não são plotados.

## Instalação e uso offline

No navegador compatível, utilize **Instalar app** quando o botão aparecer; a disponibilidade depende do navegador e das condições de instalação. Depois do primeiro carregamento concluído, o service worker mantém os recursos necessários em cache. Leituras e configurações ficam no armazenamento local desse navegador e não são sincronizadas entre dispositivos.

O VLibras é opcional e precisa de conexão quando ativado.

## Arquivos principais

- `app/index.html` — HTML de entrada do Vite.
- `app/src/main.ts` — interações do editor e renderização dos gráficos.
- `app/src/graph-model.ts` — validação de dados, agrupamento e cálculos tipados.
- `app/src/style.css` — Tailwind CSS e regras responsivas/temáticas.
- `app/src/a11y.ts` — controles de acessibilidade.
- `app/src/pwa.ts` — instalação e estado offline.
- `app/public/favicon.svg` — símbolo de gota com gráfico usado na identidade visual.
- `tests/graph-model.test.ts` — testes do núcleo de cálculos.
- `vite.config.ts` — build do site e configuração PWA para GitHub Pages.

## Publicação

O workflow `.github/workflows/build-pages.yml` executa a checagem de tipos, os testes e a compilação. Para preservar a publicação atual por branch do GitHub Pages, ele copia o build estático para a raiz da branch e grava o bundle gerado. O HTML de origem permanece em `app/index.html`.
