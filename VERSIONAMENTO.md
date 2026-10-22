# Histórico do projeto no GitHub

O repositório guarda código, testes, migrações e referências nutricionais. As dietas pessoais ficam no navegador ou no seu Supabase; fazer um commit não cria backup delas. Use **Exportar backup** no aplicativo para guardar as dietas.

## Registrar uma nova versão do código

Na pasta do projeto, depois de uma alteração:

```powershell
git status
npm test
npm run build
git add .
git commit -m "Descreva o que mudou"
git push
```

O histórico de commits permite consultar as versões anteriores. Para marcar uma entrega específica, crie uma tag com um número novo e envie-a ao GitHub. Não reutilize uma tag já publicada.

`node_modules/`, `dist/`, arquivos de ambiente e chaves privadas ficam fora do Git. O `.env.example` contém somente nomes de variáveis e pode ser versionado. Antes de cada envio, confira `git diff --cached`.

Publicar o repositório não publica o aplicativo como um site. Não é necessário configurar hospedagem web para manter o histórico do código.
