import { build } from "esbuild";
import pinoPlugin from "esbuild-plugin-pino";

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outdir: "dist",
  outExtension: { ".js": ".mjs" },
  sourcemap: "linked",
  external: ["sharp", "pg-native", "better-sqlite3", "*.node"],
  plugins: [pinoPlugin({ transports: ["pino-pretty"] })],
  banner: {
    js: [
      `import { createRequire as __createRequire } from "module";`,
      `const require = __createRequire(import.meta.url);`,
    ].join("\n"),
  },
});

console.log("Build complete.");
