/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        paper: "#f8fafc",
        accent: "#f97316",
        highlight: "#22c55e",
        muted: "#94a3b8"
      },
      fontFamily: {
        sans: ["Sora", "ui-sans-serif", "system-ui"],
        display: ["DM Serif Display", "serif"],
        cursive: ["Caveat", "cursive"]
      },
      boxShadow: {
        glow: "0 20px 60px rgba(249,115,22,0.22)"
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)"
      }
    }
  },
  plugins: []
};
