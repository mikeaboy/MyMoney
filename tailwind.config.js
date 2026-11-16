/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./resources/**/*.blade.php",
    "./resources/**/*.js",
    "./resources/**/*.vue",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Noto Sans TC', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        brand: {
          50: '#f4f4f5',
          100: '#e4e4e7',
          500: '#a1a1aa',
          600: '#d4d4d8',
          700: '#18181b',
          900: '#09090b',
        }
      }
    },
  },
  plugins: [],
}

