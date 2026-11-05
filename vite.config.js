import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import ogPages from './scripts/ogPages.js';

// base './' — 깃허브 페이지(저장소 이름 하위 주소)에서도 경로가 깨지지 않는다
// ogPages — 영상마다 카카오톡 미리보기용 페이지(dist/v/<ID>/)를 만든다
// drink — 음료수 당번 페이지(/drink/). 주소로만 들어오는 숨은 페이지라 어디에도 링크하지 않는다
export default defineConfig({
  base: './',
  plugins: [react(), ogPages()],
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        drink: fileURLToPath(new URL('./drink/index.html', import.meta.url))
      }
    }
  }
});
