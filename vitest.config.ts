import { defineConfig, type Plugin } from "vitest/config";
import { transform as esbuildTransform } from "esbuild";

/**
 * Vitest 5 / Vite 8 memakai oxc untuk transform, dan oxc TIDAK menurunkan
 * legacy decorator — ia membiarkan `@NearBindgen` apa adanya sehingga Node
 * gagal parse ("Invalid or unexpected token"). Hanya contract/src yang
 * memakai decorator (near-sdk-js), jadi satu file itu saja yang
 * ditransform dengan esbuild + experimentalDecorators.
 */
function legacyDecoratorsPlugin(): Plugin {
  return {
    name: "keyguard-legacy-decorators",
    enforce: "pre",
    async transform(code, id) {
      if (!id.endsWith("contract/src/contract.ts")) return null;
      const out = await esbuildTransform(code, {
        loader: "ts",
        target: "es2023",
        tsconfigRaw: JSON.stringify({
          compilerOptions: { experimentalDecorators: true },
        }),
      });
      return { code: out.code, map: out.map || null };
    },
  };
}

export default defineConfig({
  plugins: [legacyDecoratorsPlugin()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "contract/**/*.test.ts"],
  },
});
