import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        outfit: ['var(--font-outfit)', 'sans-serif'],
        cairo: ['var(--font-cairo)', 'sans-serif'],
        sans: ['var(--font-outfit)', 'var(--font-cairo)', 'sans-serif'],
      },
      colors: {
        brand: {
          DEFAULT: '#1E3A5F',
          dark: '#162d4a',
          light: '#2a4d7a',
        },
      },
      maxWidth: {
        '8xl': '88rem',
      },
    },
  },
  plugins: [],
}

export default config
