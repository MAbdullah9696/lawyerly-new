import type { Config } from "tailwindcss";

/**
 * Lawyerly design system — a polished legal/professional palette:
 * deep navy (authority/trust), warm gold (premium accent), clean neutrals.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#f3f6fb",
          100: "#e4ebf5",
          200: "#c3d2e8",
          300: "#93acd6",
          400: "#5a7fc0",
          500: "#355ba6",
          600: "#2a4d8c",
          700: "#1e3a6b",
          800: "#16294f",
          900: "#0f1e3d",
          950: "#0a1428",
        },
        gold: {
          50: "#faf6ec",
          100: "#f3e9cc",
          200: "#e8d49a",
          300: "#dcbd66",
          400: "#d2a942",
          500: "#c8a24a",
          600: "#a8842c",
          700: "#856621",
          800: "#5f491a",
          900: "#3d2f12",
        },
      },
      fontFamily: {
        serif: ['"Georgia"', '"Times New Roman"', "serif"],
        sans: [
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 3px rgba(15,30,61,0.08), 0 8px 24px -12px rgba(15,30,61,0.18)",
        "card-lg": "0 4px 24px -6px rgba(15,30,61,0.18)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "typing-dot": {
          "0%, 60%, 100%": { opacity: "0.3" },
          "30%": { opacity: "1" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out both",
        "typing-dot": "typing-dot 1.4s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
