// client/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    // to include CodeMirror styles in Tailwind's purging
    "node_modules/codemirror/**/*.js",
    "node_modules/@codemirror/**/*.js",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}