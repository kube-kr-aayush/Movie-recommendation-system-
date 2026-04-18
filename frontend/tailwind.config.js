/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        netflix: {
          red: "#e50914",
          dark: "#141414",
          card: "#1f1f1f",
        },
      },
      boxShadow: {
        glow: "0 0 25px rgba(229, 9, 20, 0.35)",
      },
    },
  },
  plugins: [],
};
