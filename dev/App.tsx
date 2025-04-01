import { Split } from '@bigmistqke/solid-grid-split'
import { createSignal, Show, type Component } from 'solid-js'
import { createFileSystem, Dir, FileTree } from 'src'
import { TmTextarea } from 'tm-textarea/solid'
import styles from './App.module.css'

const App: Component = () => {
  const [selected, setSelected] = createSignal<string>('index0.ts')

  const fs = createFileSystem<string>()

  function mockData(parts: Array<string>) {
    if (parts.length > 5) return
    fs.mkdir(parts.join('/'))

    for (let i = 0; i < 3; i++) {
      const path = `${parts.join('/')}/index${i}.ts`
      fs.writeFile(path, `export const value = 'Hello World from ${path}'`)
    }

    for (let i = 0; i < 3; i++) {
      mockData([...parts, 'test' + i])
    }
  }

  mockData(['test'])
  for (let i = 0; i < 3; i++) {
    const path = `index${i}.ts`
    fs.writeFile(path, `export const value = 'Hello World from ${path}'`)
  }

  const grammar = () => {
    const _selected = selected()
    if (_selected?.endsWith('css')) {
      return 'css'
    }
    if (_selected?.endsWith('html')) {
      return 'html'
    }
    return 'tsx'
  }

  return (
    <Split class={styles.app}>
      <Split.Pane size="250px">
        <FileTree
          class={styles.default}
          fs={fs}
          selectedPath={selected()}
          onPathSelect={setSelected}
        />
      </Split.Pane>
      <Split.Handle size="5px" style={{ background: 'lightgrey', cursor: 'ew-resize' }} />
      <Split.Pane size="250px">
        <FileTree
          fs={fs}
          class={styles.custom}
          selectedPath={selected()}
          onPathSelect={setSelected}
          components={{
            IndentGuide(props) {
              return (
                <div
                  data-fs-indent-guide={props.layer === props.count ? 'vertical' : 'connection'}
                  style={{ position: 'relative' }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      width: '100%',
                      top: '0%',
                      left: 'calc(50% - 0.5px)',
                      'border-left': '1px solid var(--fs-indent-guide-color)',
                      height: '100%',
                    }}
                  />
                  <Show when={props.type === 'dir' && props.layer === props.count}>
                    <div
                      class={styles.dirIndentGuide}
                      style={{
                        position: 'absolute',
                        transform: 'translate(-50%,-50%)',
                        width: '5px',
                        left: '50%',
                        top: '50%',
                        height: '5px',
                        'border-radius': '2.5px',
                        background: 'white',
                      }}
                    />
                  </Show>
                </div>
              )
            },
            Dir(props) {
              return (
                <Dir
                  {...props}
                  components={{
                    Prefix: props => (
                      <div
                        style={{
                          display: 'flex',
                          'align-items': 'center',
                          padding: '2px',
                        }}
                      >
                        {props.collapsed ? (
                          <svg
                            style={{ 'aspect-ratio': '1/1' }}
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 320 512"
                          >
                            <path d="M310.6 233.4c12.5 12.5 12.5 32.8 0 45.3l-192 192c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L242.7 256 73.4 86.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l192 192z" />
                          </svg>
                        ) : (
                          <svg
                            style={{ 'aspect-ratio': '1/1' }}
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 512 512"
                          >
                            <path d="M233.4 406.6c12.5 12.5 32.8 12.5 45.3 0l192-192c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L256 338.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l192 192z" />
                          </svg>
                        )}
                      </div>
                    ),
                  }}
                />
              )
            },
          }}
        />
      </Split.Pane>
      <Split.Handle size="5px" style={{ background: 'lightgrey', cursor: 'ew-resize' }} />
      <Split.Pane size="1fr" style={{ display: 'grid', 'grid-template-rows': '1fr auto' }}>
        <TmTextarea
          value={selected() ? fs.readFile(selected()!) : ''}
          grammar={grammar()}
          class={styles.textarea}
          theme="andromeeda"
          onInput={event => fs.writeFile(selected()!, event.currentTarget.value)}
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
