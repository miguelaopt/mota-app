import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { encodeSession, SESSION_HEADER } from "@/lib/session-header";
import { getSupabaseConfig } from "@/lib/supabase/env";

/** Caminhos acessíveis sem sessão. */
const PUBLIC_PATHS = ["/login", "/auth/", "/~offline"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p.endsWith("/") ? p : `${p}/`));
}

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Página mostrada quando faltam (ou estão mal) as variáveis de ambiente. */
function configErrorPage(problems: string[]) {
  const items = problems.map((p) => `<li>${escapeHtml(p)}</li>`).join("");
  const html = `<!doctype html>
<html lang="pt-PT"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Configuração em falta · Mota</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 24px 16px;
         background: #f2f2f7; color: #111114; line-height: 1.5; }
  @media (prefers-color-scheme: dark) { body { background: #000; color: #f5f5f7; } main { background: #1c1c1e; } }
  main { max-width: 36rem; margin: 0 auto; background: #fff; border-radius: 16px; padding: 20px; }
  h1 { font-size: 1.4rem; margin: 0 0 8px; }
  li { margin: 6px 0; }
  code { font-size: 0.9em; }
</style></head>
<body><main>
  <h1>A app ainda não está configurada</h1>
  <p>O servidor não encontrou uma configuração válida do Supabase:</p>
  <ul>${items}</ul>
  <p><strong>Na Vercel:</strong> Project → Settings → Environment Variables. Corrige as variáveis e faz
     <strong>Redeploy</strong> (Deployments → ⋯ → Redeploy): as alterações só contam num deploy novo.</p>
  <p><strong>No computador:</strong> preenche o <code>.env.local</code> (vê o <code>.env.example</code>) e reinicia o <code>npm run dev</code>.</p>
</main></body></html>`;
  return new NextResponse(html, {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

/**
 * Renova a sessão do Supabase em cada navegação (os tokens expiram) e manda
 * para /login quem não tem sessão. A verificação "a sério" é feita também no
 * layout protegido e, na base de dados, pelo RLS.
 */
export async function proxy(request: NextRequest) {
  const config = getSupabaseConfig();
  if (!config.ok) {
    console.error(`[mota] Configuração do Supabase inválida: ${config.problems.join(" ")}`);
    return configErrorPage(config.problems);
  }

  // Este cabeçalho só pode vir do proxy: apaga sempre o que o browser enviar.
  request.headers.delete(SESSION_HEADER);

  const pendingCookies: Array<{ name: string; value: string; options: CookieOptions }> = [];
  const pendingHeaders: Record<string, string> = {};
  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        // Tokens renovados: ficam no pedido (para a página) e na resposta (para o browser).
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        pendingCookies.push(...cookiesToSet);
        Object.assign(pendingHeaders, headers ?? {});
      },
    },
  });

  // Não pôr código entre createServerClient e getClaims: é aqui que a sessão é renovada.
  let session: { sub: string; email: string | null } | null = null;
  try {
    const { data } = await supabase.auth.getClaims();
    const claims = data?.claims;
    if (claims?.sub) session = { sub: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
  } catch (error) {
    // Falha inesperada (ex.: Supabase inacessível): segue sem sessão. As páginas
    // protegidas voltam a verificar a sessão e o RLS protege os dados.
    console.error("[mota] Erro a validar a sessão no proxy", error);
  }
  // A página reutiliza esta validação em vez de voltar a perguntar ao Supabase.
  if (session) request.headers.set(SESSION_HEADER, encodeSession(session));

  const withCookies = (response: NextResponse) => {
    for (const { name, value, options } of pendingCookies) response.cookies.set(name, value, options);
    for (const [key, value] of Object.entries(pendingHeaders)) response.headers.set(key, value);
    return response;
  };

  const { pathname } = request.nextUrl;
  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    return withCookies(NextResponse.redirect(url));
  };

  if (!session && !isPublic(pathname)) return redirectTo("/login");
  if (session && pathname === "/login") return redirectTo("/");

  return withCookies(NextResponse.next({ request }));
}

export const config = {
  matcher: [
    // Tudo exceto ficheiros estáticos, ícones, manifest e o service worker.
    "/((?!_next/static|_next/image|favicon.ico|icons/|serwist/|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)",
  ],
};
