import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#12304A",
          dark: "#0E263B",
          light: "#1B4063",
        },
        teal: {
          DEFAULT: "#13A89E",
          dark: "#0E8A82",
          light: "#E6F6F5",
        },
        appbg: "#F5F8FB",
        ink: {
          heading: "#0F2537",
          body: "#334155",
          muted: "#64748B",
        },
        line: "#E2E8F0",
      },
      fontFamily: {
        sans: [
          "Inter",
          "SF Pro Display",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        arabic: [
          "'Noto Naskh Arabic'",
          "'Amiri'",
          "Tahoma",
          "serif",
        ],
      },
      boxShadow: {
        card: "0 1px 3px rgba(18,48,74,0.08), 0 4px 12px rgba(18,48,74,0.06)",
        pop: "0 8px 30px rgba(15,37,55,0.12)",
      },
      borderRadius: {
        xl: "12px",
        lg: "8px",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(19,168,158,0.5)" },
          "70%": { boxShadow: "0 0 0 8px rgba(19,168,158,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(19,168,158,0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 180ms ease-out",
        "pulse-ring": "pulse-ring 1.8s ease-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
