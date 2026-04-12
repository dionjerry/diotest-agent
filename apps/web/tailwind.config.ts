import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#070c0d',
        panel: '#101719',
        panelStrong: '#141d1f',
        line: 'rgba(255,255,255,0.08)',
        lineStrong: 'rgba(255,255,255,0.14)',
        text: '#f5f7f6',
        muted: '#9fb1af',
        soft: '#637775',
        brand: '#39d39f',
        brandDeep: '#10372f',
        danger: '#ff7d7d',
        warn: '#ffca6b'
      },
      fontFamily: {
        sans: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        panel: '0 30px 80px rgba(0, 0, 0, 0.35)'
      },
      borderRadius: {
        xl2: '1.25rem',
        xl3: '1.75rem'
      }
    }
  },
  plugins: []
};

export default config;
