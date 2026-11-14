/**
 * Pixel-art dark medieval theme (see docs/design.md).
 * `gray` is remapped to warm stone so every existing gray-* class takes the new look;
 * corners are square (pixel style) except `rounded-full`.
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    borderRadius: {
      none: '0',
      sm: '0',
      DEFAULT: '0',
      md: '0',
      lg: '0',
      xl: '0',
      '2xl': '0',
      '3xl': '0',
      full: '9999px',
    },
    extend: {
      colors: {
        // Warm stone. 500/600 are lighter than Tailwind's grays so secondary text keeps contrast on the dark background.
        gray: {
          50: '#f4efe6',
          100: '#e9e1d3',
          200: '#d6cbb8',
          300: '#bdb19c',
          400: '#a39782',
          500: '#8c806c',
          600: '#776d5c',
          700: '#433c33',
          800: '#2c2721',
          900: '#1c1814',
          950: '#110e0b',
        },
        torch: { DEFAULT: '#e8891c', light: '#f5a940', dark: '#9a4f0c' },
        stone: { DEFAULT: '#2c2721', dark: '#16120e', light: '#4a4238' },
        bone: '#f4efe6',
      },
      fontFamily: {
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        pixel: ['var(--font-pixel)', 'monospace'],
        digits: ['var(--font-digits)', 'monospace'],
      },
    },
  },
  plugins: [],
};
