const path = require("path");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    path.join(__dirname, "app/**/*.{js,jsx}"),
    path.join(__dirname, "components/**/*.{js,jsx}"),
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f9ff",
          500: "#0ea5e9",
          600: "#0284c7",
          900: "#0c4a6e",
        },
      },
    },
  },
  plugins: [],
};
