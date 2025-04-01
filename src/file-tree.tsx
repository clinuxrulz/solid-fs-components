import { Repeat } from '@solid-primitives/range'
import { ReactiveSet } from '@solid-primitives/set'
import clsx from 'clsx'
import { ComponentProps, createSelector, Index, JSX, mergeProps, Show, splitProps } from 'solid-js'
import { type FileSystem } from './create-file-system'
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
        indentGuides: JSX.Element
        layer: number
        onClick: (event: MouseEvent) => void
        path: string
        selected: boolean
      }): JSX.Element
      IndentGuide?(props: {
        count: number
        layer: number
        path: string
        type: 'dir' | 'file'
      }): JSX.Element
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
  const openedDirs = new ReactiveSet<string>()

  const isPathSelected = createSelector(() => treeProps.selectedPath)

  function IndentGuides(props: { layer: number; path: string; type: 'dir' | 'file' }) {
    return (
      <Repeat times={props.layer - 1}>
        {index => (
          <Components.IndentGuide
            path={props.path}
            layer={index}
            count={props.layer - 2}
            type={props.type}
          />
        )}
      </Repeat>
    )
  }

  function DirCell(props: { layer: number; path: string }) {
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
            collapsed={!openedDirs.has(props.path)}
            indentGuides={<IndentGuides layer={props.layer} path={props.path} type="dir" />}
            onClick={() => {
              if (openedDirs.has(props.path)) {
                openedDirs.delete(props.path)
              } else {
                openedDirs.add(props.path)
              }
            }}
            selected={isPathSelected(props.path)}
          />
        </Show>
        <Show when={props.layer === 0 || openedDirs.has(props.path)}>
          <Index each={childDirEnts()}>
            {dirEnt => {
              return <DirEnt layer={props.layer + 1} path={dirEnt().path} type={dirEnt().type} />
            }}
          </Index>
        </Show>
      </>
    )
  }

  function DirEnt(props: { layer: number; path: string; type: 'file' | 'dir' }) {
    return (
      <Show
        when={props.type === 'dir'}
        children={<DirCell layer={props.layer} path={props.path} />}
        fallback={
          <Components.File
            layer={props.layer}
            path={props.path}
            selected={isPathSelected(props.path)}
            onClick={() => treeProps.onPathSelect?.(props.path)}
            indentGuides={<IndentGuides layer={props.layer} path={props.path} type="file" />}
          />
        }
      />
    )
  }

  return (
    <div data-fs-tree class={clsx(styles.tree, treeProps.class)} {...rest}>
      <DirEnt path="" layer={0} type="dir" />
    </div>
  )
}

export function IndentGuide(props: { layer: number; count: number; type: 'file' | 'dir' }) {
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

export function Dir(
  props: Omit<ComponentProps<'button'>, 'style'> & {
    collapsed: boolean
    indentGuides: JSX.Element
    layer: number
    onClick: (event: MouseEvent) => void
    path: string
    selected: boolean
    style?: JSX.CSSProperties
    components?: {
      Prefix?(props: { collapsed: boolean }): JSX.Element
    }
  },
) {
  const [, rest] = splitProps(props, [
    'style',
    'class',
    'collapsed',
    'indentGuides',
    'layer',
    'onClick',
    'path',
    'selected',
    'components',
  ])
  const Components = mergeProps(
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
      class={clsx(styles.cell, props.class)}
      data-fs-cell="dir"
      aria-selected={props.selected || undefined}
      aria-collapsed={props.collapsed || undefined}
      style={{
        'grid-template-columns': `repeat(${props.layer}, var(--fs-indent-guide-width, 15px)) 1fr`,
        ...props.style,
      }}
      onClick={props.onClick}
      {...rest}
    >
      {props.indentGuides}
      <Components.Prefix collapsed={props.collapsed} />
      <span>{getNameFromPath(props.path)}</span>
    </button>
  )
}

export function File(props: {
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
