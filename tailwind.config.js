/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Custom dark mode colors
        dark: {
          bg: '#0F1117',           // Deep charcoal-black background
          card: '#1A1C23',         // Slightly lighter for cards
          search: '#22252D',       // Mid-tone dark for search bar
          text: '#E3E7EC',         // Almost white text
          'tag-bg': '#2E313A',     // Muted bluish-gray for tags
          'tag-alt': '#3A3F4B',    // Alternative tag color
          'tag-text': '#AEB4C1',   // Desaturated light gray-blue for tag text
        },
        // Custom accent colors
        accent: {
          primary: '#4A90E2',      // Smart highlight (search matches, links)
          secondary: '#00C6AE',    // Buttons, active filters
          warning: '#FF5C5C',      // Errors, invalid tags
          success: '#58D68D',      // Upload success, saved
        }
      },
      transitionProperty: {
        'colors': 'color, background-color, border-color, text-decoration-color, fill, stroke',
      }
    },
  },
  plugins: [],
};