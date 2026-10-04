import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    // The mock server answers at once in unit tests.
    env: { NEXT_PUBLIC_API_MOCK_LATENCY_MS: '0' },
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    css: true,
  },
});
