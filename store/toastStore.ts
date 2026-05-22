import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info'

interface ToastState {
  visible: boolean
  message: string
  type: ToastType
  sequence: number
  showToast: (message: string, type?: ToastType) => void
  hideToast: () => void
}

export const useToastStore = create<ToastState>((set) => ({
  visible: false,
  message: '',
  type: 'info',
  sequence: 0,

  showToast: (message: string, type: ToastType = 'info'): void => {
    set((state) => ({
      visible: true,
      message,
      type,
      sequence: state.sequence + 1,
    }))
  },

  hideToast: (): void => {
    set({ visible: false })
  },
}))

/**
 * Imperative singleton helper for stores, services, and catch blocks.
 */
export const showToast = (message: string, type: ToastType = 'info'): void => {
  useToastStore.getState().showToast(message, type)
}
