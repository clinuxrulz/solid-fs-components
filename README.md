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

### Simple Example

```tsx
import { FileTree, createFileSystem } from '@bigmistqke/solid-fs-components'

export default App(){
  const [selected, setSelected] = createSignal('index.ts')
  const fs = createFileSystem()
  fs.writeFile('index.ts', 'export const sum = (a: number, b: number) => a + b')
  return <FileTree fs={fs} selected={selected} onSelect={setSelected} />
}
```

Style with css

```css
[data-fs-tree] {
  --fs-indent-guide-color: rgb(160, 160, 160);
  --fs-indent-guide-width: 15px;
  --fs-cell-height: 25px;
}

[data-fs-cell]:hover {
  background-color: rgb(244, 244, 244);
}

[data-fs-cell]:focus {
  outline: none;
  border-right: 5px solid rgb(160, 160, 160);
  background-color: rgb(244, 244, 244);
}

[data-fs-selected] {
  text-decoration: underline;
}
```

### Overwrite Internal Components

```tsx
import { FileTree, createFileSystem, Dir } from '@bigmistqke/solid-fs-components'
import { CustomFile, CustomIndentGuide, CollapsedIcon, ExtendedIcon } from "./components"

export default App(){
  const [selected, setSelected] = createSignal('index.ts')
  const fs = createFileSystem()
  fs.writeFile('index.ts', 'export const sum = (a: number, b: number) => a + b')

  return (
    <FileTree
      fs={fs}
      selected={selected()}
      onSelect={setSelected}
      sort={(a, b) =>
        a.type === b.type ? (a.path < b.path ? 1 : -1) : a.type === 'dir' ? -1 : 1
      }
      components={{
        IndentGuide: CustomIndentGuide,
        File(props){
          return (
            <button
              data-fs-cell="file"
              data-fs-selected={props.selected || undefined}
              style={{
                'grid-template-columns': `repeat(${
                  props.layer - 1
                }, var(--fs-indent-guide-width, 15px)) 1fr`,
              }}
              onClick={props.onClick}
            >
              {props.indentGuides}
              <div style={{ 'padding-left': '7.5px' }}>{getNameFromPath(props.path)}</div>
            </button>
          )
        },
        Dir(props) {
          return (
            <Dir
              {...props}
              components={{
                Indicator: props => (
                  <div
                    style={{
                      display: 'flex',
                      'align-items': 'center',
                      padding: '2px',
                    }}
                  >
                    {props.collapsed ? (
                      <CollapsedIcon>
                    ) : (
                      <ExtendedIcon>
                    )}
                  </div>
                )
              }}
            />
          )
        }
      }}
    />
  )
}
```
