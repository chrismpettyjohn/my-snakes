import {defineConfig} from 'vite';
import solid from 'vite-plugin-solid';
export default defineConfig({plugins: [solid()], server: {host: 'localhost', port: 5173, strictPort: true}});
