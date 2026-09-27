# Guia de arranque: pôr a app Mota a funcionar

Tudo o que tens de fazer, por ordem, para a app ficar operacional no iPhone e no PC.
Tempo estimado: **30 a 45 minutos**. Tudo o que é preciso é gratuito.

## Resumo

- [x] **0.** Código no GitHub, no ramo `main` (já feito)
- [ ] **1.** Criar o projeto no Supabase
- [ ] **2.** Correr as 5 migrations SQL
- [ ] **3.** Configurar a autenticação (URLs e templates de email)
- [ ] **4.** Copiar as chaves do Supabase
- [ ] **5.** *(Opcional)* Testar no computador
- [ ] **6.** Deploy na Vercel
- [ ] **7.** Apontar o Supabase para o domínio da Vercel
- [ ] **8.** Primeiro login em produção e fechar novos registos
- [ ] **9.** Instalar no iPhone
- [ ] **10.** Preencher os teus dados

Precisas de:
- a conta do GitHub (já tens);
- uma conta no [Supabase](https://supabase.com);
- uma conta na [Vercel](https://vercel.com). Entra com o GitHub, o que facilita o passo 6;
- *(só para o passo 5)* Node.js 20.9 ou mais recente no computador.

---

## 1. Criar o projeto no Supabase

1. Em [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
2. Preenche:
   - **Name**: `mota` (ou o que quiseres).
   - **Database password**: gera uma e guarda-a num gestor de passwords. A app não precisa dela, mas o Supabase pede-a para algumas operações.
   - **Region**: `West EU (Ireland)` ou `Central EU (Frankfurt)`, perto de Portugal.
3. **Create new project** e espera 1 a 2 minutos.

> **Importante sobre o email:** o serviço de email incluído no Supabase só envia para emails de **membros da equipa** do projeto e só alguns por hora. Usa em `ALLOWED_EMAIL` o **mesmo email da tua conta Supabase**. Se quiseres outro email, vê "O email não chega" em [Problemas comuns](#problemas-comuns).

## 2. Criar as tabelas (migrations)

No painel do projeto: **SQL Editor** → **New query**. Para **cada ficheiro**, por esta ordem:

1. Abre o ficheiro no GitHub (ou no teu computador) e copia **todo** o conteúdo.
2. Cola no SQL Editor e carrega em **Run**.
3. Confirma que aparece `Success` antes de passar ao seguinte.

| # | Ficheiro | O que faz |
|---|---|---|
| 1 | `supabase/migrations/20260927000001_schema.sql` | Tabelas, índices e triggers |
| 2 | `supabase/migrations/20260927000002_rls.sql` | Row Level Security (cada utilizador só vê os seus dados) |
| 3 | `supabase/migrations/20260927000003_balance_snapshots.sql` | Histórico automático de saldos |
| 4 | `supabase/migrations/20260927000004_new_user_seed.sql` | Dados iniciais (contas, equipamento, custos) no primeiro login |
| 5 | `supabase/migrations/20260927000005_storage.sql` | Bucket privado `photos` para as fotos |

> Corre cada ficheiro **uma só vez**. Um erro como `type "account_kind" already exists` quer dizer que esse ficheiro já tinha sido corrido.

**Verificação:** corre esta query numa nova query do SQL Editor:

```sql
select tablename, rowsecurity from pg_tables where schemaname = 'public' order by 1;
select id, public from storage.buckets where id = 'photos';
```

Deves ver 6 tabelas (`accounts`, `balance_snapshots`, `costs`, `gear_items`, `motorcycles`, `settings`), todas com `rowsecurity = true`, e o bucket `photos` com `public = false`.

## 3. Configurar a autenticação

### 3.1 URLs

**Authentication → URL Configuration**:

- **Site URL**: por agora `http://localhost:3000`. Muda no passo 7.
- **Redirect URLs** → **Add URL**: `http://localhost:3000/**`.

### 3.2 Templates de email (obrigatório para o iPhone)

No iPhone, o link do email abre no Safari, que tem uma sessão separada da app instalada. Por isso entra-se com o **código de 6 dígitos**, e o código tem de vir no email.

**Authentication → Emails → Templates.** Altera **dois** templates:

- **Magic Link**: usado nos logins normais.
- **Confirm signup**: usado no primeiro login, quando a conta é criada.

Em ambos, apaga o conteúdo e cola:

**Subject:**
```
O teu código para entrar na Mota
```

**Body:**
```html
<h2>Entrar na Mota</h2>
<p>O teu código:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
<p>No iPhone, escreve o código na app.</p>
<p>No computador também podes
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">entrar por este link</a>.</p>
```

Carrega em **Save** em cada um.

### 3.3 Tamanho do código

Em **Authentication → Sign In / Providers → Email**, confirma que:

- o provider **Email** está ativo (vem ativo por omissão);
- **Email OTP Length** é `6`. A app aceita 6 a 10 dígitos, mas 6 é mais rápido de escrever.

## 4. Copiar as chaves do Supabase

Em **Project Settings → API Keys** (ou no botão **Connect** no topo do projeto), copia:

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | O *Project URL*, tipo `https://abcdefgh.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | A **publishable key** (`sb_publishable_…`) ou, em projetos antigos, a **anon key** (`eyJ…`) |
| `ALLOWED_EMAIL` | O teu email (o único que pode entrar) |
| `NEXT_PUBLIC_SITE_URL` | *Opcional.* Não é preciso |

> **Nunca** uses a `service_role` / `secret` key nesta app. A publishable key pode ser pública: quem protege os dados é o Row Level Security.

## 5. *(Opcional)* Testar no computador

```bash
git pull
npm install
cp .env.example .env.local   # e preenche com os valores do passo 4
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000):

1. Escreve o teu email → **Enviar código**.
2. Escreve o código que chega por email, ou clica no link do email (no computador também funciona).
3. Deves ver o Início com a lista "Para a meta ficar certa", e em **Contas** a Trade Republic, a Revolut e a Trading 212.

**Verificação no Supabase:** em **Table Editor** → `accounts`, `gear_items` e `costs` já têm linhas.

## 6. Deploy na Vercel

1. Em [vercel.com/new](https://vercel.com/new) → **Import** do repositório `miguelaopt/mota-app`. Se não aparecer, dá acesso ao repositório na app da Vercel no GitHub.
2. O *Framework Preset* é detetado como **Next.js**. Não mexas nos comandos de build.
3. Abre **Environment Variables** e acrescenta, uma a uma:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `ALLOWED_EMAIL`
4. **Deploy**. Demora 1 a 2 minutos.
5. Anota o domínio de produção, tipo `https://mota-app-xxxx.vercel.app`. Está em **Settings → Domains**; podes mudá-lo para algo mais curto, como `mota-miguel.vercel.app`.

> Se mudares uma variável de ambiente depois do deploy, só tem efeito depois de **Redeploy** (Deployments → ⋯ → Redeploy).

## 7. Apontar o Supabase para o domínio da Vercel

No Supabase, em **Authentication → URL Configuration**:

- **Site URL**: `https://<o-teu-dominio>.vercel.app`
- **Redirect URLs**: acrescenta `https://<o-teu-dominio>.vercel.app/**` e mantém a de localhost.

Sem isto, o link do email continua a apontar para `localhost`.

## 8. Primeiro login em produção e fechar novos registos

1. Abre o domínio da Vercel no computador e entra com o código.
2. Depois de entrares, em **Authentication → Sign In / Providers**, desativa **Allow new users to sign up** e guarda.

   A app já só aceita o `ALLOWED_EMAIL`, mas a API do Supabase é pública. Sem este passo, alguém podia criar uma conta diretamente. Não veria os teus dados, por causa do RLS, mas é melhor fechar.

## 9. Instalar no iPhone

1. Abre o domínio da Vercel no **Safari**. Tem de ser o Safari, não o Chrome.
2. Toca em **Partilhar** (quadrado com a seta para cima) → **Adicionar ao ecrã principal** → **Adicionar**.
3. Fecha o Safari e abre a app **pelo ícone** novo (abre em ecrã inteiro).
4. Escreve o email → **Enviar código** → escreve o **código** do email. **Não toques no link.**
5. Pronto. A sessão renova-se sozinha; só voltas a pedir código se terminares sessão ou passares muito tempo sem abrir a app.

## 10. Preencher os teus dados

A lista **"Para a meta ficar certa"** no Início vai-se riscando à medida que preenches:

1. **Mota** (toca na imagem do topo do Início): modelo, preço, link do anúncio e foto.
2. **Contas**: toca em cada conta e põe o saldo atual.
   - O primeiro saldo de cada conta é o ponto de partida do ritmo de poupança; não conta como poupança.
   - Ajusta a margem de segurança da Trading 212 (vem a 80%) e a % que conta, se não quiseres usar o saldo todo.
   - Adiciona ou remove contas conforme precisares.
3. **Equipamento**: põe os preços, apaga o que não queres e acrescenta o que falta. Marca **Essencial** ou **Depois**.
4. **Custos**:
   - Custos da compra: transferência, 1.ª prestação do seguro (faz uma simulação), IUC (calcula no Portal das Finanças) e revisão.
   - Custos mensais: seguro, combustível, manutenção e estacionamento.
5. **Definições** (ícone no canto do Início): **meta mensal**. É usada na data prevista até teres 30 dias de histórico.

**Rotina:** atualiza os saldos em **Contas** uma vez por semana ou por mês. Cada atualização fica no **Histórico** e melhora a data prevista.

---

## Verificação final

- [ ] Entras na app instalada no iPhone com o código
- [ ] O Início mostra a foto da mota, a percentagem e o valor em falta
- [ ] Atualizar um saldo muda o total no Início e aparece no Histórico
- [ ] Marcar um item como comprado tira-o do "falta" e mostra-o como "já gasto"
- [ ] A foto da mota carrega depois de fechares e voltares a abrir a app
- [ ] No PC, o mesmo URL mostra os mesmos dados
- [ ] O modo escuro do iPhone muda as cores da app
- [ ] Em Supabase → Authentication, "Allow new users to sign up" está desligado

---

## Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| Página de erro com `Falta a variável de ambiente NEXT_PUBLIC_SUPABASE_URL` | Variáveis não definidas na Vercel (ou no `.env.local`) | Passo 6.3 e depois **Redeploy** |
| "Falta configurar ALLOWED_EMAIL no servidor." | `ALLOWED_EMAIL` não definido | Acrescenta na Vercel → Redeploy |
| "Este email não tem acesso a esta app." | O email escrito é diferente do `ALLOWED_EMAIL` | Corrige um dos dois (maiúsculas não importam) |
| O email não chega | Spam; ou o email não é membro da equipa do Supabase; ou limite de envios | Vê o spam. Usa o email da conta Supabase, ou configura um SMTP próprio (ex.: [Resend](https://resend.com), gratuito) em **Authentication → Emails → SMTP Settings** |
| "Pediste demasiados emails seguidos." | Limite de emails por hora do Supabase | Espera cerca de 1 hora (ou configura SMTP próprio) |
| O email não traz código, só um link | Templates não alterados | Passo 3.2 (os **dois** templates) |
| "Código inválido ou expirado." | Código antigo: cada pedido novo invalida o anterior; expira em 1 hora | Usa o código do email mais recente |
| "O link expirou ou já foi usado." | Link aberto duas vezes, ou demasiado tarde | Pede novo código. No iPhone usa sempre o código |
| O link do email abre `localhost` | Site URL ainda em localhost | Passo 7 |
| No iPhone entras pelo link mas a app continua a pedir login | O link abriu no Safari, que tem outra sessão | Na app instalada, usa o código |
| Entras, mas não há contas nem equipamento | O login foi feito antes de correr a migration 4 | No SQL Editor: `select public.seed_user_defaults(id) from auth.users;` |
| "Não foi possível guardar…" em tudo | Migrations incompletas, ou projeto Supabase pausado | Verificação do passo 2; no painel do Supabase vê se o projeto está pausado (ver abaixo) |
| Erro ao carregar a foto | Bucket `photos` não foi criado (migration 5) | Corre a migration 5. Se as policies derem erro de permissões, vê abaixo |
| O iPhone mostra uma versão antiga depois de um deploy | O service worker ainda tem a versão anterior | Fecha a app (desliza para cima no seletor de apps) e volta a abrir |

**Se a migration 5 der erro de permissões** (`must be owner of table objects`):

1. Em **Storage → New bucket**, cria um bucket com o nome `photos`, **sem** "Public bucket".
2. Em **Storage → Policies → photos → New policy → For full customization**, cria uma policy para cada operação (SELECT, INSERT, UPDATE e DELETE):
   - **Target roles**: `authenticated`
   - **Definição**:
     ```sql
     bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text
     ```

---

## Manutenção

- **Projetos gratuitos do Supabase são pausados ao fim de 7 dias sem atividade.** Se usares a app todas as semanas não acontece. Se acontecer, no painel do Supabase carrega em **Restore project** e espera uns minutos.
- **Backups:** o plano gratuito não inclui backups que possas descarregar. De vez em quando, exporta as tabelas no **Table Editor** (cada tabela → **Export → CSV**).
- **Atualizações da app:** cada push para `main` faz deploy automático na Vercel. No iPhone, a nova versão aparece quando fechas e reabres a app.
- **Trocar o ícone:** edita `scripts/icon.svg`, corre `node scripts/generate-icons.mjs` e faz push. No iPhone, remove e volta a adicionar a app ao ecrã principal para veres o ícone novo.
