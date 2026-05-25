# Wishlist Mobile-First Compartilhavel

App em Next.js para criar uma wishlist mobile-first com link publico, link admin secreto,
itens com preco/categoria/link de compra, acompanhamento por e-mail e notificacao quando um
novo item e adicionado.

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
EMAIL_FROM="Wishlist <wishlist@seudominio.com>"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

3. Rode a migracao:

```bash
npm run db:migrate
```

4. Opcionalmente crie uma wishlist de exemplo:

```bash
npm run db:seed
```

5. Inicie o app:

```bash
npm run dev
```

## Fluxos principais

- `/` cria uma nova wishlist e abre o painel admin.
- `/admin/[adminToken]` adiciona itens e copia o link publico.
- `/w/[slug]` mostra a wishlist publica.
- Visitantes informam e-mail para acompanhar; o token fica salvo no navegador e tambem e enviado por e-mail.
- Somente seguidores com token valido conseguem marcar um item como adquirido.

## Deploy na Vercel

Configure as mesmas variaveis de ambiente na Vercel, rode `npm run db:migrate` apontando para o
Supabase Postgres e publique o projeto. Defina `NEXT_PUBLIC_APP_URL` com a URL final de producao
para os links enviados por e-mail.
