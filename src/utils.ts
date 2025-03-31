export function normalizePath(path: string) {
  return path.replace(/^\/+/, '')
}

export function getParentDirectory(path: string) {
  return path.split('/').slice(0, -1).join('/')
}

export function getNameFromPath(path: string) {
  const parts = path.split('/')
  return parts[parts.length - 1] || ''
}
