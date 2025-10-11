/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
      },
      colors: {
        'mushroom': {
          50: '#fdfdf4',
          100: '#fcfce8',
          200: '#f6f6c5',
          300: '#efef98',
          400: '#e5e562',
          500: '#d4d438',
          600: '#b8b82a',
          700: '#949426',
          800: '#797925',
          900: '#666624',
          950: '#3a3a11',
        },
        'forest': {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        }
      },
    },
  },
  plugins: [],
}
