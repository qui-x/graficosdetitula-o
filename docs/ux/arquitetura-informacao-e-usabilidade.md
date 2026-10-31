# Arquitetura de informação e validação de usabilidade

**Projeto:** Gráficos de investigação  
**Base de análise:** Card Sorting conduzido no editor, seguido da revisão da arquitetura de informação.

## 1. Leitura do Card Sorting

A atividade foi realizada com categorias previamente nomeadas. Portanto, o exercício é tratado como um *closed card sort*: ele mostra como os cartões foram associados às categorias disponíveis, mas não prova que essas categorias ou toda a hierarquia sejam as melhores possíveis.

O resultado registrado foi:

| Categoria escolhida | Cartões agrupados |
| --- | --- |
| Projetos | Importar CSV; adicionar leitura manual; corrigir medição na tabela |
| Dados | Guardar investigação completa em JSON; criar investigação nova; abrir investigação salva |
| Gráficos | Criar/renomear série; duplicar/excluir série; ocultar série |
| Resultados | Escolher pH × volume ou ΔpH/ΔV; modificar escalas e rótulos; exportar PDF |
| Outros | Nenhum cartão |

A distribuição sugere duas distinções importantes. Primeiro, “Projetos” foi usado para tarefas de entrada e correção de medições, enquanto o grupo “Dados” recebeu tarefas de ciclo de vida do projeto. Segundo, “Gráficos” reuniu tanto a gestão estrutural de séries quanto a visibilidade visual delas.

## 2. Arquitetura adotada

A arquitetura final separa o ciclo de vida da investigação do fluxo de trabalho dentro de uma investigação aberta.

```text
Projetos (gerenciador independente)
├── Criar investigação
├── Abrir investigação salva
├── Importar projeto JSON completo
├── Duplicar, renomear ou excluir projeto
└── Exportar projeto atual em JSON

Editor (quatro etapas)
├── 1. Dados
│   ├── Importar CSV
│   ├── Adicionar leituras manualmente
│   ├── Corrigir medições na tabela
│   └── Séries e amostras
│       ├── Criar / renomear
│       ├── Duplicar / excluir
│       └── Ajustar cores
├── 2. Análise
│   ├── Selecionar pH × volume
│   └── Selecionar ΔpH/ΔV
├── 3. Gráfico
│   ├── Visualizar a representação selecionada
│   ├── Exibição das séries (mostrar / ocultar)
│   └── Personalização de escalas, títulos e rótulos
└── 4. Exportar
    ├── Gráfico PNG / SVG / impressão-PDF
    ├── Leituras CSV (Brasil ou internacional)
    └── Ajustes visuais JSON
```

### Decisões e justificativas

- **Projetos permanece fora das três etapas.** Criar, abrir, importar, renomear, duplicar, excluir e exportar um projeto são operações sobre a investigação inteira, não uma etapa analítica.
- **Dados concentra entrada, tabela e estrutura de séries.** Uma série é uma entidade que organiza medições, recebe nome e cor e pode ser duplicada ou removida.
- **Análise concentra a escolha da representação.** pH × volume e ΔpH/ΔV são alternativas de leitura dos mesmos dados; a escolha não modifica as medições.
- **Gráfico concentra a visualização.** O gráfico ocupa a primeira área de conteúdo; a legenda, a visibilidade das séries e a personalização ficam em áreas auxiliares.
- **A visibilidade permanece separada do CRUD.** Ocultar uma série altera apenas a visualização; não apaga as leituras.
- **Exportar concentra produtos derivados.** CSV, PNG, SVG, PDF e ajustes de apresentação são saídas específicas. O JSON completo fica no gerenciador de Projetos para evitar confusão com o JSON de ajustes.
- **O fluxo principal tem quatro etapas.** Projetos continua como gerenciador global, fora da sequência de trabalho.

## 3. Regras de consistência dos rótulos

| Termo | Uso |
| --- | --- |
| Projeto / investigação | Conjunto completo de medições, séries, preferências e configurações. |
| Leitura / medição | Registro individual de volume e pH. |
| Série / amostra | Grupo lógico de leituras com nome e cor próprios. |
| Visível / oculta | Estado de exibição no gráfico; não muda os dados armazenados. |
| Ajustes do gráfico | Preferências visuais exportáveis separadamente. |
| Projeto completo JSON | Cópia portátil de toda a investigação. |

## 4. Roteiro de teste de usabilidade

O teste deve verificar se uma pessoa consegue localizar as ações sem receber instruções sobre onde clicar. Para cada tarefa, registrar conclusão sem ajuda, caminho percorrido, erros, tempo e confiança percebida.

| Tarefa | Caminho esperado | Critério de sucesso |
| --- | --- | --- |
| Criar uma investigação | Projetos → Criar projeto | Abre um projeto novo no editor. |
| Recuperar uma investigação completa | Projetos → Importar projeto JSON | O projeto aparece na biblioteca sem sobrescrever outro. |
| Importar medições | Dados → Importar CSV | As linhas importadas aparecem na tabela e nas séries correspondentes. |
| Corrigir uma medição | Dados → Tabela experimental | O registro é alterado sem perder os demais. |
| Duplicar uma série | Dados → Séries e amostras → Mais → Duplicar | Surge uma nova série independente com leituras copiadas. |
| Ocultar e reexibir uma série | Gráfico → Exibição das séries | A curva muda, mas as leituras continuam armazenadas. |
| Ajustar a apresentação | Gráfico → Personalizar gráficos | Título, rótulos e escalas refletem os valores definidos. |
| Gerar uma saída | Exportar → PNG/SVG/PDF ou CSV | O formato escolhido é produzido. |
| Fazer cópia integral | Projetos → Exportar projeto atual | O arquivo JSON permite recuperar a investigação completa. |

### O que observar

- A pessoa procura operações de projeto no botão **Projetos**, em vez de procurar a criação de uma investigação em Dados.
- A pessoa distingue criar/duplicar/excluir uma série de ocultá-la temporariamente.
- A pessoa entende que exportar ajustes não equivale a exportar o projeto completo.
- A pessoa consegue avançar entre Dados, Análise, Gráfico e Exportar pela navegação superior e pelos botões de continuidade.
- A pessoa diferencia a escolha da representação analítica da personalização do gráfico.
- A pessoa reconhece que o gráfico é a área visual dominante, enquanto os controles são auxiliares.
- Em tela estreita, a navegação, os menus, o gerenciador de projetos e os controles de série permanecem utilizáveis por toque e teclado.

## 5. Compatibilidade dos projetos

A inclusão da etapa Análise atualiza o contrato de projetos para schemaVersion 2. A importação de projetos no formato 1 migra o documento para o formato 2, preservando medições, configurações e a última etapa antiga (Dados, Gráfico ou Exportar). A preferência `lastStage` passa a aceitar também `analise`. Projetos antigos armazenados localmente são normalizados na leitura e salvos novamente no formato atual.

## 6. Limite da evidência

Este Card Sorting é uma observação exploratória da organização de uma pessoa com categorias pré-definidas. Ele orienta uma hipótese de arquitetura, não substitui testes com outras pessoas nem um Tree Testing independente. A próxima validação deve usar tarefas realistas e registrar se os rótulos e a hierarquia permitem encontrar cada ação sem orientação.
