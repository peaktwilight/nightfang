import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  output: "static",
  outDir: "./dist",
  site: "https://docs.pwnkit.com",
  integrations: [
    starlight({
      title: "pwnkit",
      description:
        "Documentation for pwnkit — the general-purpose autonomous pentesting framework.",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/peaktwilight/pwnkit",
        },
      ],
      sidebar: [
        {
          label: "Getting Started",
          slug: "getting-started",
        },
        {
          label: "Commands",
          slug: "commands",
        },
        {
          label: "Configuration",
          slug: "configuration",
        },
        {
          label: "Architecture",
          slug: "architecture",
        },
        {
          label: "Benchmark",
          slug: "benchmark",
        },
        {
          label: "API Keys",
          slug: "api-keys",
        },
      ],
      customCss: [],
    }),
  ],
});
