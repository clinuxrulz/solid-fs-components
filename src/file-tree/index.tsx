import { Key, keyArray } from '@solid-primitives/keyed'
import { Repeat } from '@solid-primitives/range'
import {
  type Accessor,
  batch,
  type ComponentProps,
  createContext,
  createEffect,
  createMemo,
  createRenderEffect,
  createSelector,
  createSignal,
  type JSX,
  mapArray,
  mergeProps,
  onCleanup,
  onMount,
  Show,
  splitProps,
  useContext,
} from 'solid-js'
import { createStore } from 'solid-js/store'
import { isMac, lastItem, PathUtils, type WrapEvent } from 'src/utils'
import { type FileSystem } from '../create-file-system'

interface DirEntBase {
  path: string
  indentation: number
  name: string
  select(): void
  shiftSelect(): void
  deselect(): void
  rename(path: string): void
  selected: boolean
}

interface File extends DirEntBase {
  type: 'file'
}

interface Dir extends DirEntBase {
  type: 'dir'
  open(): void
  close(): void
  opened: boolean
}

type DirEnt = File | Dir

/**********************************************************************************/
/*                                                                                */
/*                                    Contexts                                    */
/*                                                                                */
/**********************************************************************************/

interface FileTreeContext<T> {
  fs: Pick<FileSystem<T>, 'readdir' | 'rename' | 'exists'>
  base: string
  sort?(dirEnt1: DirEnt, dirEnt2: DirEnt): number
  openDir(path: string): void
  closeDir(path: string): void
  isDirOpened(path: string): boolean
  indentationFromPath(path: string): number
  getDirEntsOfDir(path: string): Array<DirEnt>
  resetSelection(): void
  moveSelection(path: string): void
  selectDirEnt(path: string): void
  shiftSelectDirEnt(path: string): void
  deselectDirEnt(path: string): void
  flatTree: Accessor<DirEnt[]>
}

const FileTreeContext = createContext<FileTreeContext<any>>()
export function useFileTree() {
  const context = useContext(FileTreeContext)
  if (!context) throw `FileTreeContext is undefined`
  return context
}

const DirEntContext = createContext<DirEnt>()
export function useDirEnt() {
  const context = useContext(DirEntContext)
  if (!context) throw `DirEntContext is undefined`
  return context
}

type IndentGuideKind = 'pipe' | 'tee' | 'elbow' | 'spacer'

const IndentGuideContext = createContext<IndentGuideKind>()
export function useIndentGuide() {
  const context = useContext(IndentGuideContext)
  if (!context) throw `IndentGuideContext is undefined`
  return context
}

/**********************************************************************************/
/*                                                                                */
/*                                    FileTree                                    */
/*                                                                                */
/**********************************************************************************/

export type FileTreeProps<T> = Pick<FileTreeContext<T>, 'fs'> &
  Partial<Pick<FileTreeContext<T>, 'base' | 'sort'>> &
  Omit<ComponentProps<'div'>, 'children' | 'onPointerUp'> & {
    onDragOver?(event: WrapEvent<DragEvent, HTMLDivElement>): void
    onDrop?(event: WrapEvent<DragEvent, HTMLDivElement>): void
    onSelection?(paths: string[]): void
    selection?: Array<string>
    children: (dirEnt: DirEnt, fileTree: FileTreeContext<T>) => JSX.Element
  }

