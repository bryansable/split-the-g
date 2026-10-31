import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Overlay, type Handle } from '../camera/Overlay'
import { findGlass, findLine, grabSample, snapshot, viewFor, type MediaSource } from '../camera/sampler'
import { Stabilizer } from '../camera/stability'
import { currentTilt, requestTilt } from '../camera/tilt'
import { useCamera } from '../camera/useCamera'
import { DEFAULT_FRAME, G_BAND, TARGET_FRACTION, clamp, type GlassFrame } from '../engine/glass'
// (GlassFrame is also what the stabilizer hands back)
import { fractionRow, trueFraction, type View } from '../engine/perspective'
import { TIER_COLOR, scoreAttempt } from '../engine/score'
import { newId } from '../data/local'
import type { GlassType } from '../data/types'
import { Photo, Pint } from '../components/icons'
import { Button, Notice } from '../components/ui'
import type { PendingResult } from './Result'

const SAMPLE_MS = 100
/** Auto-frame results below this confidence are ignored. */
const MIN_FRAME_CONFIDENCE = 0.5
/** How long a locked reading must hold before it is captured automatically. */
const HOLD_MS = 600
/** Sideways lean beyond this tilts the glass on screen: ask the user to straighten up. */
const MAX_ROLL = (10 * Math.PI) / 180
/** Steeper than this still reads, but the rim is hard to see: suggest moving to G height. */
const STEEP_PITCH = (40 * Math.PI) / 180
const AUTO_CAPTURE_KEY = 'stg.autoCapture'

function loadAutoCapture(): boolean {
  try {
    return localStorage.getItem(AUTO_CAPTURE_KEY) !== 'off'
  } catch {
    return true
  }
}

type Walls = { left: number; right: number }
type GlassState = 'none' | 'settling' | 'ready'

