/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    // other paths...
  ],
  theme: {
    extend: {
      colors: {
        // Custom dark‑blue used for the top banner
        "dark-blue": "#001F3F",
      },
    },
  },
  plugins: [],
};
