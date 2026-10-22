# Migrações do banco

Em um Supabase novo, aplique primeiro `202610210001_initial.sql` e depois `202610210002_meal_time_measures.sql`.

Em uma instância que já recebeu a primeira migração, aplique somente a segunda. Não coloque chaves administrativas ou senhas do banco neste repositório.

## Atualização 003
Aplique também `202610220003_meal_alternatives_weight.sql` após 001 e 002 para projetar peso corporal e alternativas das refeições. O workspace JSON continua sendo a fonte canônica; as opções não selecionadas são conservadas no JSON de alternativas.
