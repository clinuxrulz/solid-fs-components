import { createSignal, type Component } from 'solid-js'
import { createFileSystem } from 'src/create-filesystem'
import { FileTree } from 'src/file-tree'
import './App.module.css'

const App: Component = () => {
  const [selected, setSelected] = createSignal<string>()

  const fs = createFileSystem<string>()
  fs.writeFile('index.ts', 'hallo')
  fs.mkdir('test')
  fs.writeFile('test/index.ts', 'hallo')
  fs.mkdir('test/test')
  fs.mkdir('test/test2')
  fs.writeFile('test/test/index.ts', 'hallo')

  return (
    <div
      style={{
        display: 'grid',
        'grid-template-columns': '100px 1fr',
        '--fs-indent-guides-color': 'red',
      }}
    >
      <FileTree fs={fs} selectedPath={selected()} onPathSelect={setSelected} />
    </div>
  )
}

export default App
