# Importadores nutricionais

`import-taco.py` importa o PDF oficial da edição validada; `import-usda.mjs` normaliza o JSON oficial FoundationFoods.

Os comandos, arquivos de origem, hashes e requisitos estão no README principal. Depois de reimportar, execute os testes antes de registrar uma nova versão.

`import-ibge.py arquivo-oficial.pdf ../src/ibge.json`: extração das cinco colunas da Tabela 1 do IBGE/POF 2011, usando pypdf/pdfplumber; preserva ausências, código, preparo e página. Consulte o README principal para a origem e o SHA256.
