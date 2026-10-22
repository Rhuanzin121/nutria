# Nutria — Planejador de dietas

Veja [as alterações mais recentes](ATUALIZACOES.md): horários, medidas caseiras, busca melhorada, distribuição dos macros e fibras visíveis.

Aplicativo React + TypeScript criado do zero para montar dietas permanentes. Não contém diário, calendário alimentar ou histórico de consumo.

## Executar localmente

Requer Node.js 22.12+ (validado com **24.13.0**) e npm. Na pasta deste arquivo:

```powershell
npm ci
npm run dev
```

Abra o endereço impresso pelo Vite, normalmente `http://127.0.0.1:5173`. Não abra `index.html` diretamente pelo explorador de arquivos.

```powershell
npm test
npm run build
npm run preview
```

`build` executa TypeScript e gera `dist/`. `preview` serve o build. O projeto inclui `package-lock.json` e versões fixas. As versões estáveis foram consultadas no registro npm antes da instalação. Tailwind 4 usa o plugin oficial do Vite; os diálogos usam Radix UI, com foco controlado, Escape e identificação acessível.

## O que está implementado

- Dietas independentes: criar, renomear, selecionar, duplicar e excluir com confirmação.
- Refeições: nomes próprios, reordenação, duplicação, exclusão e subtotais derivados dos itens.
- Alimentos: busca por termos, sinônimos, categoria, marca e preparo; substituição, quantidade e exclusão.
- **597 alimentos TACO e 363 USDA reais**, consultáveis sem credenciais nem chamadas externas durante o uso.
- Cadastros pessoais com referência em g ou ml, marca, preparo, fonte, observações e nutrientes opcionais. Dados por porção são normalizados usando seu peso/volume documentado.
- Receitas com ingredientes, rendimento em porções e peso final opcional. Totais, valores por porção e por 100 g; inclusão na dieta via busca de alimentos.
- Metas manuais de energia, proteínas, carboidratos, gorduras, fibras e sódio. Valor calculado, meta, diferença e percentual. Nenhuma meta é prescrita.
- Salvamento automático local, exportação/importação de backup validado e sincronização opcional com Supabase Auth/PostgreSQL.
- Interface em português, layout adaptável, estados vazios, validação de entradas e erros de armazenamento/conflito.

Para adicionar uma receita à refeição, salve a receita e pesquise seu nome em **Adicionar alimento**. Sem peso final, a quantidade é em **porções**; com peso final, em **gramas**. Alterar uma receita depois não muda os itens já adicionados: substitua o item para adotar a nova composição.

## Cálculos e unidades

O motor está em `src/model.ts`, independente do React. `per100` é o campo de composição da **referência indicada em `referenceAmount` e `unit`**. Normalmente a referência é 100 g ou 100 ml; receitas sem peso final usam referência de 1 porção. O nome histórico do campo não altera esse contrato.

```
nutriente do item = nutriente da referência × quantidade / referenceAmount
```

O campo interno `grams` representa a quantidade na unidade do alimento (`g`, `ml` ou `porção`). Não existe conversão implícita de ml para g. O cadastro manual exige o peso/volume da porção quando os nutrientes são informados por porção. Sem esse dado, use uma receita por porções ou obtenha o peso/volume documentado; não assuma uma densidade.

Números usam precisão IEEE-754 com soma compensada; arredondamento acontece somente na apresentação. Energia é a informada pela fonte, nunca substituída por 4/4/9. O motor propaga `null`: se qualquer alimento tem um nutriente desconhecido, o total desse nutriente é desconhecido. Zero numérico continua sendo zero. Na interface, as fibras possuem também um subtotal dos valores conhecidos: quando incompleto, ele é identificado com “≥”, sem alterar o total desconhecido do motor. Na TACO, `Tr`, `NA` e vazio permanecem desconhecidos. As gorduras saturadas da TACO não foram importadas nesta versão; USDA e cadastros pessoais aceitam esse campo.

Receitas somam os ingredientes e dividem pelo rendimento real informado. Perdas/absorções de água são representadas pelo peso final; o aplicativo não estima perdas de nutrientes ou retenção de gordura durante o preparo.

## Fontes e importação autorizada

### TACO / NEPA-UNICAMP

