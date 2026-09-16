import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Foundry loads `dist/blood-oracle.js` as an ES module and `dist/blood-oracle.css`
// as a stylesheet. React is bundled in rather than externalised: Foundry provides
// no module resolution for bare specifiers, so everything must ship in one file.
export default defineConfig({
  plugins: [react()],
  // Vite's library mode leaves `process.env.NODE_ENV` in place. There is no
  // `process` in the browser, so React would throw on load — and without this
  // define it also bundles its development build, roughly quadrupling the size.
  define: {
    'process.env.NODE_ENV': JSON.stringify('production')
  },
  // Note: Vite's `esbuild.keepNames` applies to the transform step, not the
  // minify step, so it does not protect class names here. The sheet class pins
  // its own name instead — see src/sheet/blood-oracle-sheet.js.
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Foundry runs on a modern Chromium; no legacy transpilation needed.
    target: 'es2022',
    // Minified for size; the sourcemap keeps it debuggable in Foundry's devtools.
    minify: 'esbuild',
    sourcemap: true,
    lib: {
      entry: 'src/main.js',
      formats: ['es'],
      fileName: () => 'blood-oracle.js'
    },
    rollupOptions: {
      output: {
        // Vite would otherwise emit `style.css`; module.json needs a stable name.
        assetFileNames: (asset) =>
          asset.names?.[0]?.endsWith('.css') || asset.name?.endsWith('.css')
            ? 'blood-oracle.css'
            : '[name][extname]'
      }
    }
  }
})