export function Score() {
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const sampleCanvas = useRef<HTMLCanvasElement | null>(null)

  const [size, setSize] = useState({ w: 0, h: 0 })
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoReady, setPhotoReady] = useState(false)
  const [frameFrac, setFrameFrac] = useState<GlassFrame>(DEFAULT_FRAME)
  const [walls, setWalls] = useState<Walls | null>(null)
  const [autoFrame, setAutoFrame] = useState(true)
  const [glassState, setGlassState] = useState<GlassState>('none')
  const [lineFrac, setLineFrac] = useState<number | null>(null)
  const [locked, setLocked] = useState(false)
  const [autoDetect, setAutoDetect] = useState(true)
  const [glassType, setGlassType] = useState<GlassType>('plain')
  const [confidence, setConfidence] = useState(0)
  /** Auto-detected reading, as a fraction of the glass (already tilt-corrected). */
  const [readFrac, setReadFrac] = useState<number | null>(null)
  /** Camera view for tilt correction, null when the phone's tilt is unknown. */
  const [view, setView] = useState<View | null>(null)
  const [roll, setRoll] = useState(0)
  const [autoCapture, setAutoCapture] = useState(loadAutoCapture)
  const [holdProgress, setHoldProgress] = useState(0)
  const stabilizer = useRef(new Stabilizer())

  const usingPhoto = photoUrl !== null
  const camera = useCamera(videoRef, !usingPhoto)

  // Measure the container (overlay is drawn in pixels).
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ w: Math.round(width), h: Math.round(height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const framePx: GlassFrame = useMemo(
    () => ({ rimY: frameFrac.rimY * size.h, baseY: frameFrac.baseY * size.h }),
    [frameFrac, size.h],
  )
  // Latest frame for the sampling loop without re-subscribing the interval.
  const framePxRef = useRef(framePx)
  framePxRef.current = framePx
  const wallsRef = useRef(walls)
  wallsRef.current = walls

  const viewRef = useRef(view)
  viewRef.current = view

  const lineY = lineFrac === null ? null : lineFrac * size.h
  // Auto readings were taken against each sample's own frame and averaged; a
  // line placed by hand is read against the frame on screen now.
  const fraction = autoDetect ? readFrac : lineY === null ? null : trueFraction(lineY, framePx, view)
  const result = useMemo(() => (fraction === null ? null : scoreAttempt(fraction)), [fraction])
  const targetPx = fractionRow(TARGET_FRACTION, framePx, view)

  const getSource = useCallback((): MediaSource | null => {
    if (usingPhoto) return photoReady && imgRef.current ? { kind: 'image', el: imgRef.current } : null
    if (camera.status === 'ready' && videoRef.current && videoRef.current.readyState >= 2) {
      return { kind: 'video', el: videoRef.current }
    }
    return null
  }, [usingPhoto, photoReady, camera.status])

  // Sampling loop, ten times a second. Each sample finds the glass and reads
  // the line against that same sample's rim and base, corrected for the
  // phone's tilt. The reading shown is a median over recent samples and it
  // locks as soon as the last few agree, wherever the glass is on screen.
  useEffect(() => {
    if (size.h === 0 || (!autoFrame && !autoDetect)) return
    sampleCanvas.current ??= document.createElement('canvas')
    const stab = stabilizer.current
    const tick = () => {
      const src = getSource()
      if (!src) return
      const s = grabSample(src, sampleCanvas.current!, size.w, size.h)
      if (!s) return

      // A picked photo has no tilt reading of its own; the sensor describes the phone now, not then.
      const tilt = usingPhoto ? null : currentTilt()
      const v = tilt ? viewFor(s, tilt.pitch) : null
      setView(v)
      setRoll(tilt?.roll ?? 0)

      let frame = framePxRef.current
      let walls = wallsRef.current ?? { left: size.w * 0.3, right: size.w * 0.7 }
      if (autoFrame) {
        const g = findGlass(s, v)
        if (!g || g.confidence < MIN_FRAME_CONFIDENCE) {
          stab.push(null)
          if (!stab.hasGlass) {
            setGlassState('none')
            setWalls(null)
            setLineFrac(null)
            setReadFrac(null)
            setLocked(false)
          }
          return
        }
        frame = {
          rimY: clamp(g.frame.rimY, size.h * 0.02, size.h * 0.8),
          baseY: clamp(g.frame.baseY, size.h * 0.2, size.h * 0.98),
        }
        walls = { left: g.walls.left, right: g.walls.right }
      }

      let fraction: number | null = null
      let found: ReturnType<typeof findLine> = null
      if (autoDetect) {
        found = findLine(s, frame, (walls.left + walls.right) / 2, v)
        if (found) fraction = trueFraction(found.y, frame, v)
      }
      stab.push({ ...frame, ...walls, fraction })

      const sf = stab.frame()
      if (!sf) {
        setGlassState(stab.hasGlass ? 'settling' : 'none')
        return
      }
      const shown = autoFrame ? { rimY: sf.rimY, baseY: sf.baseY } : frame
      if (autoFrame) {
        setFrameFrac({ rimY: sf.rimY / size.h, baseY: sf.baseY / size.h })
        setWalls({ left: sf.left, right: sf.right })
        setGlassState('ready')
      }

      if (autoDetect) {
        const rd = stab.reading()
        if (rd) {
          setReadFrac(rd.fraction)
          setLineFrac(fractionRow(rd.fraction, shown, v) / size.h)
          setLocked(rd.locked)
          setConfidence(found?.detection.confidence ?? 0)
        } else {
          setReadFrac(null)
          setLineFrac(null)
          setLocked(false)
          setConfidence(0)
        }
      }
    }
    tick()
    const id = window.setInterval(tick, usingPhoto ? 300 : SAMPLE_MS)
    return () => window.clearInterval(id)
  }, [autoFrame, autoDetect, size, getSource, usingPhoto])

  const onDrag = useCallback(
    (handle: Handle, y: number) => {
      const f = y / size.h
      if (handle === 'rim') {
        setAutoFrame(false)
        setFrameFrac((p) => ({ ...p, rimY: clamp(f, 0.02, p.baseY - 0.15) }))
      } else if (handle === 'base') {
        setAutoFrame(false)
        setFrameFrac((p) => ({ ...p, baseY: clamp(f, p.rimY + 0.15, 0.98) }))
      } else {
        setAutoDetect(false)
        setLineFrac(clamp(f, 0, 1))
      }
    },
    [size.h],
  )

  function resetDetection() {
    stabilizer.current.reset()
    setLineFrac(null)
    setReadFrac(null)
    setLocked(false)
    setAutoDetect(true)
    setAutoFrame(true)
    setWalls(null)
    setGlassState('none')
  }

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (photoUrl) URL.revokeObjectURL(photoUrl)
    setPhotoReady(false)
    setPhotoUrl(URL.createObjectURL(file))
    resetDetection()
    e.target.value = ''
  }

  function backToCamera() {
    if (photoUrl) URL.revokeObjectURL(photoUrl)
    setPhotoUrl(null)
    setPhotoReady(false)
    resetDetection()
  }

  function placeLineManually() {
    setAutoDetect(false)
    setLineFrac((p) => p ?? targetPx / size.h)
  }

  function toggleAutoCapture() {
    setAutoCapture((on) => {
      try {
        localStorage.setItem(AUTO_CAPTURE_KEY, on ? 'off' : 'on')
      } catch {
        // private mode: the choice lasts for this visit only
      }
      return !on
    })
  }

  function capture() {
    const src = getSource()
    if (!src || !result || lineY === null) return
    const canvas = snapshot(src, size.w, size.h, 2)
    // snapshot() already applied the 2x scale to this context; draw in container px.
    const ctx = canvas.getContext('2d')!
    const cx = walls ? (walls.left + walls.right) / 2 : size.w / 2
    const halfW = walls ? (walls.right - walls.left) / 2 : size.w * 0.3
    const tY = targetPx
    const band = G_BAND * (framePx.baseY - framePx.rimY)
    ctx.fillStyle = 'rgba(245,230,200,0.18)'
    ctx.fillRect(cx - halfW, tY - band, halfW * 2, band * 2)
    ctx.setLineDash([4, 4])
    ctx.strokeStyle = 'rgba(245,230,200,0.9)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(cx - halfW, tY)
    ctx.lineTo(cx + halfW, tY)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.strokeStyle = TIER_COLOR[result.tier]
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(cx - halfW * 1.2, lineY)
    ctx.lineTo(cx + halfW * 1.2, lineY)
    ctx.stroke()
    // A tighter crop around the glass, in snapshot pixels, for the "glass only" share.
    const px = 2
    const glassCrop = walls
      ? {
          x: Math.max(0, walls.left - size.w * 0.14) * px,
          y: Math.max(0, framePx.rimY - size.h * 0.07) * px,
          w: Math.min(size.w, walls.right + size.w * 0.14) * px - Math.max(0, walls.left - size.w * 0.14) * px,
          h: Math.min(size.h, framePx.baseY + size.h * 0.05) * px - Math.max(0, framePx.rimY - size.h * 0.07) * px,
        }
      : undefined
    const pending: PendingResult = {
      id: newId(),
      createdAt: new Date().toISOString(),
      result,
      glassType,
      snapshotUrl: canvas.toDataURL('image/jpeg', 0.85),
      glassCrop,
    }
    navigate('/result', { state: pending })
  }

  const cameraProblem = !usingPhoto && (camera.status === 'denied' || camera.status === 'unsupported' || camera.status === 'error')
  const ready = getSource() !== null
  // A reading counts once the line has settled, or when the user placed it by hand.
  const settled = !autoDetect || locked
  const canCapture = ready && result !== null && settled
  const leaning = Math.abs(roll) > MAX_ROLL
  const steep = view !== null && Math.abs(view.pitch) > STEEP_PITCH
  const weak = autoDetect && confidence < 0.4

  // Auto-capture, like an ID photo: once the reading has locked on a clear
  // line with the phone upright, hold it briefly and take the shot. Only for
  // the live camera with automatic framing and detection; a picked photo or a
  // hand-placed line waits for the button.
  const autoArmed = autoCapture && !usingPhoto && autoFrame && autoDetect && canCapture && !weak && !leaning
  const captureRef = useRef<() => void>(() => undefined)
  captureRef.current = capture
  useEffect(() => {
    if (!autoArmed) {
      setHoldProgress(0)
      return
    }
    const start = performance.now()
    let raf = 0
    const step = () => {
      const p = Math.min(1, (performance.now() - start) / HOLD_MS)
      setHoldProgress(p)
      if (p >= 1) captureRef.current()
      else raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [autoArmed])

  let hint: { text: string; tone: 'info' | 'warn' } | null = null
  if (camera.status === 'starting' && !usingPhoto) hint = { text: 'Starting camera…', tone: 'info' }
  else if (autoFrame && glassState === 'none') hint = { text: 'Point at a glass with the whole glass in view.', tone: 'info' }
  else if (leaning) hint = { text: 'Hold the phone straight up and down.', tone: 'warn' }
  else if (autoFrame && glassState === 'settling') hint = { text: 'Glass found. Hold still…', tone: 'info' }
  else if (lineFrac === null) hint = { text: autoDetect ? 'Looking for the liquid line…' : 'Drag the line onto the liquid.', tone: 'info' }
  else if (autoDetect && !locked) hint = { text: steep ? 'Hold still. For best results, bring the phone level with the G.' : 'Hold still…', tone: 'info' }
  else if (weak) hint = { text: 'Weak edge. Drag the line if it looks wrong.', tone: 'warn' }
  else if (autoArmed) hint = { text: 'Got it. Capturing…', tone: 'info' }
  else hint = { text: 'Locked. Tap the button to capture.', tone: 'info' }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Opened by a direct URL, there was no tap to ask for tilt access with; the first touch here asks. */}
      <div ref={containerRef} className="relative flex-1 min-h-0 bg-black overflow-hidden" onPointerDown={() => void requestTilt()}>
        {!usingPhoto && (
          <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
        )}
        {usingPhoto && (
          <img
            ref={imgRef}
            src={photoUrl!}
            alt=""
            onLoad={() => setPhotoReady(true)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {size.w > 0 && (
          <Overlay
            width={size.w}
            height={size.h}
            frame={framePx}
            targetY={targetPx}
            lineY={lineY}
            result={settled ? result : null}
            showGhost={glassType === 'plain'}
            autoDetect={autoDetect}
            walls={autoFrame ? walls : null}
            onDrag={onDrag}
          />
        )}

        {/* top bar */}
        <div className="absolute top-0 inset-x-0 p-3 flex items-center justify-between gap-2 pointer-events-none">
          <div className="pointer-events-auto flex rounded-full bg-black/60 backdrop-blur p-1 text-xs border border-gold/30">
            <button
              className={`px-3 py-1.5 rounded-full ${glassType === 'plain' ? 'bg-gold text-ink font-semibold' : 'text-cream/80'}`}
              onClick={() => setGlassType('plain')}
            >
              Any glass
            </button>
            <button
              className={`px-3 py-1.5 rounded-full ${glassType === 'official' ? 'bg-gold text-ink font-semibold' : 'text-cream/80'}`}
              onClick={() => setGlassType('official')}
            >
              Official glass
            </button>
          </div>
          {result && settled && (
            <div className="pointer-events-auto rounded-full bg-black/60 backdrop-blur px-3 py-1.5 text-sm font-semibold" style={{ color: TIER_COLOR[result.tier] }}>
              {result.score} · {result.title}
            </div>
          )}
        </div>

        {/* status / hints */}
        <div className="absolute bottom-3 inset-x-0 flex justify-center px-4 pointer-events-none">
          {cameraProblem ? (
            <div className="pointer-events-auto max-w-sm">
              <Notice tone="warn">{camera.error}</Notice>
            </div>
          ) : hint ? (
            <span className={`rounded-full bg-black/60 px-3 py-1 text-xs ${hint.tone === 'warn' ? 'text-amber-200' : 'text-cream/80'}`}>
              {hint.text}
            </span>
          ) : null}
        </div>
      </div>

      {/* controls */}
      <div className="p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-wood border-t-2 pub-rule flex items-center justify-between gap-3">
        <div className="flex flex-col items-center w-24 gap-1">
          <label className="flex flex-col items-center text-[11px] text-cream/70 cursor-pointer">
            <span className="w-11 h-11 rounded-full bg-wood border border-gold/40 text-gold flex items-center justify-center">
              <Photo size={20} />
            </span>
            Pick photo
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onPickPhoto} />
          </label>
          {usingPhoto && (
            <button className="text-[11px] text-cream/60" onClick={backToCamera}>
              Back to camera
            </button>
          )}
        </div>

        <div className="relative w-20 h-20">
          <button
            onClick={capture}
            disabled={!canCapture}
            aria-label="Capture"
            className="w-20 h-20 rounded-full bg-gold disabled:opacity-30 flex items-center justify-center shadow-[0_0_0_3px_#241710,0_0_0_4px_rgba(201,164,71,.5)] active:scale-95 transition"
          >
            <span className="w-16 h-16 rounded-full border-4 border-ink flex items-center justify-center text-ink">
              <Pint size={28} />
            </span>
          </button>
          {holdProgress > 0 && (
            // Countdown ring for auto-capture.
            <svg className="absolute -inset-1.5 pointer-events-none -rotate-90" viewBox="0 0 92 92" aria-hidden>
              <circle
                cx="46"
                cy="46"
                r="44"
                fill="none"
                stroke="#f5e6c8"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 44}
                strokeDashoffset={2 * Math.PI * 44 * (1 - holdProgress)}
              />
            </svg>
          )}
        </div>

        <div className="flex flex-col items-center w-24 gap-1">
          {!autoFrame || !autoDetect ? (
            <Button size="sm" variant="secondary" onClick={resetDetection}>
              Auto
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={placeLineManually}>
              Manual
            </Button>
          )}
          <span className="text-[10px] text-cream/40 text-center">
            {autoFrame ? 'auto-framed' : 'manual frame'} · {autoDetect ? 'auto line' : 'manual line'}
          </span>
          {!usingPhoto && (
            <button className="text-[10px] text-cream/60 underline underline-offset-2" onClick={toggleAutoCapture}>
              Auto-capture {autoCapture ? 'on' : 'off'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
