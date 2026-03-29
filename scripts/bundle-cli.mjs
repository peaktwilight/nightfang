import { build } from "esbuild";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const outdir = "dist";

rmSync(outdir, { force: true, recursive: true });
mkdirSync(outdir, { recursive: true });

// Stub out optional dev-only dependencies that Ink tries to import
const stubPlugin = {
  name: "stub-optional",
  setup(build) {
    const stubModules = ["react-devtools-core", "yoga-wasm-web"];
    const filter = new RegExp(`^(${stubModules.join("|")})$`);
    build.onResolve({ filter }, (args) => ({
      path: args.path,
      namespace: "stub",
    }));
    build.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
      contents: "export default {}; export const activate = () => {};",
      loader: "js",
    }));
  },
};

await build({
  entryPoints: ["packages/cli/src/index.ts"],
  outfile: `${outdir}/index.js`,
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node18",
  banner: {
    js: '#!/usr/bin/env node\nimport { createRequire as __pwnkitCreateRequire } from "node:module";\nconst require = __pwnkitCreateRequire(import.meta.url);',
  },
  external: [
    "better-sqlite3",
    "drizzle-orm",
    "drizzle-orm/*",
  ],
  plugins: [stubPlugin],
});

cpSync("packages/templates/attacks", `${outdir}/attacks`, { recursive: true });

const bundlePath = `${outdir}/index.js`;
const bundle = readFileSync(bundlePath, "utf8").replace(
  "#!/usr/bin/env node\n#!/usr/bin/env node\n",
  "#!/usr/bin/env node\n"
);
writeFileSync(bundlePath, bundle);