export function FileTree<T>(props: FileTreeProps<T>) {
  const [config, rest] = splitProps(mergeProps({ base: '' }, props), ['fs', 'base'])

  // Selection DirEnts
  const [selectionRanges, setSelectionRanges] = createSignal<Array<[start: string, end?: string]>>(
    [],
    { equals: false },
  )

  // Selection methods
  function selectDirEnt(path: string) {
    setSelectionRanges(dirEnts => [...dirEnts, [path]])
  }

  function deselectDirEnt(path: string) {
    setSelectionRanges(
      pairs =>
        pairs
          .map(dirEnts => dirEnts.filter(dirEnt => dirEnt !== path))
          .filter(pair => pair.length > 0) as [string, string?][],
    )
  }

  function shiftSelectDirEnt(path: string) {
    setSelectionRanges(dirEnts => {
      if (dirEnts.length > 0) {
        dirEnts[dirEnts.length - 1] = [dirEnts[dirEnts.length - 1]![0], path]
        return [...dirEnts]
      }
      return [[path]]
    })
  }

  function resetSelection() {
    setSelectionRanges([])
  }

  const dirEntSelection = createMemo(() => {
    return selectionRanges()
      .flatMap(([start, end]) => {
        if (end) {
          const startIndex = flatTree().findIndex(dir => dir.path === start)
          const endIndex = flatTree().findIndex(dir => dir.path === end)

          return flatTree()
            .slice(Math.min(startIndex, endIndex), Math.max(startIndex, endIndex) + 1)
            .map(dirEnt => dirEnt.path)
        }
        return start
      })
      .sort((a, b) => (a < b ? -1 : 1))
  })

  const isDirEntSelected = createSelector(dirEntSelection, (path: string, dirs) =>
    dirs.includes(path),
  )

  // Call event handler with current selection
  createEffect(() => props.onSelection?.(dirEntSelection()))

  // Update selection from props
  createEffect(() => {
    batch(() => {
      if (!props.selection) return
      resetSelection()
      const ranges = props.selection
        .filter(path => props.fs.exists(path))
        .map(path => [path] as [string])
      setSelectionRanges(ranges)
    })
  })

  // Open/Close Dirs
  const [openedDirs, setOpenedDirs] = createSignal<Array<string>>(new Array(), {
    equals: false,
  })
  const isDirOpened = createSelector(openedDirs, (path: string, dirs) => dirs.includes(path))
  function closeDir(path: string) {
    setOpenedDirs(dirs => dirs.filter(dir => dir !== path))
  }
  function openDir(path: string) {
    setOpenedDirs(dirs => [...dirs, path])
  }

  // Record<Dir, Accessor<DirEnts>>
  const [dirEntsByDir, setDirEntsByDir] = createStore<Record<string, Accessor<Array<DirEnt>>>>({})

  function getDirEntsOfDir(path: string) {
    return dirEntsByDir[path]?.() || []
  }

  createEffect(
    mapArray(
      () => [config.base, ...openedDirs()],
      dirPath => {
        const unsortedDirEnts = createMemo(
          keyArray(
            () => props.fs.readdir(dirPath, { withFileTypes: true }),
            dirEnt => dirEnt.path,
            dirEnt => ({
              path: dirEnt().path,
              indentation: indentationFromPath(dirEnt().path),
              name: PathUtils.getName(dirEnt().path),
              get type() {
                return dirEnt().type
              },
              open() {
                openDir(dirEnt().path)
              },
              close() {
                closeDir(dirEnt().path)
              },
              get opened() {
                return isDirOpened(dirEnt().path)
              },
              select() {
                selectDirEnt(dirEnt().path)
              },
              deselect() {
                deselectDirEnt(dirEnt().path)
              },
              shiftSelect() {
                shiftSelectDirEnt(dirEnt().path)
              },
              get selected() {
                return isDirEntSelected(dirEnt().path)
              },
              rename(path: string) {
                props.fs.rename(dirEnt().path, path)
              },
            }),
          ),
        )

        const sortedDirEnts = createMemo(() =>
          unsortedDirEnts().toSorted(
            props.sort ??
              ((a, b) =>
                a.type !== b.type ? (a.type === 'dir' ? -1 : 1) : a.path < b.path ? -1 : 1),
          ),
        )

        setDirEntsByDir(dirPath, () => sortedDirEnts)
        onCleanup(() => setDirEntsByDir(dirPath, undefined!))

        // Remove path from opened paths if it ceases to fs.exist
        createRenderEffect(() => {
          if (!props.fs.exists(dirPath)) {
            setOpenedDirs(dirs => dirs.filter(dir => dir !== dirPath))
          }
        })
      },
    ),
  )

  // DirEnts as a flat list
  const flatTree = createMemo(() => {
    const list = new Array<DirEnt>()
    const stack = [config.base]
    while (stack.length > 0) {
      const path = stack.shift()!
      const dirEnts = getDirEntsOfDir(path)
      stack.push(
        ...dirEnts
          .filter(dirEnt => dirEnt.type === 'dir' && isDirOpened(dirEnt.path))
          .map(dir => dir.path),
      )
      list.splice(list.findIndex(dirEnt => dirEnt.path === path) + 1, 0, ...dirEnts)
    }
    return list
  })

  function indentationFromPath(path: string) {
    return path.split('/').length - config.base.split('/').length
  }

  function moveSelection(target: string) {
    const selection = dirEntSelection()

    // Validate if any of the selected paths are ancestor of the target path
    for (const selected of selection) {
      if (selected === target) {
        throw `Cannot move ${selected} into itself.`
      }
      if (PathUtils.isAncestor(target, selected)) {
        throw `Cannot move because ${selected} is ancestor of ${target}.`
      }
    }

    const existingPaths = new Array<{ newPath: string; oldPath: string }>()

    const transforms = selection
      .sort((a, b) => (a < b ? -1 : 1))
      .map((oldPath, index, arr) => {
        const ancestor = arr.slice(0, index).find(path => PathUtils.isAncestor(oldPath, path))

        const newPath = (
          ancestor
            ? // If the selection contains an ancestor of the current path
              // the path is renamed relative to the ancestor
              [target, lastItem(ancestor.split('/')), oldPath.replace(`${ancestor}/`, '')]
            : [target, lastItem(oldPath.split('/'))]
        )
          .filter(Boolean)
          .join('/')

        if (props.fs.exists(newPath)) {
          existingPaths.push({ oldPath, newPath })
        }

        return { oldPath, newPath, shouldRename: !ancestor }
      })

    if (existingPaths.length > 0) {
      throw `Paths already exist: ${existingPaths.map(({ newPath }) => newPath)}`
    }

    // TODO: this does assume that filesystem manipulations are immediately reflected
    batch(() => {
      // Rename the opened dirs (before they are cleaned up)
      setOpenedDirs(dirs =>
        dirs.map(dir => {
          const transform = transforms.find(({ oldPath }) => oldPath === dir)

          if (transform) {
            return transform.newPath
          }

          return dir
        }),
      )

      // Rename the dirEnts in the selection (before they are cleaned up)
      setSelectionRanges(() => transforms.map(({ newPath }) => [newPath]))

      // Rename the dirEnt in the fileSystem
      transforms.forEach(({ oldPath, newPath, shouldRename }) => {
        if (shouldRename) {
          props.fs.rename(oldPath, newPath)
        }
      })

      // Open the target-dir if it wasn't opened yet
      if (!isDirOpened(target)) {
        openDir(target)
      }
    })
  }

  const fileTreeContext: FileTreeContext<T> = mergeProps(config, {
    openDir,
    closeDir,
    indentationFromPath,
    isDirOpened,
    moveSelection,
    resetSelection,
    selectDirEnt,
    deselectDirEnt,
    shiftSelectDirEnt,
    getDirEntsOfDir,
    flatTree,
  })

  return (
    <div
      {...rest}
      onDragOver={event => {
        event.preventDefault()
        props.onDragOver?.(event)
      }}
      onDrop={event => {
        moveSelection(config.base)
        props.onDrop?.(event)
      }}
    >
      <FileTreeContext.Provider value={fileTreeContext}>
        <Key each={flatTree()} by={item => item.path}>
          {dirEnt => {
            return (
              <DirEntContext.Provider value={dirEnt()}>
                {props.children(dirEnt(), fileTreeContext)}
              </DirEntContext.Provider>
            )
          }}
        </Key>
      </FileTreeContext.Provider>
    </div>
  )
}