Fonte: [TACO, 4ª edição revisada e ampliada, 2011](https://nepa.unicamp.br/wp-content/uploads/sites/27/2023/10/taco_4_edicao_ampliada_e_revisada.pdf). A obra permite reprodução com citação da fonte nas páginas ii/iii. Não foi inventada uma API TACO: a aplicação utiliza importação do PDF oficial. Os 597 registros incluem ID original, página impressa, referência de 100 g de parte comestível e link. Nomes e preparo são preservados; aliases não alteram os valores.

Original distribuído em `data-sources/taco-original.pdf`.

SHA-256: `2002aec5615b5b1395aaa8fa675635bbb7f712c33f278af5e332f1cac8f108c8`.

Para reproduzir a importação (Python 3.12+, PyMuPDF 2.0):

```powershell
python -m pip install pymupdf==2.0
python scripts/import-taco.py data-sources/taco-original.pdf src/taco.json
npm test
```

O importador usa coordenadas de colunas e IDs da edição conferida e rejeita outro hash de PDF, para evitar interpretar um layout diferente silenciosamente. Saturadas não são extraídas. Revise o importador e os testes antes de trocar de edição.

### USDA FoodData Central

Fonte: [Foundation Foods, abril de 2026](https://fdc.nal.usda.gov/download-datasets/), arquivo oficial `FoodData_Central_foundation_food_json_2026-04-30.zip`. A [documentação da API](https://fdc.nal.usda.gov/api-guide/) declara os dados como domínio público/CC0. Esta versão usa o download autorizado, sem precisar de API key ou endpoint servidor. A API exige chave privada; nenhuma chave USDA aparece no frontend e não há consulta simulada.

Original ZIP incluído em `data-sources/usda-foundation-2026-04.zip`. Extraia-o e rode:

```powershell
node scripts/import-usda.mjs caminho/do/arquivo-oficial.json src/usda.json
```

SHA-256 do JSON original: `27d1fe3fd89edfbe528ed915da5619320e1d004d4594603a1b19bdb1511590cc`.

O importador aceita especificamente `FoundationFoods`. Ignora entradas `null` do arquivo original e importa os 363 registros com dados. Mantém descrições e categorias em inglês, identificadas na procedência. Todos são por 100 g. Usa IDs de nutrientes 1003 (proteína), 1005 (carboidrato), 1004 (gordura), 1079 (fibra), 1093 (sódio) e 1258 (saturadas), conferindo unidades; energia prioriza 1008, depois 2048 (Atwater específico) e 2047 (Atwater geral), sem estimar macros por conta própria. O ID de energia escolhido aparece nas observações.

### TBCA

[Site oficial TBCA](https://www.tbca.net.br/), consultado em 21/10/2026. Não foi confirmada uma API pública documentada na documentação consultada. O site apresenta créditos e aviso de direitos; não foi feita extração em massa ou presumida autorização de redistribuição. **A base TBCA não está incluída.**

Mecanismo implementado: obtenha um arquivo autorizado, normalize para o contrato abaixo, mantenha seus identificadores/URLs e importe em **Meus alimentos → Importar catálogo autorizado**. Registros importados pelo usuário são identificados como tal, sem alegar uma conexão oficial. Não há resultados de pesquisa falsos quando o alimento está ausente.

### Contrato de catálogo JSON

O arquivo é um array de objetos compatíveis com `foodSchema` em `src/model.ts`; `src/taco.json` oferece exemplos **reais**, sem fixtures. Campos obrigatórios: `id`, `name`, `category`, `source`, `sourceUrl` (HTTP/HTTPS ou vazio), `page` (número ou null), `unit` (`g`, `ml`, `porção`), `referenceAmount` (positivo) e `per100`.

`per100` contém `kcal`, `protein`, `carbs`, `fat`, `fiber`, `sodium`, `saturated`: números não negativos ou `null`, nunca strings. Sódio usa mg; os outros macronutrientes usam g. Campos adicionais: `externalId`, `brand`, `preparation`, `aliases`, `updatedAt` conhecido, `notes`, `manual`. Arquivos de importação têm limite de 10 MB e 5.000 alimentos pessoais. A interface confirma o uso autorizado e gera IDs pessoais para evitar colisões.

## Supabase: configuração opcional para vários dispositivos

1. Crie um projeto Supabase próprio.
2. Execute, em ordem, `supabase/migrations/202610210001_initial.sql` e `supabase/migrations/202610210002_meal_time_measures.sql` no SQL Editor de um projeto novo, ou pelo fluxo de migrações da CLI Supabase. Se já aplicou a inicial, aplique somente a `002`.
3. Em Authentication, habilite e-mail/senha e configure Site URL e URLs de redirecionamento para seu ambiente. Conclua a confirmação de e-mail quando habilitada.
4. Copie `.env.example` para `.env.local` e preencha a URL e a **publishable key** do projeto. Reinicie `npm run dev`.

```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=SUA_CHAVE_PUBLICAVEL
```

A chave publicável é própria para uso no navegador com RLS. **Nunca use `service_role`, chave administrativa, senha do banco ou API key USDA em variáveis `VITE_*`.** Não há senha armazenada manualmente pela aplicação; a autenticação e as sessões são administradas pelo SDK Supabase.

Em **Minha conta**, entre/crie sua conta e escolha explicitamente **Abrir dietas da nuvem** ou **Enviar dietas deste navegador**. Enviar uma cópia sobre outra exige confirmação. O salvamento remoto passa a ser automático na conexão ativa. Ao reabrir a aplicação, a sessão de login pode permanecer, mas a escolha da cópia deve ser refeita: o aplicativo não substitui silenciosamente dados locais.

Revisões usam compare-and-swap. Um conflito remoto ou falha de rede pausa a sincronização, exibe erro e preserva o local; não há fusão automática que possa perder alterações. Exporte a cópia local antes de decidir qual versão recuperar. O mesmo vale para uso em vários dispositivos: conecte explicitamente a cópia correta.

### Esquema e segurança

- `diet_workspaces` é o envelope transacional da sincronização, com `revision`, limite de tamanho e RLS por `auth.uid()`.
- Um trigger protegido projeta atomicamente o envelope para `diets`, `diet_goals`, `meals`, `meal_items`, `private_foods`, `recipes`, `recipe_ingredients`.
- Chaves compostas com `user_id` e FKs impedem associações entre proprietários; índices cobrem refeições e ingredientes. Quantidades, nomes, unidades, rendimentos e referências possuem restrições.
- Todas as tabelas privadas têm RLS. Projeções são somente leitura para o cliente, evitando divergência entre JSON e tabelas relacionais; o trigger é o único escritor.
- `nutrition_sources` e `public_foods` são separados e permitem leitura pública. O catálogo usado na busca é o snapshot incluído no bundle; preencher a tabela `public_foods` no servidor é opcional e exige administração confiável.
- Itens de refeições e ingredientes armazenam cópias completas dos alimentos utilizados. Não há FK viva ao catálogo que altere composições de dietas já salvas.
- Excluir workspace remove suas projeções; excluir o usuário no Supabase remove seus dados por cascata.

## Persistência local e backups

O modo local usa `localStorage` (`nutria.diets.v1`) e não requer cadastro. O salvamento ocorre após 300 ms e também ao sair da página. Aguarde **Alterações salvas**. Quota excedida ou armazenamento bloqueado gera erro; exporte o JSON antes de fechar. Dados inválidos já existentes pausam a gravação para não sobrescrever a cópia recuperável. A importação de backup substitui o conjunto inteiro após confirmação e desconecta a sincronização anterior.

Dados locais pertencem ao **perfil do navegador**, não a uma conta. Sair da conta não apaga o local, e o aplicativo informa isso. Em computadores compartilhados, use perfis de navegador separados e não envie dados de uma conta para outra. RLS protege os dados remotos por usuário; não transforma o armazenamento local compartilhado em um cofre de contas.

Para manter a cópia local, utilize sempre a mesma origem (host e porta). Limpar dados do navegador ou usar modo privado pode apagar a cópia local. Exporte backups antes de migrar de origem ou dispositivo.

## Testes e limites da verificação

`npm test` executa Vitest, incluindo cálculos, snapshots, unidades, desconhecidos, metas, busca real, validação, serialização e PostgreSQL embarcado via PGlite. Os testes de banco executam a migração real e verificam RLS com dois usuários artificiais, bloqueio de escrita nas projeções, revisão concorrente e exclusão em cascata. `auth.uid()` é uma função de teste que lê uma claim; o serviço Supabase Auth não é emulado.

Credenciais remotas não foram fornecidas: o fluxo de e-mail/login e a comunicação com uma instância Supabase real **não foram validados de ponta a ponta**. O esquema e as políticas foram executados em PostgreSQL embarcado. Revise as configurações de autenticação e confirme o fluxo em seu projeto antes de depender da nuvem.

Na UI local foram conferidos busca de alimento real, adição de 160 g de arroz, atualização dos totais, recuperação depois de recarregar e cálculo de receita com rendimento. Layout adaptável foi inspecionado no navegador disponível; não houve auditoria completa em dispositivos físicos ou leitores de tela.

## Organização

```
src/App.tsx                  composição da página e ações do planejador
src/components/              refeições, resumo, busca, cadastro, biblioteca, receitas, diálogos
src/model.ts                 tipos, validação Zod e motor nutricional
src/foods.ts                 provedores locais e busca normalizada
src/storage.ts               armazenamento e backups
src/cloud.ts                 serviço Supabase e controle de revisão
src/taco.json, usda.json      catálogo real rastreável
src/*.test.ts                regras e testes de banco
scripts/                     importadores de fontes autorizadas
data-sources/                originais públicos para auditoria/reimportação
supabase/migrations/         esquema, restrições, triggers e RLS
```

O build pode emitir aviso de tamanho para o chunk do catálogo nutricional: ele contém os registros reais para consulta offline de rede após carregar a página. O payload do catálogo é fortemente compressível; a divisão mantém dados, Supabase e bibliotecas separados. Não há service worker: abrir pela primeira vez ainda exige o servidor local ou hospedagem acessível.

## Substituições e exportação
Use **Adicionar substituição** em cada refeição e escolha a opção calculada no seletor. O total inclui apenas a opção selecionada. Informe o peso em kg no resumo para ver macros em g/kg. **Exportar PDF** e **Baixar dieta (JSON)** usam o nome atual da dieta; o backup completo possui sufixo `backup`. O PDF é gerado localmente, sem serviço externo. Consulte `ROTULOS.md` para os suplementos e suas porções.
