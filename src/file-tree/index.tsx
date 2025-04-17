import { Key, keyArray } from '@solid-primitives/keyed'
import { Repeat } from '@solid-primitives/range'
import {
  type Accessor,
  batch,
  type ComponentProps,
  createComputed,
  createContext,
  createEffect,
  createMemo,
  createRenderEffect,
  createSelector,
  createSignal,
  type JSX,
  mapArray,
  mergeProps,
  on,
  onCleanup,
  onMount,
  Show,
  splitProps,
  untrack,
  useContext,
} from 'solid-js'
import { createStore } from 'solid-js/store'
import { CTRL_KEY, Overwrite, PathUtils, type WrapEvent } from 'src/utils'
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
  focus(): void
  blur(): void
  focused: boolean
}

interface File extends DirEntBase {
  type: 'file'
}

interface Dir extends DirEntBase {
  type: 'dir'
  expand(): void
  collapse(): void
  expanded: boolean
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
  getDirEntsOfDir(path: string): Array<DirEnt>
  // Expand/Collapse
  expandDir(path: string): void
  collapseDir(path: string): void
  isDirExpanded(path: string): boolean
  // Selection
  resetSelectedDirEnts(): void
  moveSelectedDirEnts(path: string): void
  selectDirEnt(path: string): void
  shiftSelectDirEnt(path: string): void
  deselectDirEnt(path: string): void
  // Focus
  focusDirEnt(path: string): void
  blurDirEnt(path: string): void
  isDirEntFocused(path: string): boolean
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

const DirEntIdContext = createContext<{ id: number, }>()
export function useDirEntId() {
  const context = useContext(DirEntIdContext)
  if (!context) throw `DirEntIdContext is undefined`
  return context
}

type IndentGuideKind = 'pipe' | 'tee' | 'elbow' | 'spacer'

const IndentGuideContext = createContext<Accessor<IndentGuideKind>>()
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

export type FileTreeProps<T> = Overwrite<
  ComponentProps<'div'>,
  {
    base?: string
    children: (dirEnt: DirEnt, fileTree: FileTreeContext<T>) => JSX.Element
    fs: Pick<FileSystem<T>, 'readdir' | 'rename' | 'exists'>
    onDragOver?(event: WrapEvent<DragEvent, HTMLDivElement>): void
    onDrop?(event: WrapEvent<DragEvent, HTMLDivElement>): void
    onRename?(oldPath: string, newPath: string): void
    onSelection?(paths: string[]): void
    selection?: Array<string>
    sort?(dirEnt1: DirEnt, dirEnt2: DirEnt): number
  }
>

export function FileTree<T>(props: FileTreeProps<T>) {
  const [config, rest] = splitProps(mergeProps({ base: '' }, props), ['fs', 'base'])

  // Focused DirEnt
  const [focusedDirEnt, setFocusedDirEnt] = createSignal<string | undefined>()
  const isDirEntFocused = createSelector(focusedDirEnt)

  function focusDirEnt(path: string) {
    setFocusedDirEnt(path)
  }
  function blurDirEnt(path: string) {
    if (focusedDirEnt() === path) {
      setFocusedDirEnt()
    }
  }

  // Selected DirEnts
  const [selectedDirEntRanges, setSelectedDirEntRanges] = createSignal<
    Array<[start: string, end?: string]>
  >([], { equals: false })
  const selectedDirEnts = createMemo(() => {
    return selectedDirEntRanges()
      .flatMap(([start, end]) => {
        if (end) {
          const startIndex = flatTree().findIndex(dir => dir.dirEnt.path === start)
          const endIndex = flatTree().findIndex(dir => dir.dirEnt.path === end)

          return flatTree()
            .slice(Math.min(startIndex, endIndex), Math.max(startIndex, endIndex) + 1)
            .map(dirEnt => dirEnt.dirEnt.path)
        }
        return start
      })
      .sort((a, b) => (a < b ? -1 : 1))
  })
  const isDirEntSelected = createSelector(selectedDirEnts, (path: string, dirs) =>
    dirs.includes(path),
  )

  // Selection-methods
  function selectDirEnt(path: string) {
    setSelectedDirEntRanges(dirEnts => [...dirEnts, [path]])
  }
  function deselectDirEnt(path: string) {
    setSelectedDirEntRanges(
      pairs =>
        pairs
          .map(dirEnts => dirEnts.filter(dirEnt => dirEnt !== path))
          .filter(pair => pair.length > 0) as [string, string?][],
    )
  }
  function shiftSelectDirEnt(path: string) {
    setSelectedDirEntRanges(dirEnts => {
      if (dirEnts.length > 0) {
        dirEnts[dirEnts.length - 1] = [dirEnts[dirEnts.length - 1]![0], path]
        return [...dirEnts]
      }
      return [[path]]
    })
  }
  function resetSelectedDirEnts() {
    setSelectedDirEntRanges([])
  }

  // Call event handler with current selection
  createEffect(() => props.onSelection?.(selectedDirEnts()))

  // Update selection from props
  createEffect(() => {
    batch(() => {
      if (!props.selection) return
      setSelectedDirEntRanges(
        props.selection.filter(path => props.fs.exists(path)).map(path => [path] as [string]),
      )
    })
  })

  // Expand/Collapse Dirs
  const [expandedDirs, setExpandedDirs] = createSignal<Array<string>>(new Array(), {
    equals: false,
  })
  const isDirExpanded = createSelector(expandedDirs, (path: string, expandedDirs) =>
    expandedDirs.includes(path),
  )

  function collapseDir(path: string) {
    setExpandedDirs(dirs => dirs.filter(dir => dir !== path))
  }
  function expandDir(path: string) {
    if (path !== config.base && !expandedDirs().includes(path)) {
      setExpandedDirs(dirs => [...dirs, path])
    }
  }

  // Record<Dir, Accessor<DirEnts>>
  const [dirEntsByDir, setDirEntsByDir] = createStore<Record<string, Accessor<Array<DirEnt>>>>({})

  function getDirEntsOfDir(path: string) {
    return dirEntsByDir[path]?.() || []
  }

  createEffect(
    mapArray(
      () => [config.base, ...expandedDirs()],
      dirPath => {
        const unsortedDirEnts = createMemo<Array<Dir | File>>(
          keyArray(
            () => props.fs.readdir(dirPath, { withFileTypes: true }),
            dirEnt => dirEnt.path,
            dirEnt => {
              const base: DirEntBase = {
                path: dirEnt().path,
                indentation: getIndentationFromPath(dirEnt().path),
                name: PathUtils.getName(dirEnt().path)!,
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
                rename(newPath: string) {
                  renameDirEnt(dirEnt().path, newPath)
                },
                focus() {
                  focusDirEnt(dirEnt().path)
                },
                blur() {
                  blurDirEnt(dirEnt().path)
                },
                get focused() {
                  return isDirEntFocused(dirEnt().path)
                },
              }

              return mergeProps(base, () =>
                dirEnt().type === 'dir'
                  ? {
                      type: 'dir' as const,
                      expand() {
                        expandDir(dirEnt().path)
                      },
                      collapse() {
                        collapseDir(dirEnt().path)
                      },
                      get expanded() {
                        return isDirExpanded(dirEnt().path)
                      },
                    }
                  : { type: 'file' as const },
              )
            },
          ),
        )

        const sortedDirEnts = createMemo(() =>
          unsortedDirEnts().toSorted(
            props.sort ??
              ((a, b) => {
                if (a.type !== b.type) {
                  return a.type === 'dir' ? -1 : 1
                }
                return a.path.toLowerCase() < b.path.toLowerCase() ? -1 : 1
              }),
          ),
        )

        setDirEntsByDir(dirPath, () => sortedDirEnts)
        onCleanup(() => setDirEntsByDir(dirPath, undefined!))

        // Remove path from opened paths if it ceases to fs.exist
        createRenderEffect(() => {
          if (!props.fs.exists(dirPath)) {
            setExpandedDirs(dirs => dirs.filter(dir => dir !== dirPath))
          }
        })
      },
    ),
  )

  // ID Generation Middleware
  let beforeRename: (oldPath: string, newPath: string) => void;
  let obtainId: (path: string) => number;
  let freezeId: (id: number) => void;
  {
    let allocId: () => number;
    let disposeId: (id: number) => void;
    {
      let nextId = 0;
      let freeIds: number[] = [];
      allocId = () => {
        return freeIds.pop() ?? nextId++;
      };
      disposeId = (id: number) => {
        freeIds.push(id);
      };
    }
    type Node = {
      id: number,
      refCount: number,
    };
    let nodeMap = new Map<string, Node>();
    let idToPathMap = new Map<number, string>();
    beforeRename = (oldPath: string, newPath: string) => {
      let node = nodeMap.get(oldPath);
      if (node == undefined) {
        return;
      }
      nodeMap.delete(oldPath);
      nodeMap.set(newPath, node);
      idToPathMap.set(node.id, newPath);
    };
    obtainId = (path: string): number => {
      {
        let node = nodeMap.get(path);
        if (node != undefined) {
          node.refCount++;
          onCleanup(() => {
            queueMicrotask(() => {
              node.refCount--;
              if (node.refCount == 0) {
                disposeId(node.id);
                nodeMap.delete(path);
                idToPathMap.delete(node.id);
              }
            });
          });
          return node.id;
        }
      }
      let node = {
        id: allocId(),
        refCount: 1,
      };
      nodeMap.set(path, node);
      idToPathMap.set(node.id, path);
      onCleanup(() => {
        queueMicrotask(() => {
          node.refCount--;
          if (node.refCount == 0) {
            disposeId(node.id);
            nodeMap.delete(path);
            idToPathMap.delete(node.id);
          }
        });
      });
      return node.id;
    };
    freezeId = (id: number) => {
      let path = idToPathMap.get(id);
      if (path == undefined) {
        return;
      }
      let node = nodeMap.get(path);
      if (node != undefined) {
        node.refCount++;
        onCleanup(() => {
          queueMicrotask(() => {
            node.refCount--;
            if (node.refCount == 0) {
              disposeId(node.id);
              nodeMap.delete(path);
              idToPathMap.delete(node.id);
            }
          });
        });
      }
    };
  }

  // Freeze ID numbers for selected entries
  createComputed(on(
    selectedDirEnts,
    (selectedDirEnts2) => {
      for (let path in selectedDirEnts2) {
        let id = obtainId(path);
        freezeId(id);
      }
    },
  ));

  // DirEnts as a flat list
  const flatTree = createMemo(() => {
    const list = new Array<{ id: number, dirEnt: DirEnt, }>()
    const stack = [config.base]
    while (stack.length > 0) {
      const path = stack.shift()!
      const dirEnts = getDirEntsOfDir(path).map((dirEnt) => ({ id: obtainId(dirEnt.path), dirEnt, }));
      stack.push(
        ...dirEnts
          .filter(dirEnt => dirEnt.dirEnt.type === 'dir' && isDirExpanded(dirEnt.dirEnt.path))
          .map(dir => dir.dirEnt.path),
      )
      list.splice(list.findIndex(dirEnt => dirEnt.dirEnt.path === path) + 1, 0, ...dirEnts)
    }
    return list
  })

  function getIndentationFromPath(path: string) {
    return path.split('/').length - config.base.split('/').length
  }

  function renameDirEnt(oldPath: string, newPath: string) {
    batch(() => {
      beforeRename(oldPath, newPath);
      props.fs.rename(oldPath, newPath)
      props.onRename?.(oldPath, newPath)
      setExpandedDirs(openedDirs => {
        return openedDirs.map(openedDir => {
          if (openedDir === oldPath) {
            return newPath
          }
          return PathUtils.rebase(openedDir, oldPath, newPath)
        })
      })
      setSelectedDirEntRanges(ranges => {
        return ranges.map(([start, end]) => {
          start = PathUtils.rebase(start, oldPath, newPath)
          if (end) {
            return [start, PathUtils.rebase(end, oldPath, newPath)]
          }
          return [start]
        })
      })
      focusDirEnt(newPath)
    })
  }

  function moveSelectedDirEnts(target: string) {
    const selection = selectedDirEnts()

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
      .sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1))
      .map((oldPath, index, arr) => {
        const ancestor = arr.slice(0, index).find(path => PathUtils.isAncestor(oldPath, path))

        const newPath = (
          ancestor
            ? // If the selection contains an ancestor of the current path
              // the path is renamed relative to the ancestor
              [target, PathUtils.getName(ancestor), oldPath.replace(`${ancestor}/`, '')]
            : [target, PathUtils.getName(oldPath)]
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

    // Apply transforms
    batch(() => {
      // Rename the opened dirs (before they are cleaned up)
      setExpandedDirs(dirs =>
        dirs.map(dir => {
          const transform = transforms.find(({ oldPath }) => oldPath === dir)

          if (transform) {
            return transform.newPath
          }

          return dir
        }),
      )

      // Rename the dirEnts in the selection (before they are cleaned up)
      setSelectedDirEntRanges(() => transforms.map(({ newPath }) => [newPath]))

      // Rename the dirEnt in the fileSystem
      transforms.forEach(({ oldPath, newPath, shouldRename }) => {
        if (!shouldRename) return
        renameDirEnt(oldPath, newPath)
      })

      // Expand the target-dir (if it wasn't opened yet)
      if (!isDirExpanded(target)) {
        expandDir(target)
      }
    })
  }

  const fileTreeContext: FileTreeContext<T> = {
    get fs() {
      return config.fs
    },
    get base() {
      return config.base
    },
    expandDir,
    collapseDir,
    isDirExpanded,
    moveSelectedDirEnts,
    resetSelectedDirEnts,
    selectDirEnt,
    deselectDirEnt,
    shiftSelectDirEnt,
    getDirEntsOfDir,
    focusDirEnt,
    blurDirEnt,
    isDirEntFocused,
  }

  return (
    <div
      {...rest}
      onDragOver={event => {
        event.preventDefault()
        props.onDragOver?.(event)
      }}
      onDrop={event => {
        moveSelectedDirEnts(config.base)
        props.onDrop?.(event)
      }}
    >
      <FileTreeContext.Provider value={fileTreeContext}>
        <Key each={flatTree()} by={item => item.dirEnt.path}>
          {dirEnt => {
            return (
              <DirEntIdContext.Provider value={{ id: dirEnt().id, }}>
                <DirEntContext.Provider value={dirEnt().dirEnt}>
                  {untrack(() => props.children(dirEnt().dirEnt, fileTreeContext))}
                </DirEntContext.Provider>
              </DirEntIdContext.Provider>
            )
          }}
        </Key>
      </FileTreeContext.Provider>
    </div>
  )
}

FileTree.DirEnt = function (
  props: Overwrite<
    ComponentProps<'button'>,
    {
      ref?(element: HTMLButtonElement): void
      onDragOver?(event: WrapEvent<DragEvent, HTMLButtonElement>): void
      onDragStart?(event: WrapEvent<DragEvent, HTMLButtonElement>): void
      onDrop?(event: WrapEvent<DragEvent, HTMLButtonElement>): void
      onMove?(parent: string): void
      onPointerDown?(event: WrapEvent<PointerEvent, HTMLButtonElement>): void
      onPointerUp?(event: WrapEvent<PointerEvent, HTMLButtonElement>): void
      onFocus?(event: WrapEvent<FocusEvent, HTMLButtonElement>): void
      onBlur?(event: WrapEvent<FocusEvent, HTMLButtonElement>): void
    }
  >,
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
            if (!event[CTRL_KEY]) {
              fileTree.resetSelectedDirEnts()
            }
            dirEnt.select()
          })
        } else if (event[CTRL_KEY]) {
          dirEnt.deselect()
        }
      }
      props.onPointerDown?.(event)
    },
    onPointerUp(event: WrapEvent<PointerEvent, HTMLButtonElement>) {
      if (dirEnt.type === 'dir') {
        if (dirEnt.expanded) {
          dirEnt.collapse()
        } else {
          dirEnt.expand()
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
        fileTree.moveSelectedDirEnts(dirEnt.path)
      } else {
        const parent = dirEnt.path.split('/').slice(0, -1).join('/')
        fileTree.moveSelectedDirEnts(parent)
      }

      props.onDrop?.(event)
    },
    onFocus(event: WrapEvent<FocusEvent, HTMLButtonElement>) {
      dirEnt.focus()
      props.onFocus?.(event)
    },
    onBlur(event: WrapEvent<FocusEvent, HTMLButtonElement>) {
      dirEnt.blur()
      props.onBlur?.(event)
    },
    ref(element: HTMLButtonElement) {
      onMount(() => {
        if (dirEnt.focused) {
          element.focus()
        }
      })
      props.ref?.(element)
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

FileTree.IndentGuides = function (props: {
  render: (type: Accessor<IndentGuideKind>) => JSX.Element
}) {
  const dirEnt = useDirEnt()
  const fileTree = useFileTree()

  function isLastChild(path: string) {
    const parentPath = PathUtils.getParent(path)

    if (parentPath === fileTree.base) {
      return false
    }

    const dirEnts = fileTree.getDirEntsOfDir(parentPath)
    const index = dirEnts.findIndex(dirEnt => dirEnt.path === path)

    return index === dirEnts.length - 1
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
        const kind = () => getGuideKind(index)
        return (
          <IndentGuideContext.Provider value={kind}>
            {props.render(kind)}
          </IndentGuideContext.Provider>
        )
      }}
    </Repeat>
  )
}

