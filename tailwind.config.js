/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: "#d4af76",
          soft: "#e8c896",
          deep: "#b88f5d",
          line: "rgba(212, 175, 118, 0.22)",
        },
        ink: {
          900: "#0a0a09",
          800: "#0f0e0c",
          700: "#161410",
          600: "#1a1916",
        },
        bone: {
          DEFAULT: "#f2ede0",
          muted: "#9b9588",
          faint: "#5e5a52",
        },
      },
      fontFamily: {
        serif: ["ui-serif", "Georgia", "Cambria", "serif"],
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      letterSpacing: {
        caps: "0.22em",
        capsTight: "0.18em",
      },
    },
  },
  plugins: [],
};
