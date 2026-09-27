import { createSerwistRoute } from "@serwist/turbopack";

// Muda a cada deploy, para o service worker voltar a guardar a página offline.
const revision = process.env.VERCEL_GIT_COMMIT_SHA ?? crypto.randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  swSrc: "src/sw/sw.ts",
  additionalPrecacheEntries: [{ url: "/~offline", revision }],
  useNativeEsbuild: true,
});
