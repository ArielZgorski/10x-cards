/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    // Environment setup
    environment: 'jsdom',
    
    // Setup files
    setupFiles: ['./tests/setup.ts'],
    
    // Global imports
    globals: true,
    
    // Coverage configuration
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.config.*',
        '**/*.test.*',
        '**/*.spec.*',
        '**/types.ts',
        '**/env.d.ts',
      ],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80,
      },
    },
    
    // Test file patterns
    include: [
      'src/**/*.{test,spec}.{js,ts,tsx}',
      'tests/unit/**/*.{test,spec}.{js,ts,tsx}',
      'tests/**/*.test.{js,ts,tsx}',
    ],
    
    // Exclude patterns
    exclude: [
      'node_modules/',
      'dist/',
      'build/',
      'tests/e2e/',
      '**/*.e2e.{test,spec}.{js,ts,tsx}',
    ],
    
    // Test timeout
    testTimeout: 10000,
    
    // Watch mode configuration
    watch: {
      ignore: ['node_modules/', 'dist/', 'build/', 'tests/e2e/'],
    },
    
    // Mock configuration
    clearMocks: true,
    restoreMocks: true,
    
    // TypeScript configuration
    typecheck: {
      enabled: true,
      only: false,
    },
  },
  
  // Resolve configuration for better import handling
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/components': resolve(__dirname, './src/components'),
      '@/lib': resolve(__dirname, './src/lib'),
      '@/pages': resolve(__dirname, './src/pages'),
      '@/types': resolve(__dirname, './src/types.ts'),
    },
  },
  
  // Esbuild configuration for faster builds
  esbuild: {
    target: 'es2022',
  },
});
