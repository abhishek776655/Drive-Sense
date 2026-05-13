/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#16A34A",
        primaryLight: "#DCFCE7",
        background: "#F7F7F8",
        surface: "#FFFFFF",
        textPrimary: "#111827",
        textSecondary: "#6B7280",
        borderSoft: "#E5E7EB",
        success: "#16A34A",
        warning: "#F59E0B",
        danger: "#EF4444",
      },
    },
  },
  plugins: [],
}