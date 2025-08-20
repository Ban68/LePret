// tailwind.config.ts
import type { Config } from "tailwindcss"

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
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
      },
    },
  },
  plugins: [],
}
export default config