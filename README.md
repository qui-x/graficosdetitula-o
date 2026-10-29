# Gráficos de Titulação — editor manual

Ferramenta em HTML único para inserir dados experimentais e analisar gráficos de **pH × volume** e **ΔpH/ΔV**, sem precisar executar uma titulação simulada.

## Como abrir

Abra [index.html](index.html) diretamente em um navegador moderno. O arquivo não precisa de servidor, npm, bibliotecas externas ou conexão com a internet. Também pode ser publicado como site estático pelo GitHub Pages.

## Recursos

- Edição manual das colunas Série, Volume (mL) e pH.
- Gráfico pH × volume e gráfico da variação ΔpH/ΔV calculada a partir de leituras consecutivas.
- Personalização independente dos títulos e dos nomes dos eixos de ambos os gráficos.
- Limites mínimo/máximo e intervalo de marcação configuráveis para os eixos; intervalo mínimo de 0,001.
- Rótulos numéricos de 3 a 6 casas decimais.
- Cores individuais por série e controles para grade, linhas e marcadores.
- Importação e exportação de CSV, exportação do gráfico em SVG e impressão.
- Exportação/importação das personalizações em JSON.
- Ajuste automático da escala quando os limites são deixados vazios.

## Importar dados

Use a opção **Importar CSV** e selecione `dados-exemplo.csv` ou um arquivo de planilha próprio. Prefira CSV separado por ponto e vírgula, com cabeçalho. O volume e o pH são necessários; a coluna Série é opcional. Os dados decimais podem usar vírgula ou ponto.

## Precisão e interpretação

A ferramenta aceita valores com casas decimais e mostra rótulos com a precisão escolhida. Intervalos manuais de eixo inferiores a 0,001 são rejeitados; se um intervalo gerar mais de 120 marcações, a escala é espaçada automaticamente e a interface informa a alteração.

O gráfico pH × volume conecta somente os pontos inseridos. `ΔpH/ΔV` é calculado como `(pH atual − pH anterior) / (volume atual − volume anterior)` para leituras consecutivas da mesma série. Não são estimados pontos ausentes.

## Limites desta versão

Este editor não simula a titulação, não adiciona gotas e não calcula equivalência, pKa ou distribuição de espécies. Ele visualiza os dados fornecidos pelo usuário e não substitui a interpretação experimental nem valida a exatidão das medições.

## Arquivos

- `index.html` — aplicação completa, com CSS e JavaScript incorporados.
- `dados-exemplo.csv` — conjunto pequeno de dados para testar a importação.

## Responsividade e apresentação

A interface incorpora os princípios mobile usados no SIAB: controles com alvos de toque de pelo menos 44 px, espaçamento compacto, tipografia ajustada para telas pequenas, margem segura no topo para dispositivos móveis, foco visível e respeito à preferência por movimento reduzido.

- Em telas estreitas, a tabela muda para cartões com campos rotulados; isso evita que a página inteira dependa de rolagem horizontal.
- Os controles de ação se organizam em duas colunas, e o painel de personalização começa recolhido para manter a área de trabalho leve.
- O gráfico SVG adapta sua dimensão à largura do painel e é redesenhado quando a janela muda de tamanho.
- Os campos de entrada em dispositivos móveis usam fonte de 16 px para evitar zoom automático em navegadores móveis.

A atualização foi verificada com teste de DOM simulado para uma largura de 330 px, renderização dos dois gráficos, título personalizado e escala com passos de 0,001. A verificação não substitui um teste visual em aparelhos e navegadores reais.

