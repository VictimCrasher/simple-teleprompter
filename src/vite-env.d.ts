/// <reference types="vite/client" />

declare global {
  interface Window {
    ipcRenderer: {
      on(channel: string, listener: (event: unknown, ...args: unknown[]) => void): void
      off(channel: string, ...args: unknown[]): void
      send(channel: string, ...args: unknown[]): void
      invoke(channel: 'open-teleprompter', payload: { text: string; speed: number; alwaysOnTop: boolean; alignment?: 'top-left' | 'top' | 'top-right' | 'left' | 'middle' | 'right' | 'bottom-left' | 'bottom' | 'bottom-right', windowHeight?: 'small' | 'medium' | 'large' }): Promise<void>
      invoke(channel: 'close-teleprompter'): Promise<void>
      invoke(channel: 'set-always-on-top', payload: { window: 'config' | 'teleprompter'; value: boolean }): Promise<void>
      invoke(channel: 'open-txt-dialog'): Promise<{ path: string | null; content: string | null }>
      invoke(channel: string, ...args: unknown[]): Promise<unknown>
    }
  }
}
