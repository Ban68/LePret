import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        card: "0 12px 24px -12px rgba(0,0,0,0.18)",
        soft: "0 8px 14px -8px rgba(0,0,0,0.12)",
      },
      fontFamily: {
        colette: ['var(--font-colette)'],
        kollektif: ['var(--font-kollektif)'],
      },
    },
  },
  plugins: [],
};
export default config;