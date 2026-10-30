# Gráficos de Titulação — base técnica v0.7

Esta entrega fecha as decisões científicas pendentes e introduz uma base isolada para o motor matemático. Ela ainda não substitui nem modifica a interface atualmente publicada.

## Conteúdo

- `app/src/titration-contract.ts`: entidades TypeScript para projetos, medições, incertezas, configurações e snapshots.
- `app/src/titration-engine.ts`: validação, ordenação, volumes repetidos, Catmull–Rom centrípeta com fallback, escalas sem padding decorativo, barras e propagação de incerteza, derivadas e snapshots.
- `tests/titration-engine.test.ts`: 30 testes unitários para as regras científicas e de geração.
- `docs/technical/modelo-dados-motor-grafico-v0.7.md`: decisões técnicas, políticas matemáticas e limitações.
- `docs/schemas/graficos-titulacao-project-v1.schema.json`: JSON Schema versionado para projetos.
- `docs/examples/project-example-v1.json`: exemplo de projeto completo.

## Contrato científico fechado nesta etapa

1. Eixos usam os extremos medidos sem margem decorativa. Quando as barras de incerteza estão visíveis, os extremos das incertezas entram no domínio, sem padding adicional. O eixo não é limitado pela faixa de aceitação de pH.
2. `maximum-tolerance` é tratado por intervalos conservadores. `standard-uncertainty` só é propagada com a hipótese explícita de independência de primeira ordem. Tipos mistos ou dados insuficientes geram aviso e não uma incerteza combinada.
3. Catmull–Rom usa parametrização centrípeta (`alpha = 0.5`), 64 amostras por segmento e verificação de excursão local em X e pH. Qualquer violação substitui a curva da série por segmentos retos.
4. Volumes repetidos são mantidos. No modo segmentos a geração solicita a escolha de conexão por série; na interpolação a série afetada recua para segmentos com aviso.
5. Snapshot preserva dados validados em ordem original, as configurações científicas e as versões dos algoritmos.

## Verificação local

- TypeScript estrito: aprovado para o contrato, o motor e os testes.
- Testes: 30 casos executados por harness local compatível com as asserções usadas; a execução oficial com Vitest será confirmada pela GitHub Actions.
- JSON Schema Draft 2020-12: esquema e exemplo validados localmente.

## Limitações

O motor ainda não está ligado à interface. IndexedDB, codec JSON de produção, interação gráfica, geração efetiva de PNG/PDF e integração do snapshot com o menu de exportação continuam fora do escopo desta base. Nenhum deploy ou alteração em `main` faz parte desta etapa.
