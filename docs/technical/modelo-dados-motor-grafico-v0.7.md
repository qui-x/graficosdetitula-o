# Gráficos de Titulação — modelo de dados e motor gráfico v0.7

**Estado:** base técnica isolada para revisão. Não integra ainda a interface principal.

## 1. Decisões consolidadas

- `IndexedDB` guarda projetos e seus dados. `localStorage` guarda preferências globais da interface.
- O aplicativo abre sempre o gerenciador de projetos. Ao abrir um projeto, restaura a última etapa e a disposição registradas naquele projeto.
- O nome da série é sua identidade. A comparação é literal e sensível a maiúsculas/minúsculas; não ocorre normalização automática de espaços ou caixa. `Amostra A` e `amostra A` são séries distintas.
- Cada medição possui UUID estável, separado do nome da série e da posição da linha.
- A tabela conserva os registros na ordem original. O motor cria cópias derivadas para ordenar por volume crescente, com desempate pela ordem original.
- A faixa válida de pH é configurável por projeto e não define os limites visuais do eixo.
- A representação usa pontos, segmentos ou Catmull–Rom centrípeta.
- Volumes repetidos são preservados. No modo segmentos, a geração exige que o usuário escolha por série se o par de pontos de mesmo volume será conectado na ordem original ou permanecerá sem conexão. No modo Catmull–Rom, a interpolação fica desabilitada para a série afetada e o motor usa segmentos retos com aviso.
- Um par com `ΔV = 0` não participa do cálculo de `ΔpH/ΔV`.
- Cada geração preserva cópia numérica dos dados validados, configurações científicas, revisões de origem e avisos.
- Alterações nos dados ou nas configurações científicas tornam o snapshot desatualizado. Alterações puramente visuais não o invalidam.
- A v1 usa duas incertezas globais por projeto: volume (mL) e pH. `null` significa desconhecida, nunca zero.

## 2. Política final de domínio dos eixos

A regra sem barras de incerteza é usar exatamente o mínimo e o máximo medidos, sem margem visual decorativa. As marcações são calculadas automaticamente por intervalos legíveis da família 1–2–5.

Quando as barras de incerteza estiverem visíveis, o domínio do eixo passa a incluir a união dos valores centrais e dos extremos das barras. Não é uma margem estética: é necessário para não cortar a incerteza representada. Nenhuma margem adicional é adicionada. O eixo pH não é limitado pela faixa válida do projeto; a faixa válida só decide se o valor central medido é aceito.

Quando todos os valores de um eixo forem idênticos, `min = max` não constitui um domínio gráfico válido. Como exceção técnica, o motor cria um domínio mínimo simétrico baseado em um intervalo legível 1–2–5; no volume sem barras, o limite inferior não fica abaixo de zero. Esse caso é sinalizado internamente por `degenerateFallback` e deverá ser documentado na interface.

## 3. Modelo de incerteza

A v1 oferece dois campos independentes:

- volume: tolerância máxima absoluta ou incerteza-padrão, em mL;
- pH: tolerância máxima absoluta ou incerteza-padrão, em unidades de pH.

Ambos são uniformes para todas as medições do projeto na v1. O modelo deixa explícita a origem do valor: especificação do fabricante, calibração, estimativa do usuário ou outra.

### 3.1. Representação

- Tolerância máxima é apresentada como `± tolerância` e tratada como limite intervalar absoluto informado.
- Incerteza-padrão é apresentada como `±u` (um desvio-padrão estimado); não deve ser rotulada como intervalo de 95% nem como incerteza expandida.
- Se uma dimensão não tiver incerteza informada, sua barra não é desenhada e o resultado não afirma precisão inexistente.

### 3.2. Propagação para a derivada

Para dois pontos consecutivos com `ΔV > 0`, o valor central da derivada é calculado sempre a partir das medições observadas.

**Incertezas-padrão:** a v1 só calcula a incerteza-padrão combinada quando volume e pH têm ambos tipo `standard-uncertainty` e a hipótese explícita `independent-first-order` foi selecionada. Para incertezas iguais por projeto, a combinação dos dois pontos usa `u(ΔpH) = √2 u(pH)` e `u(ΔV) = √2 u(V)`. A aproximação de primeira ordem usa a lei de propagação de incerteza. Covariâncias não são modeladas na v1; efeitos correlacionados de calibração exigem evolução do modelo.

