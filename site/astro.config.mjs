import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Repo root (parent of `site/`) — for reading `package.json` version in docs */
const repoRoot = path.resolve(__dirname, "..");

export default defineConfig({
  site: "https://boumouzounabrahimvall.github.io",
  base: "/local-proxy",
  vite: {
    resolve: {
      alias: {
        "@repo": repoRoot,
      },
    },
  },
  integrations: [
    starlight({
      components: {
        Header: "./src/components/Header.astro",
      },
      title: "local-proxy",
      description: "Scenario-driven local API proxy for local development",
      logo: {
        src: "./src/assets/logo.svg",
        alt: "local-proxy logo",
      },
      customCss: ["./src/styles/tokens.css", "./src/styles/custom.css"],
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/BoumouzounaBrahimVall",
        },
      ],
      sidebar: [
        {
          label: "Guide",
          items: [
            { label: "Getting Started", slug: "getting-started" },
            { label: "CLI Reference", slug: "cli-reference" },
            { label: "Scenarios", slug: "scenarios" },
          ],
        },
      ],
    }),
  ],
});
