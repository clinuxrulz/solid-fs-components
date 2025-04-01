import { Repeat } from '@solid-primitives/range'
import {
  ComponentProps,
  createSelector,
  createSignal,
  Index,
  JSX,
  mergeProps,
  Show,
  splitProps,
} from 'solid-js'
import { type FileSystem } from './create-filesystem'
/** @ts-ignore */
import clsx from 'clsx'
import styles from './file-tree.module.css'
import { getNameFromPath } from './utils'

/**********************************************************************************/
/*                                                                                */
/*                                    File Tree                                   */
/*                                                                                */
/**********************************************************************************/

export function FileTree<T>(
  treeProps: ComponentProps<'div'> & {
    fs: FileSystem<T>
    selectedPath?: string
    onPathSelect?(path: string): void
    components?: {
      File?(props: { path: string; layer: number; indentGuides: JSX.Element }): JSX.Element
      Dir?(props: {
        collapsed: boolean
        hidden: boolean
        indentGuides: JSX.Element
        layer: number
        onClick: (event: MouseEvent) => void
        path: string
        selected: boolean
      }): JSX.Element
      IndentGuide?(props: { path: string; layer: number; count: number }): JSX.Element
    }
  },
) {
  const [, rest] = splitProps(treeProps, [
    'class',
    'components',
    'fs',
    'onPathSelect',
    'selectedPath',
  ])
  const Components = mergeProps(
    {
      File,
      Dir,
      IndentGuide,
    },
    treeProps.components,
  )
  const isPathSelected = createSelector(() => treeProps.selectedPath)

  function IndentGuides(props: { layer: number; path: string }) {
    return (
      <Repeat times={props.layer - 1}>
        {index => (
          <Components.IndentGuide path={props.path} layer={index} count={props.layer - 2} />
        )}
      </Repeat>
    )
  }

  function DirCell(props: { layer: number; path: string; hidden: boolean }) {
    const [collapsed, setCollapsed] = createSignal(true)
    const childDirEnts = () =>
      treeProps.fs
        .readdir(props.path, { withFileTypes: true })
        .sort((a, b) =>
          a.type === b.type ? (a.path < b.path ? -1 : 1) : a.type === 'dir' ? -1 : 1,
        )

    return (
      <>
        <Show when={props.path}>
          <Components.Dir
            layer={props.layer}
            path={props.path}
            collapsed={collapsed()}
            indentGuides={<IndentGuides layer={props.layer} path={props.path} />}
            onClick={() => setCollapsed(bool => !bool)}
            selected={isPathSelected(props.path)}
            hidden={props.hidden}
          />
        </Show>
        <Index each={childDirEnts()}>
          {dirEnt => {
            return (
              <DirEnt
                layer={props.layer + 1}
                path={dirEnt().path}
                type={dirEnt().type}
                hidden={props.layer !== 0 && (collapsed() || props.hidden)}
              />
            )
          }}
        </Index>
      </>
    )
  }

  function DirEnt(props: { layer: number; path: string; type: 'file' | 'dir'; hidden: boolean }) {
    return (
      <Show
        when={props.type === 'dir'}
        children={<DirCell layer={props.layer} path={props.path} hidden={props.hidden} />}
        fallback={
          <Components.File
            layer={props.layer}
            path={props.path}
            hidden={props.hidden}
            selected={isPathSelected(props.path)}
            onClick={() => treeProps.onPathSelect?.(props.path)}
            indentGuides={<IndentGuides layer={props.layer} path={props.path} />}
          />
        }
      />
    )
  }

  return (
    <div data-fs-tree class={clsx(styles.tree, treeProps.class)} {...rest}>
      <DirEnt path="" layer={0} type="dir" hidden={false} />
    </div>
  )
}

export function IndentGuide(props: { layer: number; count: number }) {
  return (
    <div
      data-fs-indent-guide={props.layer === props.count ? 'vertical' : 'connection'}
      style={{ position: 'relative' }}
    >
      <Show
        when={props.layer === props.count}
        fallback={
          <div
            style={{
              position: 'absolute',
              width: '100%',
              top: '0%',
              left: 'calc(50% - 0.5px)',
              'border-left': '1px solid var(--fs-indent-guide-color, black)',
              height: '100%',
            }}
          />
        }
      >
        <div
          style={{
            position: 'absolute',
            left: 'calc(50% - 0.5px)',
            width: 'calc(50% - 0.5px)',
            height: '50%',
            'border-left': '1px solid var(--fs-indent-guide-color, black)',
            'border-bottom': '1px solid var(--fs-indent-guide-color, black)',
            'border-bottom-left-radius': '2px',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 'calc(50% - 0.5px)',
            width: 'calc(50% - 0.5px)',
            'border-left': '1px solid var(--fs-indent-guide-color, black)',
            height: '100%',
          }}
        />
      </Show>
    </div>
  )
}

export function Dir(props: {
  collapsed: boolean
  hidden: boolean
  indentGuides: JSX.Element
  layer: number
  onClick: (event: MouseEvent) => void
  path: string
  selected: boolean
  components?: {
    Prefix?(props: { collapsed: boolean }): JSX.Element
  }
}) {
  const defaultProps = mergeProps(
    {
      Prefix: (props: { collapsed: boolean }) => (
        <span style={{ 'text-align': 'center', flex: '0 var(--fs-indent-guide-width, 15px)' }}>
          {props.collapsed ? '+' : '–'}
        </span>
      ),
    },
    () => props.components,
  )
  return (
    <button
      class={styles.cell}
      data-fs-cell="dir"
      data-fs-selected={props.selected || undefined}
      style={{
        display: props.hidden ? 'none' : undefined,
        'grid-template-columns': `repeat(${props.layer}, var(--fs-indent-guide-width, 15px)) 1fr`,
      }}
      onClick={props.onClick}
    >
      {props.indentGuides}
      <defaultProps.Prefix collapsed={props.collapsed} />

      <span>{getNameFromPath(props.path)}</span>
    </button>
  )
}

export function File(props: {
  hidden: boolean
  indentGuides: JSX.Element
  layer: number
  onClick: (event: MouseEvent) => void
  path: string
  selected: boolean
}) {
  return (
    <button
      class={styles.cell}
      data-fs-cell="file"
      data-fs-selected={props.selected || undefined}
      style={{
        display: props.hidden ? 'none' : undefined,
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
}
