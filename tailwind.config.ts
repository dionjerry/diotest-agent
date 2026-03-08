import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./extension/sidepanel/**/*.{ts,tsx,html}"],
  theme: {
    extend: {}
  },
  plugins: []
};

export default config;
