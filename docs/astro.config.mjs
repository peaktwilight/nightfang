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
        "Documentation for pwnkit — fully autonomous agentic pentesting framework.",
      logo: {
        src: "./src/assets/pwnkit-icon.gif",
        alt: "pwnkit",
      },
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/peaktwilight/pwnkit",
        },
        {
          icon: "external",
          label: "Website",
          href: "https://pwnkit.com",
        },
      ],
      defaultLocale: "root",
      expressiveCode: {
        themes: ["dracula"],
      },
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
          label: "Philosophy",
          slug: "philosophy",
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
          label: "Research",
          slug: "research",
        },
        {
          label: "API Keys",
          slug: "api-keys",
        },
      ],
      customCss: ["./src/styles/custom.css"],
    }),
  ],
});
