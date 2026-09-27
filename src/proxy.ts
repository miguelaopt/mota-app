import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
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

  let response = NextResponse.next({ request });

  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  // Não pôr código entre createServerClient e getClaims: é aqui que a sessão é renovada.
  let signedIn = false;
  try {
    const { data } = await supabase.auth.getClaims();
    signedIn = Boolean(data?.claims?.sub);
  } catch (error) {
    // Falha inesperada (ex.: Supabase inacessível): segue sem sessão. As páginas
    // protegidas voltam a verificar a sessão e o RLS protege os dados.
    console.error("[mota] Erro a validar a sessão no proxy", error);
  }
  const { pathname } = request.nextUrl;

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    const redirect = NextResponse.redirect(url);
    // Manter os cookies renovados no redirect.
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  };

  if (!signedIn && !isPublic(pathname)) return redirectTo("/login");
  if (signedIn && pathname === "/login") return redirectTo("/");

  return response;
}

export const config = {
  matcher: [
    // Tudo exceto ficheiros estáticos, ícones, manifest e o service worker.
    "/((?!_next/static|_next/image|favicon.ico|icons/|serwist/|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)",
  ],
};
