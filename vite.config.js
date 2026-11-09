import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',                // в тестах есть document, window
    globals: true,
    setupFiles: './src/test/setup.js',
    include: ['src/**/*.test.{js,jsx}'], // e2e-тесты Playwright сюда не попадут
    css: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/test/**', 'src/**/*.test.{js,jsx}', 'src/main.jsx'],
      reporter: ['text', 'html'],
      // CI упадёт, если покрытие опустится ниже порога (бонус ЛР10)
      thresholds: { lines: 60 },
    },
  },
})
