import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Tauri 開發模式固定使用 1420 埠，且不清除終端機輸出以保留 Rust 編譯訊息
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  test: { environment: 'node' },
});
