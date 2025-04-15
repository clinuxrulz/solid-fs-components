export const PathUtils = {
  normalize(path: string) {
    return path.replace(/^\/+/, '')
  },
  getParent(path: string) {
    return path.split('/').slice(0, -1).join('/')
  },
  getName(path: string) {
    return lastItem(path.split('/'))
  },
  isAncestor(path: string, ancestor: string) {
    if (path === ancestor) return false
    const pathParts = path.split('/')
    const ancestorParts = ancestor.split('/')
    return ancestorParts.every((part, index) => part === pathParts[index])
  },
}

export function lastItem<T>(arr: Array<T>): T | undefined {
  return arr[arr.length - 1]
}

export const isMac = navigator.platform.startsWith('Mac')

export type WrapEvent<TEvent, TCurrentTarget> = TEvent & {
  currentTarget: TCurrentTarget
  target: Element
}