FileTree.DirEnt = function (
  props: Omit<
    ComponentProps<'button'>,
    'onDragStart' | 'onDragOver' | 'onDrop' | 'onPointerDown'
  > & {
    onDragOver?(event: WrapEvent<DragEvent, HTMLButtonElement>): void
    onDragStart?(event: WrapEvent<DragEvent, HTMLButtonElement>): void
    onDrop?(event: WrapEvent<DragEvent, HTMLButtonElement>): void
    onMove?(parent: string): void
    onPointerDown?(event: WrapEvent<PointerEvent, HTMLButtonElement>): void
    onPointerUp?(event: WrapEvent<PointerEvent, HTMLButtonElement>): void
  },
) {
  const config = mergeProps({ draggable: true }, props)
  const fileTree = useFileTree()
  const dirEnt = useDirEnt()

  const handlers = {
    onPointerDown(event: WrapEvent<PointerEvent, HTMLButtonElement>) {
      if (event.shiftKey) {
        dirEnt.shiftSelect()
      } else {
        const selected = dirEnt.selected
        if (!selected) {
          batch(() => {
            if (isMac ? !event.metaKey : !event.ctrlKey) {
              fileTree.resetSelection()
            }
            dirEnt.select()
          })
        }
      }
      props.onPointerDown?.(event)
    },
    onPointerUp(event: WrapEvent<PointerEvent, HTMLButtonElement>) {
      if (dirEnt.type === 'dir') {
        if (fileTree.isDirOpened(dirEnt.path)) {
          dirEnt.close()
        } else {
          dirEnt.open()
        }
      }
      props.onPointerUp?.(event)
    },
    onDragOver: (event: WrapEvent<DragEvent, HTMLButtonElement>) => {
      event.preventDefault()
      props.onDragOver?.(event)
    },
    onDrop: (event: WrapEvent<DragEvent, HTMLButtonElement>) => {
      event.preventDefault()
      event.stopPropagation()

      if (dirEnt.type === 'dir') {
        fileTree.moveSelection(dirEnt.path)
      } else {
        const parent = dirEnt.path.split('/').slice(0, -1).join('/')
        fileTree.moveSelection(parent)
      }

      props.onDrop?.(event)
    },
  }

  return (
    <Show
      when={dirEnt.type === 'dir'}
      fallback={<button {...config} {...handlers} />}
      children={_ => (
        <Show when={dirEnt.path}>
          <button {...config} {...handlers}>
            {props.children}
          </button>
        </Show>
      )}
    />
  )
}

