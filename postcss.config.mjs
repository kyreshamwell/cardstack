// Tailwind 4 uses a PostCSS plugin instead of a standalone CLI.
// This file tells PostCSS to run @tailwindcss/postcss when processing CSS files.
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}

export default config
