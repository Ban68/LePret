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
        'lp-primary-1': '#18240f',
        'lp-primary-2': '#fffffa',
        'lp-sec-1': '#afb6a6',
        'lp-sec-2': '#ead4ff',
        'lp-sec-3': '#5d3f3c',
        'lp-sec-4': '#f2ede1',
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
