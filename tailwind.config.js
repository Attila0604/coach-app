/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // RGYM-Stahl-/Silber-Design (Namen beibehalten, Werte umgestellt).
        gold: {
          DEFAULT: "#8FAAC6",
          soft: "#C9D2DB",
          deep: "#6E8295",
          line: "rgba(143, 170, 198, 0.22)",
        },
        ink: {
          900: "#0B0F15",
          800: "#10151D",
          700: "#161D27",
          600: "#1B232F",
        },
        bone: {
          DEFAULT: "#E7ECF2",
          muted: "#9AA6B4",
          faint: "#5E6B7A",
        },
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Oswald", "Impact", "sans-serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        caps: "0.22em",
        capsTight: "0.18em",
      },
    },
  },
  plugins: [],
};
