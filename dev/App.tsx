import { Split } from '@bigmistqke/solid-grid-split'
import { createSignal, onMount, type Component } from 'solid-js'
import { createFileSystem, DefaultIndentGuide, FileTree } from 'src'
import { TmTextarea } from 'tm-textarea/solid'
import styles from './App.module.css'

const App: Component = () => {
  const [selectedFile, setSelectedFile] = createSignal<string>('index0.ts')

  const fs = createFileSystem<string>()

  function mockData(parts: Array<string>) {
    if (parts.length > 5) return
    fs.mkdir(parts.join('/'))

    for (let i = 0; i < Math.floor(Math.random() * 3); i++) {
      const path = `${parts.join('/')}/index${i}.ts`
      fs.writeFile(path, `export const value = 'Hello World from ${path}'`)
    }

    for (let i = 0; i < Math.floor(Math.random() * 3 + 1); i++) {
      mockData([...parts, 'test' + i])
    }
  }

  mockData(['test'])
  for (let i = 0; i < 3; i++) {
    const path = `index${i}.ts`
    fs.writeFile(path, `export const value = 'Hello World from ${path}'`)
  }

  const grammar = () => {
    const _selected = selectedFile()
    if (_selected?.endsWith('css')) {
      return 'css'
    }
    if (_selected?.endsWith('html')) {
      return 'html'
    }
    return 'tsx'
  }

  const currentFile = () => {
    const _selectedFile = selectedFile()
    if (_selectedFile && fs.exists(_selectedFile)) {
      return fs.readFile(_selectedFile)
    }
    return ''
  }

  return (
    <Split class={styles.app}>
      <Split.Pane size="175px">
        <FileTree
          fs={fs}
          class={styles.custom}
          onSelection={paths => console.log('onSelection', paths)}
        >
          {dirEnt => {
            const [editable, setEditable] = createSignal(false)

            onMount(() => {
              if (dirEnt.focused && dirEnt.type === 'file') {
                setSelectedFile(dirEnt.path)
              }
            })

            return (
              <FileTree.DirEnt
                class={styles.dirEnt}
                style={{
                  background: dirEnt.selected ? '#484f6c' : 'none',
                }}
                onMouseDown={() => {
                  if (dirEnt.type === 'file') {
                    setSelectedFile(dirEnt.path)
                  }
                }}
                onDblClick={() => setEditable(true)}
                onKeyDown={e => {
                  if (e.code === 'Enter') {
                    setEditable(editable => !editable)
                  }
                  if (e.code === 'Space') {
                    if (dirEnt.type === 'dir') {
                      if (dirEnt.opened) {
                        dirEnt.close()
                      } else {
                        dirEnt.open()
                      }
                    } else {
                      setSelectedFile(dirEnt.path)
                    }
                  }
                }}
              >
                <FileTree.IndentGuides
                  guide={() => <DefaultIndentGuide color="white" width={15} />}
                />
                <FileTree.Opened
                  closed="-"
                  opened="+"
                  style={{ width: '15px', 'text-align': 'center' }}
                />
                <FileTree.Name
                  editable={editable()}
                  style={{ 'margin-left': dirEnt.type === 'file' ? '7.5px' : undefined }}
                  onBlur={() => setEditable(false)}
                />
              </FileTree.DirEnt>
            )
          }}
        </FileTree>
      </Split.Pane>
      <Split.Handle size="5px" style={{ background: 'lightgrey', cursor: 'ew-resize' }} />
      <Split.Pane size="1fr" style={{ display: 'grid', 'grid-template-rows': '1fr auto' }}>
        <TmTextarea
          value={currentFile()}
          grammar={grammar()}
          class={styles.textarea}
          theme="andromeeda"
          onInput={event => fs.writeFile(selectedFile()!, event.currentTarget.value)}
        />
        <input
          placeholder="p.ex fs.writeFile('test2.ts', 'Hello World!')"
          class={styles.input}
          onKeyDown={event => {
            if (event.code === 'Enter') {
              eval(event.currentTarget.value)
              event.currentTarget.value = ''
            }
          }}
        />
      </Split.Pane>
    </Split>
  )
}

export default App
