import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' — 깃허브 페이지(저장소 이름 하위 주소)에서도 경로가 깨지지 않는다
export default defineConfig({ base: './', plugins: [react()] });
