import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#f3f6fb", 100: "#e4ebf5", 200: "#c3d2e8", 300: "#93acd6", 400: "#5a7fc0",
          500: "#355ba6", 600: "#2a4d8c", 700: "#1e3a6b", 800: "#16294f", 900: "#0f1e3d", 950: "#0a1428",
        },
        gold: { 50: "#faf6ec", 100: "#f3e9cc", 200: "#e8d49a", 300: "#dcbd66", 400: "#d2a942", 500: "#c8a24a", 600: "#a8842c", 700: "#856621", 800: "#5f491a", 900: "#3d2f12" },
      },
      fontFamily: { sans: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "Arial", "sans-serif"], serif: ['"Georgia"', "serif"] },
      boxShadow: { card: "0 1px 3px rgba(15,30,61,0.08), 0 8px 24px -12px rgba(15,30,61,0.18)" },
    },
  },
  plugins: [],
};
export default config;
