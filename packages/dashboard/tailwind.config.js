/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        'control-bg': '#0a0e17',
        'control-panel': '#131821',
        'control-border': '#1f2937',
        'control-border-bright': '#374151',
        'control-cyan': '#06b6d4',
        'control-amber': '#f59e0b',
        'control-emerald': '#10b981',
        'control-red': '#ef4444',
      },
    },
  },
  plugins: [],
};
