/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    // Content will be overridden dynamically by vite.config.js
    // This is just a fallback
    './**/*.{vue,js,ts,jsx,tsx,html}',
  ],
  theme: {
    extend: {
      zIndex: {
        60: '60',
        70: '70',
        80: '80',
        90: '90',
        100: '100',
      },
    },
  },
  plugins: [],
}
