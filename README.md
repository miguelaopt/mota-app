# Mota 🏍️

PWA pessoal para acompanhar a poupança para comprar uma mota. Funciona no iPhone (instalada no ecrã principal) e no browser do computador.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Supabase (auth por email + Postgres com RLS + Storage) · Serwist (service worker) · Vitest · Vercel.

## Ecrãs

| Ecrã | O que faz |
|---|---|
| **Início** | Foto da mota, progresso total/meta com %, valor em falta, data prevista, mínimo para andar vs setup completo |
| **Contas** | Saldos (atualização rápida), disponível vs investido, % que conta e margem de segurança |
| **Equipamento** | Itens por comprar/comprados, categorias, prioridades, totais |
| **Custos** | Custos da compra (contam para a meta) e custos mensais (informativos) |
| **Histórico** | Todas as atualizações de saldo, por dia |
| Mota / Definições | Acessíveis a partir do Início (foto e preço da mota; meta mensal, terminar sessão) |

## Como são feitas as contas

Toda a lógica está em `src/lib/finance` (funções puras, com testes):

- **Valor que conta de uma conta** = saldo × % da conta × margem de segurança (só em contas "investido").
- **Setup completo** = preço da mota + equipamento por comprar + custos da compra.
- **Mínimo para começar a andar** = o mesmo, só com itens e custos essenciais.
- **Falta** = meta − total juntado. Itens comprados saem da meta e ficam como "já gasto".
- **Ritmo de poupança**: média mensal dos últimos 6 meses do histórico de saldos. Cada conta conta a partir do primeiro saldo registado, para que os saldos iniciais não pareçam poupança. São precisos pelo menos 30 dias de histórico; sem isso (ou com ritmo ≤ 0) usa-se a meta mensal das Definições.
- **Data prevista** = hoje + falta ÷ ritmo.

---

## 1. Configurar o Supabase

