import { batch, createMemo, createRoot, createSignal, getListener, mapArray, onCleanup, Setter, untrack, type Accessor } from 'solid-js'
import { createStore, produce, SetStoreFunction, Store } from 'solid-js/store'
import { PathUtils } from './utils'
import { ReactiveMap } from '@solid-primitives/map'

/**********************************************************************************/
/*                                                                                */
/*                                      Types                                     */
/*                                                                                */
/**********************************************************************************/

interface DirEntBase {
  name: Accessor<string>,
  setName: (value: string) => void,
}

interface File<T> extends DirEntBase {
  type: 'file'
  get: Accessor<T>
  set(value: T): void
}
interface Dir<T> extends DirEntBase {
  type: 'dir'
  contents: Store<{
    value: Array</*id:*/string>
  }>,
  setContents: SetStoreFunction<{
    value: Array</*id:*/string>,
  }>,
}

type DirEnt<T> = File<T> | Dir<T>

/**********************************************************************************/
/*                                                                                */
/*                                   Create File                                  */
/*                                                                                */
/**********************************************************************************/

export function createFile<T>(name: string, initial: T): File<T> {
  const [get, set] = createSignal<T>(initial)
  let [name2, setName2] = createSignal(name);
  return {
    type: 'file',
    name: name2,
    setName: setName2,
    get,
    set,
  }
}

/**********************************************************************************/
/*                                                                                */
/*                               Create File System                               */
/*                                                                                */
/**********************************************************************************/

