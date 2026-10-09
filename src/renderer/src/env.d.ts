import type { DesktopApi } from '../../shared/contracts'

declare global {
  interface Window {
    wook: DesktopApi
  }
  const __APP_VERSION__: string
}
