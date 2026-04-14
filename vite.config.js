import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        pong: 'pong.html',
        snake: 'snake.html',
        hangman: 'hangman.html',
      },
    },
  },
});
