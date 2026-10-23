# Alterações do planejador

- **Espaços nos títulos:** texto em edição separado do valor aparado pela validação. É possível escrever várias palavras, apagar e reescrever os nomes de dietas e refeições.
- **Horário por refeição:** campo opcional HH:mm, salvo automaticamente, mantido ao duplicar e exportar. Não há vínculo com datas nem lembretes.
- **Busca:** classificação por relevância, prioridade brasileira em empates, sinônimos, flexões de preparo, tolerância de uma edição para pequenos erros de digitação, filtro por fonte, sugestões e carregamento de mais resultados. Os preparos explícitos continuam distintos.
- **Fatias/unidades/medidas caseiras:** escolha “Outra medida…” no seletor de quantidade e informe quantos g ou ml correspondem a uma fatia, unidade, colher, xícara ou concha. A aplicação preserva esse fator no item, mostra a equivalência e recalcula o total. Sem esse dado não presume pesos. Alguns alimentos USDA incluem medidas da própria fonte; não são aplicadas a registros diferentes da TACO.
- **Percentuais de macros:** carboidratos, proteínas e gorduras aparecem em uma barra com percentuais da energia dos três macros (4/4/9), separados do percentual de cumprimento de metas. As calorias originais das fontes são preservadas. Dados incompletos ou energia zero não geram percentuais fictícios.
- **Fibras:** agora aparecem em cada alimento, subtotal e em um cartão próprio. Quando faltam valores, o cartão mostra “≥” com o subtotal conhecido, o número de itens incompletos e uma lista de seus nomes. O total matemático completo permanece desconhecido; não há conversão de NA/traços em zero.
- **Vegetais variados:** novo item de composição calculada, em partes iguais de brócolis, cenoura e abobrinha italiana cozidos, sem óleo adicionado. Referências: TACO IDs 100, 109 e 70. Não é apresentado como um registro oficial genérico. Para outra composição, crie sua própria receita.

## Atualizar

As dietas e backups existentes continuam compatíveis. Recarregue a aplicação para usar a versão nova. O horário antigo fica vazio; as quantidades permanecem na unidade anterior até você escolher outra medida.

Se estiver usando Supabase e já tiver aplicado a migração inicial, aplique **somente** `supabase/migrations/202610210002_meal_time_measures.sql`. Em um banco novo, aplique `001` e depois `002`. A migração incremental adiciona horário e a referência da medida às projeções relacionais, preservando o envelope de dados e as políticas de acesso.

Após atualizar os arquivos/dependências:

```powershell
npm ci
npm test
npm run build
npm run dev
```

Os testes incluem regressão de digitação real de espaços, medidas caseiras na interface, conversão de porções, percentuais 40/40/20, fibras incompletas, mistura calculada, compatibilidade de backups e execução das duas migrações em PostgreSQL embarcado. Credenciais Supabase remotas continuam necessárias para validar sincronização em sua instância.

## 22/10/2026 - Substituições, PDF e peso corporal

- Cada refeição conserva uma principal e até 20 substituições editáveis. Só a opção selecionada é calculada; a comparação mostra diferenças sem presumir equivalência.
- Peso corporal opcional por dieta; proteínas, carboidratos e gorduras em g/kg.
- Exportar PDF baixa um PDF A4 real, paginado, com refeições, horários, quantidades, fontes, metas, g/kg, anotações e opções fora do total identificadas. Não envia dados para um servidor.
- Nome atual da dieta nos arquivos PDF e JSON; backup completo permanece identificado com sufixo backup. Arquivos já baixados não são renomeados.
- Pesos médios estimados para alimentos TACO comuns; medidas de fontes ou informadas pelo usuário têm prioridade. Os pesos médios não são dados oficiais da TACO.
- Wheys por produto/sabor/porção: Adaptogen Tasty doce de leite (34 g), Max Titanium 100% chocolate (30 g), Growth concentrado natural (30 g). Fontes comerciais identificadas para Adaptogen e Max; fonte oficial Growth. Fórmulas e rótulos podem variar.
- Backups anteriores continuam importáveis; migração SQL 003 adiciona peso e alternativas, mantendo RLS e revisão de workspace.

## Correção dos macros ausentes no resumo
- Quando um alimento não informa proteínas, carboidratos ou gorduras, o resumo e os subtotais mostram a soma conhecida com sinal ≥ e identificação parcial.
- A lista de dados ausentes identifica os alimentos de cada macro; ausência total aparece como Não informado.
- g/kg também identifica valores parciais. Percentuais e comparação de metas não são apresentados como completos quando faltam dados. O cálculo canônico continua preservando valores desconhecidos.
- 62 testes passaram, incluindo regressões de composição incompleta e ausência total.

## 23/10/2026 - Valores vazios como zero e percentuais visíveis
- Por solicitação expressa do usuário, os nutrientes ausentes dos alimentos são considerados 0 no catálogo, nos alimentos salvos, nas receitas e nos backups importados. Metas não definidas e peso opcional continuam vazios. Esta regra substitui as indicações de totais parciais das versões anteriores.
- Os percentuais de carboidratos, proteínas e gorduras ficam logo após os totais. Avisos de composição incompleta foram removidos.
- Incluído pão de hambúrguer tradicional Pullman sem gergelim, porção/unidade de 50 g, rótulo comercial Carrefour (pacote 200 g / 4 unidades).
- 65 testes: cálculo 40/40/20 com alimento sem dados, migração de backup e conversão por unidade do Pullman.

## 23/10/2026 — opções por alimento e catálogo brasileiro ampliado

- Cada alimento admite até 20 substituições salvas, com quantidade e medida próprias. Use “Adicionar substituição” no alimento e escolha em “Opção do alimento”. Só a opção selecionada entra no total; adicionar uma opção mantém a principal selecionada.
- Troca, remoção de opção, backup, nuvem, duplicação e PDF preservam as alternativas. Não há equivalência automática entre porções.
- Sódio e gordura saturada removidos do resumo, metas, cadastro manual e PDF; os dados de fontes e backups anteriores são mantidos.
- Incorporados 1.971 registros alimento/preparo do IBGE/POF 2008–2009, Tabela 1 (2011), com filtro próprio, código e página da fonte. TACO e USDA continuam disponíveis.
