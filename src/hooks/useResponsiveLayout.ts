import { useEffect, useState } from 'react'

const MOBILE_BREAKPOINT = 820
const TOUCH_BREAKPOINT = 1100

function detectMobileLayout(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  const hasTouch =
    window.matchMedia('(pointer: coarse)').matches ||
    navigator.maxTouchPoints > 0

  return window.innerWidth <= MOBILE_BREAKPOINT || (hasTouch && window.innerWidth <= TOUCH_BREAKPOINT)
}

export function useResponsiveLayout() {
  const [isMobileLayout, setIsMobileLayout] = useState(detectMobileLayout)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const mobileQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`)
    const touchQuery = window.matchMedia('(pointer: coarse)')

    function updateLayout() {
      setIsMobileLayout(detectMobileLayout())
    }

    updateLayout()
    window.addEventListener('resize', updateLayout)
    mobileQuery.addEventListener('change', updateLayout)
    touchQuery.addEventListener('change', updateLayout)

    return () => {
      window.removeEventListener('resize', updateLayout)
      mobileQuery.removeEventListener('change', updateLayout)
      touchQuery.removeEventListener('change', updateLayout)
    }
  }, [])

  return {
    isMobileLayout,
  }
}