export function createFileSystem<T = string>() {
  const ROOT_ID = "root";
  const dirEnts = new ReactiveMap</*id*/string, DirEnt<T>>();

  function navigate(path: string): /*id:*/string {
    if (path == "" || path == "/") {
      return ROOT_ID;
    } else {
      let idx = path.lastIndexOf("/");
      let name = path.slice(idx+1);
      let prefix = idx == -1 ? "" : path.slice(0, idx);
      let preId = navigate(prefix);
      let preDirEnt = untrack(() => dirEnts.get(preId));
      if (preDirEnt?.type != "dir") {
        throw new Error(`Expected '${prefix}' to be a dir`);
      }
      let id = untrack(() =>
        preDirEnt.contents.value.find((id) => dirEnts.get(id)?.name() == name)
      );
      if (id == undefined) {
        throw new Error(`path not found '${path}'`);
      }
      return id;
    }
  }

  let readdirByIdFromPathMap: Record</*path*/string,{
    result: Accessor<Array<{ type: 'dir' | 'file'; path: string }>>,
    refCount: number,
    dispose: () => void,
  }> = {};

  function readdirByIdFromPath(path: string) {
    let r = readdirByIdFromPathMap[path];
    if (r === undefined) {
      let id = navigate(path);
      let { result, dispose, } = createRoot((dispose) => {
        let result_ = createMemo(() => {
          let dirEnt = dirEnts.get(id);
          if (dirEnt?.type != "dir") {
            return () => [];
          }
          return createMemo(() =>
            dirEnt.contents.value.flatMap((id) => {
              let dirEnt = dirEnts.get(id);
              if (dirEnt == undefined) {
                return [];
              }
              let type = dirEnt.type;
              let path2 = path + "/" + dirEnt.name;
              return [{
                type,
                path: path2,
              }];
            })
          );
        });
        let result = createMemo(() => result_()());
        return { result, dispose, };
      });
      let node = {
        result,
        refCount: 1,
        dispose,
      };
      readdirByIdFromPathMap[path] = node;
      onCleanup(() => {
        node.refCount--;
        if (node.refCount == 0) {
          queueMicrotask(() => {
            if (node.refCount == 0) {
              let path2 = Object.entries(readdirByIdFromPathMap).find(([_, r]) => r == node)?.[0];
              if (path2 != undefined) {
                delete readdirByIdFromPathMap[path2];
              }
            }
          });
        }
      });
      return node.result();
    } else {
      let node = r;
      node.refCount++;
      onCleanup(() => {
        node.refCount--;
        if (node.refCount == 0) {
          queueMicrotask(() => {
            if (node.refCount == 0) {
              let path2 = Object.entries(readdirByIdFromPathMap).find(([_, r]) => r == node)?.[0];
              if (path2 != undefined) {
                delete readdirByIdFromPathMap[path2];
              }
            }
          });
        }
      });
      return node.result();
    }
  }

  let readFileByIdFromPathMap: Record</*path*/string,{
    result: Accessor<T>,
    refCount: number,
    dispose: () => void,
  }> = {};

  function readFile(path: string) {
    let r = readFileByIdFromPathMap[path];
    if (r == undefined) {
      let id = navigate(path);
      let { result, dispose } = createRoot((dispose) => {
        let result = createMemo(() => {
          let dirEnt = dirEnts.get(id);
          if (dirEnt?.type != "file") {
            throw new Error("Fail");
          }
          return dirEnt.get();
        });
        return { result, dispose, };
      });
      let node = {
        result,
        refCount: 1,
        dispose,
      };
      readFileByIdFromPathMap[path] = node;
      onCleanup(() => {
        node.refCount--;
        if (node.refCount == 0) {
          queueMicrotask(() => {
            if (node.refCount == 0) {
              let path2 = Object.entries(readFileByIdFromPathMap).find(([_, r]) => r == node)?.[0];
              if (path2 != undefined) {
                delete readFileByIdFromPathMap[path2];
              }
            }
          });
        }
      });
      return node.result();
    } else {
      let node = r;
      node.refCount++;
      onCleanup(() => {
        node.refCount--;
        if (node.refCount == 0) {
          queueMicrotask(() => {
            if (node.refCount == 0) {
              let path2 = Object.entries(readFileByIdFromPathMap).find(([_, r]) => r == node)?.[0];
              if (path2 != undefined) {
                delete readFileByIdFromPathMap[path2];
              }
            }
          });
        }
      });
      return node.result();
    }
  }

  let beforeRename = (oldPath: string, newPath: string) => {
    const renamesToDo = [{ oldPath, newPath }]
    for (const path of untrack(() => dirEnts.keys())) {
      if (
        path.length > oldPath.length &&
        path.slice(0, oldPath.length) === oldPath &&
        path[oldPath.length] === '/'
      ) {
        const postfix = path.slice(oldPath.length)
        renamesToDo.push({ oldPath: oldPath + postfix, newPath: newPath + postfix })
      }
    }
    for (const { oldPath, newPath } of renamesToDo) {
      {
        let node = readdirByIdFromPathMap[oldPath];
        if (node != undefined) {
          readdirByIdFromPathMap[newPath] = node;
          delete readdirByIdFromPathMap[oldPath];
        }
      }
      {
        let node = readFileByIdFromPathMap[oldPath];
        if (node != undefined) {
          readFileByIdFromPathMap[newPath] = node;
          delete readFileByIdFromPathMap[oldPath];
        }
      }
    }
  };

  function readdir(
    path: string,
    options: { withFileTypes: true },
  ): Array<{ type: 'dir' | 'file'; path: string }>
  function readdir(path: string): Array<string>
  function readdir(path: string, options?: { withFileTypes?: boolean }) {
    let doIt = () => {
      let result = readdirByIdFromPath(path);
      if (options?.withFileTypes ?? false) {
        return result;
      }
      return result.map((x) => x.path);
    };
    if (getListener() == null) {
      return createRoot((dispose) => {
        let r = doIt();
        dispose();
        return r;
      }) 
    } else {
      return doIt();
    }
  }

  const fs = {
    exists(path: string) {
      return path in dirEnts
    },
    getType(path: string): DirEnt<T>['type'] {
      throw new Error("TODO");
    },
    readdir,
    mkdir(path: string, options?: { recursive?: boolean }) {
      throw new Error("TODO");
    },
    readFile(path: string) {
      return readFile(path);
    },
    rename(previous: string, next: string) {
      let previousPreId;
      let previousName;
      {
        let path = previous;
        let idx = path.lastIndexOf("/");
        let name = path.slice(idx+1);
        let prefix = idx == -1 ? "" : path.slice(0, idx);
        previousPreId = navigate(prefix);
        previousName = name;
      }
      let nextPreId;
      let nextName;
      {
        let path = next;
        let idx = path.lastIndexOf("/");
        let name = path.slice(idx+1);
        let prefix = idx == -1 ? "" : path.slice(0, idx);
        nextPreId = navigate(prefix);
        nextName = name;
      }
      let fileId = navigate(previous);
      let file = untrack(() => dirEnts.get(fileId));
      if (file?.type != "file") {
        throw new Error("Failed");
      }
      let prevDir = untrack(() => dirEnts.get(previousPreId));
      let nextDir = untrack(() => dirEnts.get(nextPreId));
      if (prevDir?.type != "dir") {
        throw new Error("Failed");
      }
      if (nextDir?.type != "dir") {
        throw new Error("Failed");
      }
      beforeRename(previous, next);
      batch(() => {
        if (nextName !== previousName) {
          // rename file
          file.setName(nextName);
        }
        if (previousPreId !== nextPreId) {
          // move file
          prevDir.setContents(
            "value",
            (contents) =>
              contents.filter((x) => x !== fileId)
          );
          nextDir.setContents(
            "value",
            (contents: string[]) => [
              ...contents,
              fileId,
            ],
          )
        }
      });
    },
    rm(path: string, options?: { force?: boolean; recursive?: boolean }) {
      let idx = path.lastIndexOf("/");
      let prefix = idx == -1 ? "" : path.slice(0, idx);
      let preId = navigate(prefix);
      let id = navigate(path);
      let dirEnt = untrack(() => dirEnts.get(preId));
      if (dirEnt == undefined) {
        return;
      }
      if (dirEnt.type != "dir") {
        return;
      }
      dirEnt.setContents(
        "value",
        (contents) =>
          contents.filter((x) => x !== id)
      );
    },
    writeFile(path: string, source: T) {
      let fileId = navigate(path);
      let file = untrack(() => dirEnts.get(fileId));
      if (file?.type != "file") {
        return;
      }
      file.set(source);
    },
  }

  return fs
}
