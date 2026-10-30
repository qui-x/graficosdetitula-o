# Plano de testes — motor de Gráficos de Titulação v0.7

## A. Entrada e validação

- [ ] Aceitar ponto e vírgula decimal e preservar o texto de entrada.
- [ ] Rejeitar números inválidos, infinitos, volumes negativos e pH fora da faixa configurada.
- [ ] Exigir limites de pH finitos com `min < max`.
- [ ] Bloquear linha parcialmente preenchida e projeto sem medições válidas.
- [ ] Exigir identificador estável e IDs não duplicados.
- [ ] Comparar nomes de série literalmente, com distinção de caixa; `A` e `a` são séries diferentes.

## B. Ordenação e volumes repetidos

- [ ] Manter a ordem original da tabela e produzir cópia de plotagem ordenada por volume.
- [ ] Desempatar volumes iguais por ordem original.
- [ ] No modo segmentos, solicitar decisão por série antes de gerar se houver volumes iguais.
- [ ] Testar conexão em ordem original e não conexão do par de mesmo volume.
- [ ] Não calcular derivada para `ΔV = 0`.
- [ ] No modo Catmull–Rom, desabilitar interpolação na série afetada por volume repetido.

## C. Catmull–Rom

- [ ] Verificar passagem pelos pontos de controle.
- [ ] Testar série monotônica com espaçamento uniforme e não uniforme.
- [ ] Testar curvas não monotônicas e dados com grandes saltos.
- [ ] Amostrar 64 posições por segmento e rejeitar amostras fora dos limites locais de X ou pH, com tolerância numérica definida.
- [ ] Confirmar fallback da série para segmentos quando qualquer amostra excede os limites locais.
- [ ] Confirmar que menos de três pontos usa segmentos retos com aviso.
- [ ] Confirmar ausência de extrapolação e ausência de pontos interpolados na tabela e em `ΔpH/ΔV`.

## D. Incerteza instrumental

- [ ] `null` significa desconhecida, nunca zero.
- [ ] Rejeitar valores negativos ou não finitos; aceitar zero somente quando informado explicitamente.
- [ ] Exibir barras de volume e pH conforme a incerteza disponível.
- [ ] Identificar `± tolerância` e `±u` sem confundir incerteza-padrão com intervalo de 95%.
- [ ] Para tolerância máxima, avaliar os extremos intervalares de `ΔpH/ΔV`.
- [ ] Para incerteza-padrão, exigir a hipótese explícita de independência de primeira ordem.
- [ ] Tipos mistos ou incerteza faltante não geram incerteza combinada; manter somente o valor central com aviso.
- [ ] Se intervalo de `ΔV` incluir zero, não apresentar intervalo finito para a derivada.
- [ ] Verificar que não se presumem covariâncias nulas sem hipótese explícita.

## E. Escalas e visualização

- [ ] Sem barras, domínio igual aos extremos centrais, sem padding decorativo.
- [ ] Com barras, domínio inclui os extremos das incertezas sem padding adicional.
- [ ] Eixo pH é independente da faixa de aceitação configurada.
- [ ] Em volumes próximos de zero, incerteza pode estender o eixo para valores negativos; a etiqueta deve esclarecer que são limites de incerteza, não volume adicionado negativo.
- [ ] Domínio degenerado (mínimo igual ao máximo) aciona fallback técnico documentado.
- [ ] Gráficos separados têm escalas próprias por série.
- [ ] Zoom e pan não alteram dados nem snapshot científico.

## F. Snapshot, projetos e exportação

- [ ] Snapshot preserva cópia numérica dos pontos válidos em ordem original e configurações científicas da geração.
- [ ] Alteração de dados ou configurações científicas marca o snapshot como desatualizado.
- [ ] Alteração puramente visual não marca como desatualizado.
- [ ] Exportação de gráfico antigo exige confirmação; CSV usa os dados atuais.
- [ ] JSON é versionado e preserva dados, configurações, preferências e última geração.
- [ ] IndexedDB mantém múltiplos projetos; localStorage mantém preferências gerais.

## Estado

Os testes unitários estão escritos para execução com Vitest na CI. A verificação TypeScript estrita e o JSON Schema foram verificados localmente. O restante deve ser confirmado pela CI e, após integração visual, por testes manuais em navegadores reais.
