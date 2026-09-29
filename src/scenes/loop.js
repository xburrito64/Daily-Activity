// The one clock every theme's scene runs on.
//
// A scene draws continuously for as long as it is on screen, and the app is
// something left open all day beside everything else, so the clock is frugal
// on purpose: thirty frames a second while you are using the app, a handful
// while it sits in the background behind another window, and none at all
// while it is hidden or minimised. Anyone who has asked their machine for
// less movement gets no clock — a scene draws once and then only when told.

export const FPS = { active: 30, idle: 8 }

/** Whether movement has been asked to stop, machine-wide. */
export const stillness = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/**
 * Call `frame(now, dt)` on the clock above until the returned stop is
 * called. `dt` is seconds since the last frame, capped, so a scene coming
 * back from a hidden window does not try to catch up on the time it missed.
 */
export function runLoop(frame) {
  let handle = 0
  let last = 0
  let stopped = false

  const tick = (now) => {
    if (stopped) return
    handle = requestAnimationFrame(tick)
    if (document.hidden) { last = now; return }
    const fps = document.hasFocus() ? FPS.active : FPS.idle
    if (now - last < 1000 / fps) return
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / fps
    last = now
    frame(now, dt)
  }
  handle = requestAnimationFrame(tick)
  return () => {
    stopped = true
    cancelAnimationFrame(handle)
  }
}

/**
 * Put the page to rest while another window has the focus: every animation
 * the stylesheet runs holds where it is (app.css, `.resting`) until the app
 * is back in front. Whatever is drawn on the clock above already slows down
 * on its own. Returns a function that stops watching.
 */
export function restWhenAway() {
  const page = document.documentElement
  const away = () => page.classList.add('resting')
  const back = () => page.classList.remove('resting')
  if (!document.hasFocus()) away()
  window.addEventListener('blur', away)
  window.addEventListener('focus', back)
  return () => {
    window.removeEventListener('blur', away)
    window.removeEventListener('focus', back)
    back()
  }
}
