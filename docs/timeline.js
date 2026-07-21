// hood-alerts docs — the scrub timeline.
//
// This is the site's primary navigation: seven horizontal "lanes", one per
// real detector the engine runs (see the README's detector table and
// commands.html). Each lane is a monochrome waveform distinguished only by
// stroke weight, dash pattern, and pulse shape — never color. Dragging or
// clicking the strip (or using the arrow keys, or the plain <a href="#ch-N">
// quick-jump links) moves a shared playhead across all seven lanes and swaps
// which channel article is shown in the readout pane below.
//
// Progressive enhancement: with JS disabled, #strip stays empty (styles.css
// hides an empty .strip) and every channel article in #readout is already in
// the DOM and visible, in document order, reachable by scrolling or by the
// plain <a href="#ch-N"> links. Nothing here is required to read the docs.
(() => {
  'use strict'

  // Seven real detector types (README "What it detects" table). `pulse`
  // and stroke params are purely a visualization choice; `id` must match the
  // channel article's data-id in the static HTML.
  const LANES = [
    { id: 'launches', label: 'Launches', pulse: 'spike', w: 1.5, dash: '' },
    { id: 'graduations', label: 'Graduations', pulse: 'rounded', w: 2, dash: '6 4' },
    { id: 'whales', label: 'Whales', pulse: 'spike-tall', w: 3, dash: '' },
    { id: 'stock', label: 'Stock moves', pulse: 'wave', w: 1, dash: '1 3' },
    { id: 'premium', label: 'Premium / discount', pulse: 'double', w: 2, dash: '' },
    { id: 'holders', label: 'Holder milestones', pulse: 'step', w: 1.5, dash: '2 2' },
    { id: 'rugs', label: 'Liquidity pulls', pulse: 'drop', w: 3, dash: '10 3' },
  ]
  const N = LANES.length

  // Deterministic PRNG (mulberry32) so the ambient waveform noise is stable
  // across reloads instead of jittering randomly on every paint.
  function mulberry32(seed) {
    let a = seed >>> 0
    return function () {
      a |= 0
      a = (a + 0x6d2b79f5) | 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  const VB_W = 1000
  const VB_H = 100
  const BASE = VB_H / 2

  // Real magnitudes from index.html's captured examples, reused only to
  // scale the "premium/discount" pulse shape — not invented numbers.
  const PREMIUM_PCT = 12.15
  const DISCOUNT_PCT = 8.65

  function ambient(t, rand) {
    // t in [0,1] local to the full lane width; smooth low-amplitude noise.
    return (
      Math.sin(t * 23 + rand() * 6.28) * 1.4 +
      Math.sin(t * 41 + rand() * 6.28) * 0.8
    )
  }

  function pulseOffset(pulse, lt) {
    // lt in [0,1] local to the lane's own zone.
    switch (pulse) {
      case 'spike': {
        const d = Math.abs(lt - 0.5)
        return d < 0.14 ? -(0.14 - d) / 0.14 * 26 : 0
      }
      case 'spike-tall': {
        const d = Math.abs(lt - 0.5)
        return d < 0.1 ? -(0.1 - d) / 0.1 * 40 : 0
      }
      case 'rounded': {
        if (lt < 0.28 || lt > 0.82) return 0
        const u = (lt - 0.28) / 0.54
        return -Math.sin(u * Math.PI) * 18
      }
      case 'wave': {
        if (lt < 0.12 || lt > 0.88) return 0
        const u = (lt - 0.12) / 0.76
        return Math.sin(u * Math.PI * 3.4) * 11
      }
      case 'double': {
        const up = Math.abs(lt - 0.32)
        const dn = Math.abs(lt - 0.68)
        const upH = Math.min(PREMIUM_PCT * 2, 34)
        const dnH = Math.min(DISCOUNT_PCT * 2, 34)
        if (up < 0.11) return -(0.11 - up) / 0.11 * upH
        if (dn < 0.11) return (0.11 - dn) / 0.11 * dnH
        return 0
      }
      case 'step': {
        if (lt < 0.25 || lt > 0.85) return 0
        const u = (lt - 0.25) / 0.6
        const step = Math.floor(u * 3)
        return -(step + 1) * 8
      }
      case 'drop': {
        if (lt < 0.3 || lt > 0.92) return 0
        if (lt < 0.42) {
          const u = (lt - 0.3) / 0.12
          return u * 30
        }
        if (lt < 0.7) return 30
        const u = (lt - 0.7) / 0.22
        return 30 - u * 14
      }
      default:
        return 0
    }
  }

  function buildPath(laneIndex, pulse) {
    const rand = mulberry32(laneIndex * 97 + 13)
    const zoneStart = laneIndex / N
    const zoneEnd = (laneIndex + 1) / N
    const pts = []
    const steps = 220
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const x = t * VB_W
      let y = BASE + ambient(t, rand)
      if (t >= zoneStart && t <= zoneEnd) {
        const lt = (t - zoneStart) / (zoneEnd - zoneStart)
        y = BASE + pulseOffset(pulse, lt) + ambient(t, rand) * 0.3
      }
      pts.push(x.toFixed(1) + ',' + y.toFixed(1))
    }
    return 'M' + pts.join(' L')
  }

  function zoneCenterPct(i) {
    return ((i + 0.5) / N) * 100
  }

  function svgNS(tag) {
    return document.createElementNS('http://www.w3.org/2000/svg', tag)
  }

  function init() {
    const strip = document.getElementById('strip')
    const readout = document.getElementById('readout')
    if (!strip || !readout) return // nothing to enhance on this page

    const channels = LANES.map((l) => document.getElementById('ch-' + l.id)).filter(Boolean)
    if (channels.length !== N) return // static markup incomplete; bail out to plain content

    document.body.classList.add('js')

    // --- build the lanes ---
    const lanesEl = document.createElement('div')
    lanesEl.className = 'lanes'
    const laneEls = LANES.map((lane, i) => {
      const row = document.createElement('div')
      row.className = 'lane'
      row.dataset.index = String(i)

      const svg = svgNS('svg')
      svg.setAttribute('viewBox', '0 0 ' + VB_W + ' ' + VB_H)
      svg.setAttribute('preserveAspectRatio', 'none')
      svg.setAttribute('aria-hidden', 'true')

      const path = svgNS('path')
      path.setAttribute('class', 'wave')
      path.setAttribute('d', buildPath(i, lane.pulse))
      path.style.setProperty('--w', String(lane.w))
      path.setAttribute('stroke-width', String(lane.w))
      if (lane.dash) path.setAttribute('stroke-dasharray', lane.dash)
      path.setAttribute('opacity', String(0.55 + (i % 3) * 0.08))
      svg.appendChild(path)
      row.appendChild(svg)

      const label = document.createElement('span')
      label.className = 'lane-label'
      label.textContent = String(i + 1).padStart(2, '0') + ' ' + lane.label
      row.appendChild(label)

      row.addEventListener('click', () => setActive(i, { scroll: true, focusStrip: true }))
      lanesEl.appendChild(row)
      return row
    })

    const playhead = document.createElement('div')
    playhead.className = 'playhead'
    lanesEl.appendChild(playhead)

    strip.appendChild(lanesEl)
    strip.setAttribute('role', 'slider')
    strip.setAttribute('tabindex', '0')
    strip.setAttribute('aria-valuemin', '0')
    strip.setAttribute('aria-valuemax', String(N - 1))
    strip.setAttribute('aria-orientation', 'horizontal')
    strip.setAttribute('aria-label', 'Detector signal timeline. Scrub to inspect a live alert channel.')

    const headText = document.getElementById('instrument-readout-title')

    let current = 0

    function setActive(i, opts) {
      opts = opts || {}
      current = Math.max(0, Math.min(N - 1, i))
      const lane = LANES[current]

      strip.setAttribute('aria-valuenow', String(current))
      strip.setAttribute('aria-valuetext', lane.label)
      playhead.style.left = zoneCenterPct(current) + '%'

      laneEls.forEach((row, idx) => row.classList.toggle('active', idx === current))

      channels.forEach((el, idx) => {
        if (idx === current) el.setAttribute('data-active', '')
        else el.removeAttribute('data-active')
      })

      document.querySelectorAll('.quickjump a').forEach((a) => {
        const isActive = a.dataset.index === String(current)
        if (isActive) a.setAttribute('aria-current', 'true')
        else a.removeAttribute('aria-current')
      })

      if (headText) headText.textContent = lane.label

      if (opts.scroll) {
        channels[current].scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
      if (opts.focusStrip) strip.focus({ preventScroll: true })
    }

    function fractionToIndex(clientX) {
      const rect = strip.getBoundingClientRect()
      const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      return Math.max(0, Math.min(N - 1, Math.floor(frac * N)))
    }

    // --- pointer drag / click ---
    let dragging = false
    strip.addEventListener('pointerdown', (e) => {
      dragging = true
      strip.classList.add('dragging')
      strip.setPointerCapture(e.pointerId)
      setActive(fractionToIndex(e.clientX))
    })
    strip.addEventListener('pointermove', (e) => {
      if (!dragging) return
      setActive(fractionToIndex(e.clientX))
    })
    function endDrag(e) {
      if (!dragging) return
      dragging = false
      strip.classList.remove('dragging')
      try {
        strip.releasePointerCapture(e.pointerId)
      } catch (_) {
        /* pointer already released */
      }
    }
    strip.addEventListener('pointerup', endDrag)
    strip.addEventListener('pointercancel', endDrag)

    // --- keyboard (native slider semantics) ---
    strip.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowDown':
          e.preventDefault()
          setActive(current - 1)
          break
        case 'ArrowRight':
        case 'ArrowUp':
          e.preventDefault()
          setActive(current + 1)
          break
        case 'Home':
          e.preventDefault()
          setActive(0)
          break
        case 'End':
          e.preventDefault()
          setActive(N - 1)
          break
      }
    })

    // --- quick-jump links: real <a href="#ch-N"> anchors, enhanced in place ---
    document.querySelectorAll('.quickjump a').forEach((a) => {
      const idx = LANES.findIndex((l) => 'ch-' + l.id === a.getAttribute('href').slice(1))
      if (idx < 0) return
      a.dataset.index = String(idx)
      a.addEventListener('click', () => setActive(idx, { scroll: false }))
    })

    // --- initial state: honor a deep-linked #ch-N hash, else the first channel ---
    const hashId = location.hash.replace('#', '')
    const hashIndex = LANES.findIndex((l) => 'ch-' + l.id === hashId)
    setActive(hashIndex >= 0 ? hashIndex : 0, { scroll: hashIndex >= 0 })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