FileTree.IndentGuides = function (props: { guide: (type: IndentGuideKind) => JSX.Element }) {
  const dirEnt = useDirEnt()
  const fileTree = useFileTree()

  function isLastChild(path: string) {
    const parentPath = PathUtils.getParent(path)

    if (parentPath === fileTree.base) {
      return false
    }

    const dirEnts = fileTree.getDirEntsOfDir(parentPath)
    const index = dirEnts.findIndex(dirEnt => dirEnt.path === path)

    return !dirEnts[index + 1]
  }

  function getAncestorAtLevel(index: number) {
    return dirEnt.path
      .split('/')
      .slice(0, index + 2)
      .join('/')
  }

  function getGuideKind(index: number) {
    const isLastGuide = dirEnt.indentation - index === 1

    return isLastGuide && isLastChild(dirEnt.path)
      ? 'elbow'
      : isLastChild(getAncestorAtLevel(index))
      ? 'spacer'
      : isLastGuide
      ? 'tee'
      : 'pipe'
  }

  return (
    <Repeat times={dirEnt.indentation}>
      {index => {
        const kind = getGuideKind(index)
        return (
          <IndentGuideContext.Provider value={kind}>
            {props.guide(kind)}
          </IndentGuideContext.Provider>
        )
      }}
    </Repeat>
  )
}

FileTree.Opened = function (
  props: ComponentProps<'span'> & {
    opened: JSX.Element
    closed: JSX.Element
  },
) {
  const [, rest] = splitProps(props, ['closed', 'opened'])
  const dirEnt = useDirEnt()
  const fileTree = useFileTree()
  return (
    <Show when={dirEnt.type === 'dir'}>
      <span {...rest}>
        <Show when={fileTree.isDirOpened(dirEnt.path)} fallback={props.opened}>
          {props.closed}
        </Show>
      </span>
    </Show>
  )
}

FileTree.Name = function (props: {
  editable?: boolean
  style?: JSX.CSSProperties
  class?: string
  onBlur?(event: WrapEvent<FocusEvent, HTMLInputElement>): void
}) {
  const [, rest] = splitProps(props, ['editable', 'style'])
  const dirEnt = useDirEnt()
  const fileTree = useFileTree()

  function rename(element: HTMLInputElement) {
    const newPath = [...dirEnt.path.split('/').slice(0, -1), element.value].join('/')

    if (newPath === dirEnt.path) {
      return
    }

    if (fileTree.fs.exists(newPath)) {
      element.value = dirEnt.path
      throw `Path ${newPath} already exists.`
    }

    dirEnt.rename(newPath)
    fileTree.resetSelection()
    fileTree.selectDirEnt(newPath)
  }

  return (
    <Show
      when={props.editable}
      fallback={
        <span class={props.class} style={props.style}>
          {dirEnt.name}
        </span>
      }
    >
      <input
        ref={element => {
          onMount(() => {
            element.focus()
            const value = element.value
            const dotIndex = value.indexOf('.')
            const end = dotIndex === -1 ? value.length : dotIndex
            element.setSelectionRange(0, end)
          })
        }}
        class={props.class}
        style={{ all: 'unset', ...props.style }}
        value={dirEnt.name}
        onKeyDown={event => {
          if (event.code === 'Enter') {
            rename(event.currentTarget)
          }
        }}
        onBlur={event => {
          rename(event.currentTarget)
          props.onBlur?.(event)
        }}
      />
    </Show>
  )
}
