// Custom cursor: a crisp dot on the pointer + a larger ring that trails with
// inertia. Also publishes normalized pointer position as CSS vars (--mx/--my)
// so any element can parallax against the cursor. This is the "oddly satisfying"
// layer — pure transforms on an rAF loop, nothing per-frame in React.
import { useEffect, useRef } from 'react'

export function CursorFX() {
  const dot = useRef<HTMLDivElement>(null)
  const ring = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let tx = window.innerWidth / 2, ty = window.innerHeight / 2
    let rx = tx, ry = ty
    let raf = 0

    const onMove = (e: PointerEvent) => {
      tx = e.clientX
      ty = e.clientY
      const root = document.documentElement
      root.style.setProperty('--mx', ((e.clientX / window.innerWidth) * 2 - 1).toFixed(3))
      root.style.setProperty('--my', ((e.clientY / window.innerHeight) * 2 - 1).toFixed(3))
      if (dot.current) dot.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`
      const hot = !!(e.target as HTMLElement)?.closest?.('button, input, a, [data-hot]')
      root.classList.toggle('cursor-hot', hot)
    }

    const loop = () => {
      rx += (tx - rx) * 0.16
      ry += (ty - ry) * 0.16
      if (ring.current) ring.current.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`
      raf = requestAnimationFrame(loop)
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    raf = requestAnimationFrame(loop)
    return () => {
      window.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <>
      <div ref={dot} className="cursor-dot" />
      <div ref={ring} className="cursor-ring" />
    </>
  )
}
