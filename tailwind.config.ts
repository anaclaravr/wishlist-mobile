import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--ds-font-sans)"],
      },
      fontSize: {
        "ds-xs": ["var(--ds-text-xs)", { lineHeight: "var(--ds-leading-normal)" }],
        "ds-sm": ["var(--ds-text-sm)", { lineHeight: "var(--ds-leading-normal)" }],
        "ds-base": ["var(--ds-text-base)", { lineHeight: "var(--ds-leading-normal)" }],
        "ds-lg": ["var(--ds-text-lg)", { lineHeight: "var(--ds-leading-snug)" }],
        "ds-xl": ["var(--ds-text-xl)", { lineHeight: "var(--ds-leading-snug)" }],
        "ds-2xl": ["var(--ds-text-2xl)", { lineHeight: "var(--ds-leading-tight)" }],
        "ds-3xl": ["var(--ds-text-3xl)", { lineHeight: "var(--ds-leading-tight)" }],
        "ds-4xl": ["var(--ds-text-4xl)", { lineHeight: "var(--ds-leading-tight)" }],
      },
      fontWeight: {
        regular: "var(--ds-font-weight-regular)",
        medium: "var(--ds-font-weight-medium)",
        semibold: "var(--ds-font-weight-semibold)",
        bold: "var(--ds-font-weight-bold)",
      },
      boxShadow: {
        soft: "0 18px 45px rgba(17, 24, 39, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
