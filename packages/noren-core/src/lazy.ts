// Lazy loading utilities for plugins
import type { Detector, Masker } from './types.js'

export interface LazyPlugin {
  detectors?: () => Promise<Detector[]>
  maskers?: () => Promise<Record<string, Masker>>
  contextHints?: () => Promise<string[]>
}

export interface LoadedPlugin {
  detectors: Detector[]
  maskers: Record<string, Masker>
  contextHints: string[]
}

// Registry extension for lazy loading
declare module './types.js' {
  interface Registry {
    useLazy(plugin: LazyPlugin): Promise<void>
  }
}

// Cache for loaded plugins to avoid duplicate imports
const pluginCache = new Map<string, Promise<LoadedPlugin>>()

export async function loadPlugin(
  name: string,
  plugin: LazyPlugin
): Promise<LoadedPlugin> {
  if (pluginCache.has(name)) {
    return pluginCache.get(name)!
  }

  const loadPromise = (async () => {
    const [detectors, maskers, contextHints] = await Promise.all([
      plugin.detectors?.() ?? Promise.resolve([]),
      plugin.maskers?.() ?? Promise.resolve({}),
      plugin.contextHints?.() ?? Promise.resolve([]),
    ])

    return {
      detectors,
      maskers,
      contextHints,
    }
  })()

  pluginCache.set(name, loadPromise)
  return loadPromise
}

// Clear plugin cache (useful for testing or hot-reloading)
export function clearPluginCache(): void {
  pluginCache.clear()
}