FileTree.Expanded = function (
  props: ComponentProps<'span'> & {
    expanded: JSX.Element
    collapsed: JSX.Element
  },
) {
  const [, rest] = splitProps(props, ['expanded', 'collapsed'])
  const dirEnt = useDirEnt()
  const fileTree = useFileTree()
  return (
    <Show when={dirEnt.type === 'dir'}>
      <span {...rest}>
        <Show when={fileTree.isDirExpanded(dirEnt.path)} fallback={props.expanded}>
          {props.collapsed}
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
  const dirEnt = useDirEnt()
  const fileTree = useFileTree()
  const dirEntId = useDirEntId()

  function rename(element: HTMLInputElement) {
    const newPath = [...dirEnt.path.split('/').slice(0, -1), element.value].join('/')

    if (newPath === dirEnt.path) {
      return
    }

    if (fileTree.fs.exists(newPath)) {
      element.value = dirEnt.name
      throw `Path ${newPath} already exists.`
    }

    dirEnt.rename(newPath)
  }

  return (
    <Show
      when={props.editable}
      fallback={
        <span class={props.class} style={props.style}>
          {dirEnt.name} [ID = {dirEntId.id}]
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
        spellcheck={false}
        onKeyDown={event => {
          if (event.code === 'Enter') {
            rename(event.currentTarget)
          }
        }}
        onBlur={event => {
          if (fileTree.fs.exists(dirEnt.path)) {
            rename(event.currentTarget)
          }
          props.onBlur?.(event)
        }}
      />
    </Show>
  )
}
