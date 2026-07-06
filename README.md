# Workspace Pessoal

App em Next.js para um workspace pessoal, com pagina publica em `/`, link admin secreto,
modulos de itens, tarefas, estudos e portfolio, acompanhamento por e-mail e notificacao
quando um novo item e adicionado.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS
- Supabase Postgres via `DATABASE_URL`
- Resend para envio de e-mail

## Configuracao

1. Instale dependencias:

```bash
npm install
```

2. Copie `.env.example` para `.env` e preencha:

```bash
DATABASE_URL="postgresql://..."
RESEND_API_KEY="re_..."
EMAIL_FROM="Workspace <workspace@seudominio.com>"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
WISHLIST_SLUG="sua-lista"
```

3. Rode a migracao:

```bash
npm run db:migrate
```

4. Opcionalmente gere dados de exemplo e use o slug `workspace-demo`:

```bash
npm run db:seed
```

5. Inicie o app:

```bash
npm run dev
```

## Fluxos principais

- `/` mostra o workspace principal configurado pelo slug em `WISHLIST_SLUG`.
- `/admin/[adminToken]` adiciona, edita, arquiva, restaura e exclui itens, alem de copiar o link publico.
- `/w/[slug]` continua funcionando como compatibilidade para links antigos.
- Visitantes informam e-mail para acompanhar; o token fica salvo no navegador e tambem e enviado por e-mail.
- Somente seguidores com token valido conseguem marcar um item como adquirido.
- Quem marcou um item como adquirido pode desfazer a marcacao.

## Deploy na Vercel

Configure as mesmas variaveis de ambiente na Vercel e publique o projeto. Defina
`NEXT_PUBLIC_APP_URL` com a URL final de producao e `WISHLIST_SLUG` com o slug do workspace que ja
existe no Supabase.
