import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      colors: {
        accent: {
          DEFAULT: "#8ab4f8",
          dim: "rgba(138, 180, 248, 0.12)",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