1. Cria um projeto em [supabase.com](https://supabase.com) (região `West EU` / `Frankfurt` para ficar perto).
2. **Base de dados.** No painel, abre **SQL Editor** e corre, por esta ordem, o conteúdo de cada ficheiro de `supabase/migrations/`:
   1. `20260927000001_schema.sql`: tabelas, índices e triggers
   2. `20260927000002_rls.sql`: Row Level Security
   3. `20260927000003_balance_snapshots.sql`: histórico automático de saldos
   4. `20260927000004_new_user_seed.sql`: dados iniciais de cada utilizador
   5. `20260927000005_storage.sql`: bucket privado `photos`

   Em alternativa, com a CLI: `npx supabase init` (se ainda não existir `supabase/config.toml`), `npx supabase link --project-ref <ref>` e `npx supabase db push`.
3. **Auth → URL Configuration**
   - *Site URL*: o URL da app na Vercel (ex.: `https://mota-xxx.vercel.app`). Enquanto não tiveres deploy, usa `http://localhost:3000`.
   - *Redirect URLs*: acrescenta `http://localhost:3000/**` e `https://mota-xxx.vercel.app/**`.
4. **Auth → Emails → Templates.** O email tem de levar o **código de 6 dígitos**. No iPhone o link abre no Safari e não dentro da app instalada, por isso lá entra-se com o código. Altera os templates **Magic Link** e **Confirm signup** para, por exemplo:

   ```html
   <h2>Entrar na Mota</h2>
   <p>O teu código:</p>
   <p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
   <p>No computador também podes simplesmente
     <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">entrar por este link</a>.</p>
   ```
5. **Depois do primeiro login**, em **Auth → Sign In / Providers**, desativa *Allow new users to sign up*. A app já só aceita o email definido em `ALLOWED_EMAIL`, mas assim ninguém consegue criar conta diretamente pela API do Supabase.

> O serviço de email incluído no Supabase tem limites baixos (poucos emails por hora) e só envia para membros da equipa do projeto. Chega para uma pessoa; se precisares de mais, configura um SMTP próprio em **Auth → Emails → SMTP Settings**.

Ao primeiro login são criados automaticamente:
- **Contas:** Trade Republic e Revolut (disponível), e Trading 212 (investido, margem de 80%)
- **Equipamento:** capacete, casaco, luvas, botas e aulas de reciclagem (essenciais); intercomunicador Cardo e escape (depois)
- **Custos:**
  - da compra: transferência, seguro (1.ª prestação), IUC e primeira revisão
  - mensais: seguro, combustível, manutenção e estacionamento

Os preços começam a 0 € e a app mostra-os como "sem preço" até os preencheres.

## 2. Variáveis de ambiente

Copia `.env.example` para `.env.local` e preenche:

| Variável | Onde encontrar |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API (ou botão **Connect**) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Mesma página: chave *publishable* (`sb_publishable_…`) ou a antiga *anon key* |
| `ALLOWED_EMAIL` | O teu email (o único que pode pedir código). Aceita vários, separados por vírgulas |
| `NEXT_PUBLIC_SITE_URL` | Opcional. URL público da app; se vazio, é deduzido do pedido |

A *service role key* **não** é precisa nem deve ser usada: todas as queries correm com a sessão do utilizador e são filtradas pelo RLS.

## 3. Correr localmente

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # testes Vitest da camada de cálculos
npm run lint
npm run build      # build de produção (inclui o service worker)
```

O service worker só é registado em produção (`npm run build && npm start`).

## 4. Deploy na Vercel

1. Em [vercel.com/new](https://vercel.com/new), importa o repositório `mota-app` do GitHub. A Vercel deteta o Next.js e não é preciso mudar o build.
2. Em **Environment Variables**, acrescenta as variáveis da secção 2 (para *Production* e, se quiseres, *Preview*).
3. **Deploy.**
4. Volta ao Supabase (**Auth → URL Configuration**) e põe o domínio da Vercel no *Site URL* e nos *Redirect URLs*.
5. Cada push para o ramo principal faz um novo deploy automaticamente.

## 5. Instalar no iPhone

1. Abre o URL da app no **Safari** (tem de ser o Safari).
2. Toca no botão **Partilhar** (quadrado com a seta para cima) → **Adicionar ao ecrã principal** → **Adicionar**.
3. Abre a app **pelo ícone** no ecrã principal (fica em ecrã inteiro, sem barra do Safari).
4. Escreve o teu email → **Enviar código** → escreve o **código de 6 dígitos** que chega por email.
   Não uses o link do email no iPhone: abre no Safari, e a sessão do Safari é separada da sessão da app instalada.
5. A sessão renova-se sozinha, por isso só voltas a pedir código se terminares sessão ou ficares muito tempo sem abrir a app.

No computador basta abrir o URL no browser. No Chrome/Edge também dá para instalar como app (ícone de instalar na barra de endereço).

**Offline:** as páginas já visitadas ficam guardadas para consulta sem rede. Para guardar alterações é preciso ligação, porque a fonte de verdade é o Supabase.

---

## Estrutura

```
supabase/migrations/     SQL (esquema, RLS, triggers, seed, storage)
src/
  proxy.ts               renova a sessão e protege as páginas (Next 16: antigo middleware)
  sw/sw.ts               service worker (Serwist)
  app/
    login/, auth/confirm/  autenticação por código/link
    (app)/               páginas com sessão + tab bar (início, contas, equipamento, custos, histórico, mota, definições)
    serwist/[path]/      serve o service worker
    manifest.ts, ~offline/
  components/            UI (folha inferior, campos, botões, tab bar, upload de fotos)
  lib/
    finance/             cálculos puros + testes
    data/                queries ao Supabase (convertem euros → cêntimos)
    supabase/            clientes (servidor/browser) e tipos da BD
scripts/                 geração dos ícones (node scripts/generate-icons.mjs)
```

Os ícones são provisórios. Para os trocar, edita `scripts/icon.svg` e corre `node scripts/generate-icons.mjs`.

## Preparado para a fase 2

| Funcionalidade | O que já existe |
|---|---|
| Gráfico da evolução | `balance_snapshots` + `totalSeries()` em `lib/finance/history.ts`; Recharts instalado |
| Marcos 25/50/75/100% | derivam da mesma série e da percentagem |
| Mensagens "já tens o equivalente a…" | `gear_items` com preços e prioridades |
| Streak da meta mensal | série mensal a partir do histórico + `settings.monthly_goal` |
| Comparar motas | `motorcycles.is_active` (uma ativa por utilizador), RPC `set_active_motorcycle`, `costs.motorcycle_id` |
| Trading 212 | `accounts.source`; o route handler deve ler `TRADING212_API_KEY` só no servidor e atualizar o saldo (o trigger regista o histórico) |
| Notificações push | service worker Serwist já registado; falta a tabela de subscrições e as chaves VAPID |
