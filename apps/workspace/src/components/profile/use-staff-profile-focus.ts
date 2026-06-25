import { useEffect } from 'react'

export function useStaffProfileFocus(focus: string | undefined, enabled: boolean) {
  useEffect(() => {
    if (!focus || !enabled) return

    const id = window.requestAnimationFrame(() => {
      const el = document.querySelector(`[data-settings-focus="${focus}"]`)
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const ringClasses = ['ring-2', 'ring-primary', 'ring-offset-2']
      el.classList.add(...ringClasses)
      window.setTimeout(() => {
        el.classList.remove(...ringClasses)
      }, 2000)
    })

    return () => window.cancelAnimationFrame(id)
  }, [focus, enabled])
}
