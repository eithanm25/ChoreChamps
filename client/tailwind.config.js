/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        // Was referenced across the app (task/reward panels, success toasts)
        // as `animate-fade-in` without ever being defined — Tailwind silently
        // generated no CSS for it. Defining it here brings those spots to
        // life too, not just the new components that use it.
        'fade-in': 'fade-in 0.35s ease-out',
      },
    },
  },
  plugins: [],
};
