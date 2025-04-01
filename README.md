<p>
  <img width="100%" src="https://assets.solidjs.com/banner?type=solid-fs-components&background=tiles&project=%20" alt="solid-fs-components">
</p>

# solid-fs-components

[![pnpm](https://img.shields.io/badge/maintained%20with-pnpm-cc00ff.svg?style=for-the-badge&logo=pnpm)](https://pnpm.io/)

headless components for visualizing reactive fs.

## Quick start

Install it:

```bash
npm i @bigmistqke/solid-fs-components
# or
yarn add @bigmistqke/solid-fs-components
# or
pnpm add @bigmistqke/solid-fs-components
```

Use it:

```tsx
import { FileTree, createFileSystem } from '@bigmistqke/solid-fs-components'

export default App(){
  const fs = createFileSystem()
  fs.writeFile('index.ts', 'export const sum = (a: number, b: number) => a + b')
  return <FileTree fs={fs} />
}
```