**Tolerâncias máximas:** para limites absolutos simétricos, a v1 soma conservadoramente as tolerâncias dos dois pontos no numerador e no denominador e avalia os quatro extremos da razão. Se o intervalo de `ΔV` incluir zero, o intervalo da razão não é finito/seguro e nenhuma incerteza finita é apresentada.

**Tipos mistos ou dados faltantes:** não se convertem silenciosamente tolerância máxima em desvio-padrão. Se os tipos de pH e volume forem mistos, ou se uma das dimensões estiver ausente, a derivada central continua disponível, mas a incerteza combinada não é calculada e um aviso é apresentado.

A lei de propagação do NIST inclui termos de covariância; por isso, a hipótese de independência não pode ser presumida sem declaração. Referência: [NIST TN 1297, Appendix A](https://www.nist.gov/pml/nist-technical-note-1297/nist-tn-1297-appendix-law-propagation-uncertainty).

## 4. Catmull–Rom e controle de oscilação

A escolha é Catmull–Rom centrípeta (`α = 0,5`) em coordenadas `(volume, pH)`. Essa parametrização reduz cúspides e autointerseções em comparação com a parametrização uniforme; não garante, por si só, que a curva não ultrapasse localmente os valores medidos. Referência de contexto matemático: [Wolfram MathWorld — Catmull–Rom Spline](https://mathworld.wolfram.com/Catmull-RomSpline.html).

Critério objetivo da v1:

1. exigir pelo menos três pontos e volumes estritamente crescentes para interpolar;
2. gerar 64 amostras por segmento;
3. em cada segmento delimitado por `(xᵢ,yᵢ)` e `(xᵢ₊₁,yᵢ₊₁)`, exigir que todas as amostras permaneçam entre `xᵢ` e `xᵢ₊₁` e que o pH permaneça entre `min(yᵢ,yᵢ₊₁)` e `max(yᵢ,yᵢ₊₁)`;
4. permitir apenas tolerância numérica `ε = 10⁻⁹ × max(1, |valor amostrado|, |extremos locais|)`;
5. se qualquer amostra exceder os limites, substituir a curva inteira daquela série por segmentos retos e registrar aviso.

Volumes repetidos desabilitam Catmull–Rom na série afetada. Séries com menos de três pontos usam segmentos retos e recebem aviso. A interpolação nunca extrapola além dos pontos e nunca cria medições na tabela nem alimenta o cálculo experimental de `ΔpH/ΔV`.

## 5. Revisões e snapshot

`revisions.data` aumenta quando uma medição é adicionada, removida, reordenada na tabela ou tem algum campo alterado. `revisions.scientific` aumenta quando faixa válida, incertezas, tipo de representação, política de volumes repetidos ou modo de comparação muda.

O snapshot armazena as medições validadas em ordem original, as configurações científicas efetivamente usadas, avisos e as revisões de origem. A renderização pode aplicar cores, visibilidade, grade, zoom e guias atuais sem invalidar a geração. A exportação de um snapshot antigo requer confirmação e deve identificá-lo como desatualizado. CSV sempre representa os dados atuais.

## 6. Limites desta entrega

`app/src/titration-engine.ts` continua sendo uma base matemática pura e não está conectado ao `main.ts`. O editor ainda não chama `generateTitration()`, não aplica as incertezas instrumentais do motor e não atualiza `latestGeneration` após gerar um gráfico.

O gerenciamento de projetos foi implementado em uma camada separada: IndexedDB guarda os documentos, localStorage é alternativa quando IndexedDB não está disponível, e o codec JSON versionado importa/exporta os dados e configurações do projeto. A interface atual também mantém CSV para intercâmbio tabular. Isso não significa que os cálculos do motor v0.7 tenham sido integrados.

A persistência mantém o campo `latestGeneration` caso um documento já o possua, mas a interface ainda não cria snapshots científicos a partir do motor. A integração entre os dados do editor, o contrato científico, as revisões e a geração continua pendente.

O contrato TypeScript e o JSON Schema descrevem o formato esperado. A validação cruzada (IDs únicos, `min < max`, política única por série, revisões e snapshot coerentes) é verificada pelo repositório de projetos para os campos implementados; a validação das regras matemáticas e sua ligação com o editor ainda exigem integração e testes adicionais.
