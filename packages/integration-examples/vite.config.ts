import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
// @ts-ignore
import nodePolyfills from 'vite-plugin-node-stdlib-browser'


// https://vite.dev/config/
export default defineConfig({

  // force pre bundling for monorepo packages to inject nodePolyfills for those packages
  // if you are integrating out of this repo, you can remove this `optimizeDeps` config
  optimizeDeps: {
    include: ['@opcat-labs/opcat', '@opcat-labs/scrypt-ts-opcat', '@opcat-labs/cat-sdk'],
  },
  plugins: [react(), nodePolyfills()],
  define: {
    'process.env.NODE_DEBUG': 'false',
  }
})