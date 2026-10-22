# GitHub Pages

Endereço da aplicação: https://rhuanzin121.github.io/nutria/

O workflow `.github/workflows/pages.yml` executa os testes e o build antes de publicar cada alteração na branch `main`. Também pode ser executado manualmente em **Actions → Publicar Nutria no GitHub Pages → Run workflow**.

Em **Settings → Pages**, a origem deve ser **GitHub Actions**. O repositório precisa estar público para utilizar o Pages com GitHub Free.

O build usa `GITHUB_PAGES=true` para configurar os arquivos sob `/nutria/`. O desenvolvimento local continua em `/`, preservando a origem local anterior.

O deploy envia somente `dist/`; não precisa de API key pessoal nem senha do banco. As permissões temporárias do workflow permitem publicar apenas no GitHub Pages deste repositório.

Esta publicação usa o armazenamento do navegador. As dietas não aparecem no código nem são compartilhadas com outros visitantes. Cada navegador/dispositivo mantém sua própria cópia. Para levar suas dietas locais ao site, exporte o backup na aplicação local e importe no site publicado. A origem pública é diferente da origem local, portanto os dados não migram automaticamente.

Sincronização entre dispositivos depende da configuração separada de Supabase descrita no README. Não insira chaves administrativas em arquivos do repositório nem em variáveis `VITE_*`.
