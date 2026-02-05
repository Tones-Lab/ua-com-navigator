import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '192.168.3.42',
    allowedHosts: ['lab-ua-tony02.tony.lab', 'localhost', '192.168.3.42'],
    https: {
      key: fs.readFileSync('/opt/assure1/etc/ssl/Web.key'),
      cert: fs.readFileSync('/opt/assure1/etc/ssl/Web.crt'),
    },
    proxy: {
      '/api': {
        target: 'https://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    port: 5173,
    host: '0.0.0.0',
    https: {
      key: fs.readFileSync('/opt/assure1/etc/ssl/Web.key'),
      cert: fs.readFileSync('/opt/assure1/etc/ssl/Web.crt'),
    },
    proxy: {
      '/api': {
        target: 'https://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
      { find: '@components', replacement: path.resolve(__dirname, './src/components') },
      { find: '@services', replacement: path.resolve(__dirname, './src/services') },
      { find: '@stores', replacement: path.resolve(__dirname, './src/stores') },
      { find: '@types', replacement: path.resolve(__dirname, './src/types') },
      { find: '@utils', replacement: path.resolve(__dirname, './src/utils') },
      {
        find: 'ojs',
        replacement: path.resolve(
          __dirname,
          '../node_modules/@oracle/oraclejet/dist/js/libs/oj/debug_esm',
        ),
      },
      {
        find: /^jqueryui-amd\/(.*)$/,
        replacement: path.resolve(
          __dirname,
          '../node_modules/@oracle/oraclejet/dist/js/libs/jquery/jqueryui-amd-1.13.2/$1',
        ),
      },
      {
        find: 'jqueryui-amd',
        replacement: path.resolve(
          __dirname,
          '../node_modules/@oracle/oraclejet/dist/js/libs/jquery/jqueryui-amd-1.13.2',
        ),
      },
    ],
  },
});
