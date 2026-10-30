# Gráficos de Titulação — base técnica v0.7

Esta entrega adiciona uma base isolada para o motor matemático do editor. A implementação do motor permanece separada da interface e ainda não substitui nem altera os fluxos visuais atualmente publicados.

## Conteúdo

- `app/src/titration-contract.ts`: entidades TypeScript para projetos, medições, incertezas, configurações e snapshots.
- `app/src/titration-engine.ts`: validação, ordenação, volumes repetidos, Catmull–Rom centrípeta com fallback, escalas sem padding decorativo, barras e propagação de incerteza, derivadas e snapshots.
- `tests/titration-engine.test.ts`: 30 testes unitários para as regras científicas e de geração.
- `docs/technical/modelo-dados-motor-grafico-v0.7.md`: decisões técnicas, políticas matemáticas e limitações.
- `docs/schemas/graficos-titulacao-project-v1.schema.json`: JSON Schema versionado para projetos.
- `docs/examples/project-example-v1.json`: exemplo de projeto completo.
- `docs/technical/plano-testes-motor-titulacao-v0.7.md`: plano de verificação da futura integração.

## Regras científicas desta base

1. Eixos usam os extremos medidos sem margem decorativa. Quando as barras de incerteza estão visíveis, os extremos das incertezas entram no domínio, sem padding adicional. O eixo não é limitado pela faixa de aceitação de pH.
2. `maximum-tolerance` é tratado por intervalos conservadores. `standard-uncertainty` só é propagada com a hipótese explícita de independência de primeira ordem. Tipos mistos ou dados insuficientes geram aviso, não uma incerteza combinada.
3. Catmull–Rom usa parametrização centrípeta (`alpha = 0.5`), 64 amostras por segmento e verificação de excursão local em X e pH. Qualquer violação substitui a curva da série por segmentos retos.
4. Volumes repetidos são mantidos. No modo segmentos a geração solicita a escolha de conexão por série; na interpolação a série afetada recua para segmentos com aviso.
5. O snapshot preserva dados validados em ordem original, configurações científicas e versões dos algoritmos.

## Verificação

- TypeScript estrito, testes Vitest e build Vite: aprovados pela GitHub Actions.
- Execução mais recente da validação do motor nesta branch: [Validate titration engine](https://github.com/qui-x/graficosdetitula-o/actions/runs/40984964422).
- JSON Schema Draft 2020-12 e exemplo de projeto: validados localmente nesta etapa.

## Limitações e estado de integração

O motor ainda não está ligado à interface. IndexedDB, codec JSON de produção, interação gráfica, geração efetiva de PNG/PDF e integração do snapshot com o menu de exportação continuam fora do escopo desta base.

**Estado GitHub verificado em 29/10/2026:** a PR técnica #2 foi mesclada em `feat/editor-graficos-manual`; posteriormente, a PR #1 foi mesclada em `main`. A execução da workflow de build e publicação associada ao merge em `main` foi concluída com sucesso ([execução no GitHub Actions](https://github.com/qui-x/graficosdetitula-o/actions/runs/40984474654)). Isso confirma a presença do código e da documentação desta base em `main`, mas não significa que o motor esteja integrado à interface principal. O motor permanece como módulo separado e ainda não é importado pela aplicação principal.
