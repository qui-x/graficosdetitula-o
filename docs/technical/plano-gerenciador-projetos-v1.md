# Plano de implementação — gerenciador de projetos v1

**Base de revisão:** `main` em `25a55aa14987473931223bdd643ca867bc964e77`
**Branch de trabalho:** `feat/gerenciador-projetos-ciclo-seguro`
**Escopo:** persistência local de múltiplas investigações, abertura e recuperação de projetos e intercâmbio JSON versionado.

## Objetivo

Manter investigações independentes no mesmo navegador. A aplicação abre no gerenciador; a pessoa escolhe uma investigação ou cria uma nova. Cada projeto guarda dados, séries, configurações e a última etapa de trabalho.

A persistência principal usa IndexedDB. Preferências globais de acessibilidade continuam no armazenamento global do navegador e não são sobrescritas automaticamente ao importar ou abrir um projeto.

## Lista de atividades e situação

- [x] **Repositório IndexedDB:** operações tipadas de listar, ler, salvar e excluir; transações aguardam a conclusão do pedido e da transação. Há alternativa em localStorage quando IndexedDB não está disponível.
- [x] **Migração do rascunho legado:** converter `graficos_investigacao_draft_v1` em um primeiro projeto sem apagar o rascunho original; preservar medições, identidades literais de séries, cores, visibilidade e ajustes.
- [x] **Gerenciador inicial:** abrir a aplicação no gerenciador; listar projetos por atualização, mostrar leituras/séries e oferecer criar, abrir, renomear, duplicar, exportar e excluir com confirmação.
- [x] **Estado por projeto:** restaurar dados, catálogo, configurações, etapa e estado dos painéis; manter histórico de desfazer/refazer restrito à sessão e ao projeto ativo.
- [x] **Salvamento e recuperação:** salvamento com debounce, indicador de estado, cópia auxiliar do último documento e bloqueio de troca quando o salvamento solicitado falha.
- [x] **JSON completo e versionado:** exportar o documento do projeto e importar com validação de estrutura e versão; conflitos de nome/ID importam como cópia, sem sobrescrever silenciosamente.
- [x] **Compatibilidade com CSV e ajustes:** CSV permanece como intercâmbio tabular das medições; o JSON de ajustes do gráfico continua distinto do JSON completo do projeto.
- [x] **Modo offline e resiliência básica:** repositório local, aviso de armazenamento alternativo e mensagens claras para falhas de persistência.
- [~] **Testes automatizados:** há testes para codec JSON, contrato, IDs, nomes literais, nomes de cópias, catálogo vazio e CRUD do fallback local. Ainda faltam testes de integração reais do IndexedDB, migração e interações de interface.
- [~] **Tratar responsividade e organização das informações:** gerenciador e cabeçalho foram ajustados para telas pequenas; a revisão das etapas Dados, Gráfico e Exportar continua em andamento.
- [~] **Verificação de interface:** TypeScript, testes e build estão na CI. Ainda é necessária validação visual em navegador real nos tamanhos 320, 360, 390, 768, 1024 e 1440 px, além de zoom, teclado, leitor de tela e PWA instalado.

## Critérios de aceitação

1. Vários projetos coexistem no mesmo navegador e editar um não altera os demais.
2. A aplicação abre no gerenciador; nenhum projeto é escolhido silenciosamente quando há vários.
3. Criar e duplicar geram documentos independentes; excluir exige confirmação.
4. CSV exporta as medições; JSON completo inclui dados, séries, configurações, preferências exportáveis e snapshot quando existir.
5. Importação inválida não altera o projeto ativo nem os projetos armazenados.
6. Nomes de série permanecem literais e sensíveis a caixa e espaços.
7. A troca de projeto não prossegue quando o salvamento solicitado falha.
8. Catálogo intencionalmente vazio continua vazio após salvar e reabrir o projeto.
9. A responsividade e a organização das informações são verificadas explicitamente, e não inferidas apenas por um build aprovado.
10. A branch de trabalho não publica o site; publicação só ocorre após integração deliberada à branch principal.

## Pendências prioritárias

1. Acrescentar teste de integração do IndexedDB com implementação simulada compatível com o padrão.
2. Testar migração do rascunho legado com IDs repetidos, dados incompletos, JSON corrompido e armazenamento indisponível.
3. Validar no navegador as ações do gerenciador, incluindo falha de quota/transação, exclusão do projeto ativo e exportação imediatamente após uma edição.
4. Concluir a revisão de organização da informação nas três etapas do editor e validar larguras pequenas e aumento de texto.
5. Rever a documentação técnica do motor matemático para distinguir o repositório de projetos já implementado da integração futura do motor de titulação.

## Fora do escopo desta etapa

- Sincronização em nuvem, login ou colaboração multiusuário.
- Compartilhamento entre dispositivos sem exportar/importar arquivo.
- Integração visual completa do motor matemático v0.7, propagação de incerteza ou geração de curvas baseada no snapshot científico.
- Publicação direta ou merge em `main` sem revisão.
