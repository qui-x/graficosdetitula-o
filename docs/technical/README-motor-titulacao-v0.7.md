# Gráficos de Titulação — base técnica v0.7

Esta entrega adiciona uma base isolada para o motor matemático do editor. A implementação do motor permanece separada da interface.

## Conteúdo

- `app/src/titration-contract.ts`: entidades TypeScript para projetos, medições, incertezas, configurações e snapshots.
- `app/src/titration-engine.ts`: validação, ordenação, volumes repetidos, Catmull–Rom centrípeta com fallback, escalas sem padding decorativo, barras e propagação de incerteza, derivadas e snapshots.
- `tests/titration-engine.test.ts`: testes unitários para as regras científicas e de geração.
- `docs/technical/modelo-dados-motor-grafico-v0.7.md`: decisões técnicas, políticas matemáticas e limitações.
- `docs/schemas/graficos-titulacao-project-v1.schema.json`: JSON Schema versionado para projetos.
- `docs/examples/project-example-v1.json`: exemplo de projeto completo.
- `docs/technical/plano-testes-motor-titulacao-v0.7.md`: plano de verificação da futura integração.

## Contrato científico

1. Eixos usam os extremos medidos sem margem decorativa. Quando as barras de incerteza estão visíveis, os extremos das incertezas entram no domínio, sem padding adicional. O eixo não é limitado pela faixa de aceitação de pH.
2. `maximum-tolerance` é tratado por intervalos conservadores. `standard-uncertainty` só é propagada com hipótese explícita de independência de primeira ordem. Tipos mistos ou dados insuficientes geram aviso, não uma incerteza combinada.
3. Catmull–Rom usa parametrização centrípeta (`alpha = 0.5`), 64 amostras por segmento e verificação de excursão local em X e pH. Qualquer violação substitui a curva da série por segmentos retos.
4. Volumes repetidos são mantidos. No modo segmentos a geração solicita a escolha de conexão por série; na interpolação a série afetada recua para segmentos com aviso.
5. O snapshot preserva dados validados em ordem original, configurações científicas e versões dos algoritmos.

## Verificação

- TypeScript estrito, testes Vitest e build: aprovados pela GitHub Actions.
- Execução CI: [Validate titration engine](https://github.com/qui-x/graficosdetitula-o/actions/runs/40984212577).

## Limitações e estado de publicação

O motor ainda não está ligado à interface. IndexedDB, codec JSON de produção, interação gráfica, geração efetiva de PNG/PDF e integração do snapshot com o menu de exportação continuam fora do escopo desta base.

**Estado GitHub verificado em 30/10/2026:** a PR técnica #2 foi mesclada na branch `feat/editor-graficos-manual`; posteriormente, a PR existente #1 foi mesclada em `main`. Isso ocorreu automaticamente após a sequência de verificações, não por uma operação de merge executada nesta atualização. A execução de Pages na `main` foi concluída com sucesso. Portanto, o código e a documentação desta base encontram-se agora em `main`, embora o motor não esteja integrado à interface principal.
