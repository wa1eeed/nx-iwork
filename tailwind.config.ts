import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      // Platform-wide type scale — a moderate bump to the reading sizes (the
      // dashboard leans on text-sm/text-xs) for better legibility per modern
      // dashboard standards. Only the body/reading steps are enlarged; display
      // sizes (2xl+) keep Tailwind defaults so headings don't balloon.
      fontSize: {
        xs: ['0.8125rem', { lineHeight: '1.15rem' }], // 13px
        sm: ['0.9375rem', { lineHeight: '1.4rem' }], // 15px
        base: ['1.0625rem', { lineHeight: '1.65rem' }], // 17px
        lg: ['1.1875rem', { lineHeight: '1.8rem' }], // 19px
        xl: ['1.3125rem', { lineHeight: '1.85rem' }], // 21px
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        success: 'hsl(var(--success))',
        warning: 'hsl(var(--warning))',
        brand: {
          from: 'hsl(var(--brand-from))',
          to: 'hsl(var(--brand-to))',
        },
      },
      borderRadius: {
        xl: 'calc(var(--radius) + 4px)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        arabic: ['var(--font-arabic)', 'var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        // Soft, layered elevation (dark-friendly).
        card: '0 1px 2px 0 hsl(220 40% 2% / 0.06), 0 4px 16px -4px hsl(220 40% 2% / 0.10)',
        elevated: '0 8px 30px -6px hsl(220 40% 2% / 0.22)',
        // Brand glow for primary / active elements.
        glow: '0 0 0 1px hsl(var(--brand-from) / 0.20), 0 6px 24px -6px hsl(var(--brand-from) / 0.45)',
        'glow-lg': '0 0 40px -6px hsl(var(--brand-to) / 0.5)',
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, hsl(var(--brand-from)), hsl(var(--brand-to)))',
        'gradient-brand-soft':
          'linear-gradient(135deg, hsl(var(--brand-from) / 0.12), hsl(var(--brand-to) / 0.12))',
        shimmer:
          'linear-gradient(110deg, transparent 30%, hsl(0 0% 100% / 0.12) 50%, transparent 70%)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        aurora: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(3%, -4%) scale(1.06)' },
          '66%': { transform: 'translate(-3%, 3%) scale(0.97)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-up': 'fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        float: 'float 6s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 3s ease-in-out infinite',
        shimmer: 'shimmer 2s linear infinite',
        aurora: 'aurora 18s ease-in-out infinite',
      },
    },
  },
  plugins: [animate],
};

export default config;
