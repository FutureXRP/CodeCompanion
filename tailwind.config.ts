import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        brand: {
          50:  '#f0f4ff',
          100: '#dce6ff',
          500: '#3b6ef8',
          600: '#2d5de8',
          700: '#1e4acc',
          900: '#0f2566',
        },
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(15,21,32,0.06), 0 1px 2px -1px rgba(15,21,32,0.04)',
        'card-hover': '0 4px 12px 0 rgba(15,21,32,0.10), 0 1px 3px 0 rgba(15,21,32,0.06)',
        'modal': '0 20px 60px 0 rgba(15,21,32,0.18)',
      },
    },
  },
  plugins: [],
}
export default config
