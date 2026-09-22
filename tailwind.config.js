/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      boxShadow: {
        glow: '0 20px 55px rgba(255, 90, 124, 0.25)',
      },
      backgroundImage: {
        'mesh-soft': 'radial-gradient(circle at top left, rgba(255,255,255,0.08), transparent 32%), radial-gradient(circle at bottom right, rgba(255,95,109,0.12), transparent 32%)',
      },
    },
  },
  plugins: [],
}
