/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    // Placeholder; the CLI dev server or Vite will override/use proper globs
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

