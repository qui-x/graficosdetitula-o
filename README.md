<div align="center">
  <img src="https://qui-x.github.io/graficosdetitula-o/favicon.svg" width="92" height="92" alt="Símbolo do Gráficos de investigação: uma gota com uma linha de gráfico">

  <h1>Gráficos de investigação</h1>
  <p><strong>Leituras experimentais. Gráficos claros. Sem simulação artificial.</strong></p>
  <p>Um editor manual para organizar dados de pH, comparar séries e gerar gráficos prontos para análise e documentação.</p>

  <p>
    <a href="https://qui-x.github.io/graficosdetitula-o/"><img src="https://img.shields.io/badge/Abrir%20aplicativo-006e89?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Abrir aplicativo"></a>
  </p>

  <p>
    <a href="https://github.com/qui-x/graficosdetitula-o/actions/workflows/build-pages.yml"><img src="https://github.com/qui-x/graficosdetitula-o/actions/workflows/build-pages.yml/badge.svg?branch=feat%2Feditor-graficos-manual" alt="Build e testes"></a>
    <img src="https://img.shields.io/badge/TypeScript-7-blue?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
    <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS">
    <img src="https://img.shields.io/badge/PWA-pronto%20para%20instalar-0F766E?style=flat-square" alt="Aplicativo web progressivo">
    <img src="https://img.shields.io/badge/Idioma-Portugu%C3%AAs%20(Brasil)-475569?style=flat-square" alt="Português do Brasil">
  </p>
</div>

---

## Visão geral

**Gráficos de investigação** é um espaço de trabalho para inserir leituras manualmente e visualizar relações entre **pH e volume**. A ferramenta também calcula a variação `ΔpH/ΔV` entre leituras consecutivas da mesma série.

O princípio central é a transparência: **o gráfico representa os dados informados**. O aplicativo não inventa pontos intermediários nem executa uma titulação simulada para completar a curva.

## O que você pode fazer

| Recurso | O que oferece |
| --- | --- |
| **Edição de dados** | Informar nome da série, volume adicionado em mL e pH medido. |
| **Dois gráficos** | Alternar entre `pH × volume` e `ΔpH/ΔV`. |
| **Personalização** | Editar títulos, rótulos, limites e intervalos dos eixos; configurar precisão de 3 a 6 casas decimais. |
| **Estilo visual** | Definir cores individuais por série e controlar grade, linhas e marcadores. |
| **Importação e exportação** | Trabalhar com CSV, exportar gráficos em SVG e salvar configurações em JSON. |
| **Impressão** | Preparar a visualização para impressão ou documentação. |
| **Acessibilidade** | Usar temas claro/escuro, alto contraste, ampliação de texto, espaçamento, leitura simples, redução de movimento e filtros de visão de cores. |
| **Uso como aplicativo** | Instalar como PWA em navegadores compatíveis e reabrir a ferramenta offline depois do primeiro carregamento. |

## Começar a usar

**Aplicativo publicado:** [qui-x.github.io/graficosdetitula-o](https://qui-x.github.io/graficosdetitula-o/)

1. Adicione uma leitura e preencha o volume e o pH medido.
2. Informe o nome da série. Leituras com o mesmo nome são agrupadas visualmente.
3. Alterne entre os dois tipos de gráfico e ajuste a apresentação em **Personalizar gráficos**.
4. Exporte os dados em CSV, o gráfico em SVG ou os ajustes em JSON, conforme a necessidade.

Valores decimais aceitam vírgula ou ponto. Leituras incompletas e valores fora do domínio são sinalizados e não entram no gráfico. Intervalos manuais dos eixos respeitam a resolução mínima de **0,001**; quando a escala produzir marcações demais, a ferramenta amplia o intervalo para preservar a legibilidade.

## Instalar e usar offline

Em navegadores compatíveis, selecione **Instalar app** quando a opção estiver disponível. No iOS, normalmente é necessário abrir o menu **Compartilhar** do Safari e escolher **Adicionar à Tela de Início**.

Após o carregamento inicial, o PWA usa o cache local dos arquivos necessários para permitir a reabertura sem conexão. Leituras, cores e configurações são guardadas no armazenamento do navegador. Esses dados **não são enviados nem sincronizados automaticamente** com outros dispositivos; exporte um CSV ou JSON para manter uma cópia externa.

O tradutor VLibras é opcional e precisa de conexão quando ativado.

## Desenvolvimento local

A versão de desenvolvimento usa [Vite](https://vite.dev/), [Tailwind CSS](https://tailwindcss.com/) e [TypeScript](https://www.typescriptlang.org/). É necessário Node.js 22.12 ou mais recente.

```bash
npm install
npm run dev
```

Para validar os tipos, executar os testes e gerar a versão de produção:

```bash
npm run typecheck
npm test
npm run build
npm run preview
```

O CSS e o TypeScript são processados durante a compilação. O usuário final recebe os arquivos estáticos gerados, sem precisar carregar o Tailwind ou o compilador TypeScript pela internet.

## Organização do projeto

| Caminho | Responsabilidade |
| --- | --- |
| `app/index.html` | Estrutura da interface. |
| `app/src/main.ts` | Interações, entrada dos dados e renderização dos gráficos. |
| `app/src/graph-model.ts` | Validação, segmentação das séries e cálculos matemáticos. |
| `app/src/style.css` | Estilos Tailwind, temas e regras responsivas. |
| `app/src/a11y.ts` | Preferências de acessibilidade. |
| `app/src/pwa.ts` | Instalação e informações de conectividade do PWA. |
| `app/public/favicon.svg` | Símbolo da gota com gráfico e origem dos ícones. |
| `tests/graph-model.test.ts` | Testes automatizados do núcleo matemático. |
| `vite.config.ts` | Compilação, caminhos do GitHub Pages e geração PWA. |
| `.github/workflows/build-pages.yml` | Validação e publicação automatizadas. |

## Como interpretar os resultados

O gráfico `pH × volume` conecta os pontos que foram digitados. A taxa de variação é calculada por:

```text
ΔpH/ΔV = (pH atual − pH anterior) / (volume atual − volume anterior)
```

O cálculo é feito apenas entre leituras consecutivas da mesma série e com volumes diferentes. Uma variação negativa representa queda do pH naquele intervalo.

A ferramenta não determina automaticamente ponto de equivalência, pKa ou distribuição de espécies e não valida a qualidade experimental das medições. Em análises químicas, a interpretação deve considerar o método, o instrumento, as incertezas e o contexto da amostra.

## Qualidade e contribuições

O fluxo de integração contínua verifica os tipos, executa testes automatizados do núcleo matemático e compila a aplicação antes da publicação. Mudanças na interface devem preservar o uso por teclado, os alvos de toque, a responsividade, os temas de cor e o funcionamento sem conexão após o primeiro carregamento.

Para relatar problemas, descreva o navegador e o dispositivo, os passos para reproduzir o comportamento e, quando possível, um CSV de exemplo sem informações sensíveis.

---

<div align="center">
  <sub>Gráficos de investigação · Ferramenta de apoio à análise de dados experimentais</sub>
</div>
