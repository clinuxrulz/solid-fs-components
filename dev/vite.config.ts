import fs from 'fs/promises'
import path from 'node:path'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'
import solidPlugin from 'vite-plugin-solid'

const POSTFIX = '?raw-directory'

function rawDirectoryPlugin(): Plugin {
  console.log('THIS HAPPENS?')

  let isDev: boolean

  return {
    name: 'vite-plugin-bundle',
    config(_, { command }) {
      isDev = command === 'serve'
    },
    async load(id) {
      if (id.endsWith(`${POSTFIX}`)) {
        let path = id.replace(POSTFIX, '')
        const parts = path.split('/')
        if (parts[parts.length - 1]?.split('.').length) {
          if (!(parts[parts.length - 1] === '..' || parts[parts.length - 1] === '.')) {
            path = parts.slice(0, -1).join('/')
          }
        }

        console.log('path', id, path)

        const importPaths = []

        for await (const entry of fs.glob(`${path}/**/*`, {
          withFileTypes: true,
        })) {
          if (entry.isFile()) {
            entry
            importPaths.push(`.${entry.parentPath}/${entry.name}`.replace(path, ''))
          }
        }

        return `${importPaths
          .map((path, index) => `import source${index} from "${path}?raw"`)
          .join('\n')}
export default {
${importPaths.map((path, index) => ` "${path}": source${index}`).join(',\n')}
}`
      }
    },
  }
}

export default defineConfig({
  resolve: {
    alias: {
      src: path.resolve(__dirname, '../src'),
    },
  },
  plugins: [
    solidPlugin(),
    {
      name: 'Reaplace env variables',
      transform(code, id) {
        if (id.includes('node_modules')) {
          return code
        }
        return code
          .replace(/process\.env\.SSR/g, 'false')
          .replace(/process\.env\.DEV/g, 'true')
          .replace(/process\.env\.PROD/g, 'false')
          .replace(/process\.env\.NODE_ENV/g, '"development"')
          .replace(/import\.meta\.env\.SSR/g, 'false')
          .replace(/import\.meta\.env\.DEV/g, 'true')
          .replace(/import\.meta\.env\.PROD/g, 'false')
          .replace(/import\.meta\.env\.NODE_ENV/g, '"development"')
      },
    },
    rawDirectoryPlugin(),
  ],
  server: {
    port: 3000,
  },
  build: {
    target: 'esnext',
  },
})
