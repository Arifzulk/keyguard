import { defineConfig, type Plugin } from "vitest/config";
import { transform as esbuildTransform } from "esbuild";

/**
 * Vitest 5 / Vite 8 uses oxc for transforms, and oxc does NOT lower
 * legacy decorators — it leaves `@NearBindgen` as-is, so Node fails to
 * parse it ("Invalid or unexpected token"). Only contract/src uses
 * decorators (near-sdk-js), so only that one file is transformed
 * with esbuild + experimentalDecorators.
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
