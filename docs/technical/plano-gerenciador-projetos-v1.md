# Plano de implementação — gerenciador de projetos v1

**Base:** `main` em `42508c941fd19ccebb22f4545ad2df007ab25aee`
**Escopo:** persistência local de múltiplas investigações, abertura e recuperação de projetos e intercâmbio JSON versionado.

## Objetivo

Substituir o rascunho único por uma coleção de projetos independentes. A aplicação deve abrir no gerenciador de projetos; a pessoa escolhe uma investigação existente ou cria uma nova. Ao entrar, o editor restaura os dados, as séries, as configurações e a última etapa daquele projeto.

A persistência principal será IndexedDB. Preferências globais de acessibilidade continuam no armazenamento global do navegador e não são sobrescritas automaticamente ao importar ou abrir um projeto.

## Lista de atividades

- [ ] **Repositório IndexedDB:** implementar operações tipadas de listar, ler, salvar e excluir projetos; tratar migração de versão, transações, falhas de quota e indisponibilidade do armazenamento.
- [ ] **Migração do rascunho legado:** converter `graficos_investigacao_draft_v1` em um primeiro projeto sem descartar o rascunho original; preservar medições, nomes literais de séries, cores, visibilidade e ajustes gráficos.
- [ ] **Gerenciador inicial:** abrir a aplicação no gerenciador; listar projetos por atualização, mostrar resumo de leituras/séries e oferecer criar, abrir, renomear, duplicar, exportar e excluir com confirmação.
- [ ] **Estado por projeto:** restaurar dados, catálogo de séries, configurações de gráfico e etapa aberta; manter histórico de desfazer/refazer restrito à sessão e ao projeto ativo.
- [ ] **Salvamento e recuperação:** salvar alterações com debounce, indicar salvamento/erro, salvar ao trocar ou fechar o projeto quando possível e permitir recuperar o último estado persistido após recarregar.
- [ ] **JSON completo e versionado:** exportar o documento segundo o contrato e o JSON Schema; importar com validação estrutural e sem sobrescrever silenciosamente um projeto existente; avisar sobre versões futuras ou incompatíveis.
- [ ] **Compatibilidade com CSV e ajustes:** manter CSV como intercâmbio tabular de medições e conservar o JSON de ajustes antigo apenas como formato de configurações, distinto do JSON completo do projeto.
- [ ] **Modo offline e resiliência:** garantir operações locais sem rede depois do carregamento; oferecer mensagens claras quando IndexedDB estiver indisponível e preservar meios de exportar os dados.
- [ ] **Testes automatizados:** cobrir CRUD, concorrência/transações, migração, validação JSON, IDs, nomes literais, importação duplicada, restauração de preferências e salvamento.
- [ ] **Tratar responsividade e organização das informações:** revisar o gerenciador e as etapas Dados, Gráfico e Exportar em desktop, tablet e celular; reorganizar hierarquia, agrupamento, densidade textual, ordem dos controles, estados vazios e ações principais/secundárias; preservar a tabela com rolagem horizontal quando necessário, alvos de toque, navegação por teclado, leitor de tela, temas e alto contraste.
- [ ] **Verificação de interface:** validar larguras de 320, 360, 390, 768, 1024 e 1440 px, zoom/aumento de texto, teclado, impressão e funcionamento após instalação PWA; registrar limites de testes que não possam ser automatizados na CI.

## Critérios de aceitação

1. É possível manter pelo menos vários projetos no mesmo navegador, sem que editar um altere os demais.
2. A aplicação abre no gerenciador; nenhum projeto é escolhido silenciosamente quando já há vários.
3. Criar um projeto produz um documento válido e independente; duplicar gera outro projeto sem modificar o original.
4. Excluir exige confirmação e afeta somente o projeto selecionado.
5. CSV exporta as medições; JSON de projeto inclui medições, catálogo, configurações, preferências exportáveis e snapshot quando existir.
6. Importação inválida não altera o projeto ativo nem os projetos armazenados.
7. Nomes de série permanecem literais e sensíveis a caixa/espaços.
8. O salvamento indica sucesso ou falha; não declara persistência concluída antes da transação terminar.
9. A responsividade e a organização das informações são verificadas como atividade explícita, não inferidas apenas por um build aprovado.
10. O build/testes passam sem disparar publicação a partir da branch de trabalho.

## Fora do escopo desta etapa

- Sincronização em nuvem, login ou colaboração multiusuário.
- Compartilhamento entre dispositivos sem exportar/importar arquivo.
- Integração visual completa do motor matemático v0.7, propagação de incerteza ou nova geração de curvas.
- Publicação direta ou merge em `main` sem revisão.

## Contratos existentes a respeitar

- `app/src/titration-contract.ts`
- `docs/schemas/graficos-titulacao-project-v1.schema.json`
- `docs/examples/project-example-v1.json`
- `docs/technical/modelo-dados-motor-grafico-v0.7.md`

Esses contratos já definem UUID estável por medição, identidade literal da série, revisões de dados e ciência, snapshot de geração e preferências por projeto. A implementação de persistência e codec deve cumprir essas regras ou atualizar, de forma explícita e testada, o contrato e o schema.
