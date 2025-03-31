import { Repeat } from '@solid-primitives/range'
import {
  createEffect,
  createSelector,
  createSignal,
  Index,
  JSX,
  Match,
  ParentProps,
  Show,
  Switch,
} from 'solid-js'
import { type FileSystem } from './create-filesystem'
import { getNameFromPath } from './utils'

/**********************************************************************************/
/*                                                                                */
/*                                    File Tree                                   */
/*                                                                                */
/**********************************************************************************/

export function FileTree<T>(treeProps: {
  fs: FileSystem<T>
  selectedPath?: string
  onPathSelect?(path: string): void
  renderFile?(path: string, value: T): JSX.Element
  renderDir?(path: string): JSX.Element
}) {
  const isPathSelected = createSelector(() => treeProps.selectedPath)

  function IndentGuides(props: { layer: number; count: number }) {
    return (
      <>
        <Switch>
          <Match when={props.layer !== props.count}>
            <div data-fs-indent-guides="vertical" style={{ position: 'relative' }}>
              <div
                style={{
                  position: 'absolute',
                  top: '0%',
                  left: '50%',
                  width: '100%',
                  'border-left': '1px solid var(--fs-indent-guides-color, black)',
                  height: '100%',
                }}
              />
            </div>
          </Match>
          <Match when={props.layer === props.count}>
            <div data-fs-indent-guides="connection" style={{ position: 'relative' }}>
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  width: '50%',
                  height: '50%',
                  'border-left': '1px solid var(--fs-indent-guides-color, black)',
                  'border-bottom': '1px solid var(--fs-indent-guides-color, black)',
                  'border-bottom-left-radius': '2px',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  width: '50%',
                  'border-left': '1px solid var(--fs-indent-guides-color, black)',
                  height: '100%',
                }}
              />
            </div>
          </Match>
        </Switch>
      </>
    )
  }

  function Cell(
    props: ParentProps<{
      type: 'file' | 'dir'
      layer: number
      path: string
      onClick: (event: MouseEvent) => void
    }>,
  ) {
    return (
      <button
        data-fs-cell={props.type}
        data-fs-cell-selected={isPathSelected(props.path)}
        style={{
          display: 'grid',
          'grid-template-columns': `repeat(${props.layer - 1}, 15px) 1fr`,
        }}
        onClick={props.onClick}
      >
        <Repeat times={props.layer - 1}>
          {index => <IndentGuides layer={index} count={props.layer - 2} />}
        </Repeat>
        {props.children}
      </button>
    )
  }

  function Dir(props: { layer: number; path: string }) {
    const [collapsed, setCollapsed] = createSignal(false)
    const [childDirEnts, setChildDirEnts] = createSignal<
      {
        type: 'dir' | 'file'
        path: string
      }[]
    >([])

    createEffect(() => {
      setChildDirEnts(
        treeProps.fs
          .readdir(props.path, { withFileTypes: true })
          .sort((a, b) =>
            a.type === b.type ? (a.path < b.path ? -1 : 1) : a.type === 'dir' ? -1 : 1,
          ),
      )
    })

    return (
      <>
        <Show when={props.path}>
          <Cell
            type="dir"
            layer={props.layer}
            path={props.path}
            onClick={() => {
              setCollapsed(collapsed => !collapsed)
              treeProps.onPathSelect?.(props.path)
            }}
          >
            <div style={{ display: 'flex' }}>
              <span style={{ 'text-align': 'center', flex: '0 15px' }}>
                {collapsed() ? '+' : '-'}
              </span>
              <span style={{ flex: 1 }}>{getNameFromPath(props.path)}</span>
            </div>
          </Cell>
        </Show>
        <Show when={!collapsed()}>
          <Index each={childDirEnts()}>
            {dirEnt => {
              return <DirEnt layer={props.layer + 1} path={dirEnt().path} type={dirEnt().type} />
            }}
          </Index>
        </Show>
      </>
    )
  }

  function File(props: { layer: number; path: string }) {
    return (
      <Cell
        type="file"
        layer={props.layer}
        path={props.path}
        onClick={() => treeProps.onPathSelect?.(props.path)}
      >
        <div>{getNameFromPath(props.path)}</div>
      </Cell>
    )
  }

  function DirEnt(props: { layer: number; path: string; type: 'file' | 'dir' }) {
    return (
      <Show when={props.type === 'dir'} fallback={<File layer={props.layer} path={props.path} />}>
        <Dir layer={props.layer} path={props.path} />
      </Show>
    )
  }

  return (
    <div style={{ display: 'grid' }}>
      <DirEnt path="" layer={0} type="dir" />
    </div>
  )
}
