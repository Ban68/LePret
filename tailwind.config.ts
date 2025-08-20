import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        lp: {
          "primary-1": "#18240f", // VERDE OSCURO (Color Principal 1)
          "primary-2": "#fffffa", // CREMA (Color Principal 2)
          "sec-1": "#afb6a6",     // Gris verdoso
          "sec-2": "#ead4ff",     // Lila claro
          "sec-3": "#5d3f3c",     // Vino/Marrón
          "sec-4": "#f2ede1",     // Beige
        },
        // shadcn/ui theme
        primary: "#18240f",
        "primary-foreground": "#fffffa",
        secondary: "#afb6a6",
        "secondary-foreground": "#18240f",
        accent: "#f2ede1",
        "accent-foreground": "#18240f",
        background: "#fffffa",
        foreground: "#18240f",
      },
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
