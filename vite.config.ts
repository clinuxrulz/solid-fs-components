import path from 'path'
import { defineConfig, normalizePath } from 'vite'
import cssClassnames from 'vite-plugin-css-classnames'
import dtsBundle from 'vite-plugin-dts-bundle-generator'
import { libInjectCss } from 'vite-plugin-lib-inject-css'
import solid from 'vite-plugin-solid'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    cssClassnames(),
    tsconfigPaths(),
    solid(),
    libInjectCss(),
    dtsBundle({ fileName: 'index.d.ts' }),
  ],
  server: { port: 3000 },
  build: {
    lib: {
      entry: {
        index: normalizePath(path.resolve(__dirname, 'src/index.ts')),
      },
      name: 'solid-fs-components',
      formats: ['es'],
    },
    minify: false,
    rollupOptions: {
      external: ['solid-js', 'solid-js/store', 'solid-js/web'],
      output: {
        globals: {
          'solid-js': 'SolidJS',
        },
      },
    },
  },
  css: {
    modules: {
      generateScopedName: '[name]__[local]___[hash:base64:5]',
    },
  },
})
