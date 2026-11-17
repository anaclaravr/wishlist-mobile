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
WISHLIST_SLUG="sua-wishlist"
```

3. Rode a migracao:

```bash
npm run db:migrate
```

4. Opcionalmente gere dados de exemplo e use o slug `wishlist-demo`:

```bash
npm run db:seed
```

5. Inicie o app:

```bash
npm run dev
```

## Meu espaço (`/`)

A raiz `/` serve o app "Meu espaço" (`public/espaco.html`, via rewrite em `next.config.ts`):
wishlist pessoal, metas de leitura e compartilhamento da lista. É um HTML autocontido que conversa
com estas rotas:

- `POST /api/space/enter` entra com nome + PIN de 4 dígitos (cria o espaço se o nome for novo).
  O PIN é guardado com scrypt; 5 erros seguidos bloqueiam o nome por 15 minutos.
- `GET /api/space` / `PUT /api/space` leem e salvam o espaço da sessão (cookie httpOnly `space_session`).
- `POST /api/space/logout` encerra a sessão.
- `POST /api/space/link` lê uma página de produto (JSON-LD, meta tags Open Graph e preço) e devolve
  nome, preço, loja, variação, categoria e foto. Lojas que bloqueiam robôs (ex.: Amazon) caem no
  preenchimento pela URL, e o usuário confere os campos.

Os dados ficam nas tabelas `spaces` e `space_sessions`, criadas por `npm run db:migrate`.

## Fluxos principais

- `/w/[slug]` mostra a wishlist antiga (para a principal, use o slug de `WISHLIST_SLUG`).
- `/admin/[adminToken]` adiciona, edita, arquiva, restaura e exclui itens, alem de copiar o link publico.
- Visitantes informam e-mail para acompanhar; o token fica salvo no navegador e tambem e enviado por e-mail.
- Somente seguidores com token valido conseguem marcar um item como adquirido.
- Quem marcou um item como adquirido pode desfazer a marcacao.

## Deploy na Vercel

Configure as mesmas variaveis de ambiente na Vercel e publique o projeto. Defina
`NEXT_PUBLIC_APP_URL` com a URL final de producao e `WISHLIST_SLUG` com o slug da wishlist que ja
existe no Supabase.
