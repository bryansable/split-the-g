import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Overlay, type Handle } from '../camera/Overlay'
import { findGlass, findLine, grabSample, snapshot, type MediaSource } from '../camera/sampler'
import { useCamera } from '../camera/useCamera'
import { DEFAULT_FRAME, G_BAND, TARGET_FRACTION, clamp, fractionToY, lineFraction, type GlassFrame } from '../engine/glass'
import { TIER_COLOR, scoreAttempt } from '../engine/score'
import { newId } from '../data/local'
import type { GlassType } from '../data/types'
import { Photo, Pint } from '../components/icons'
import { Button, Notice } from '../components/ui'
import type { PendingResult } from './Result'

const SAMPLE_MS = 250
/** Auto-frame results below this confidence are ignored. */
const MIN_FRAME_CONFIDENCE = 0.35

type Walls = { left: number; right: number }

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
  const [frameFound, setFrameFound] = useState(false)
  const [lineFrac, setLineFrac] = useState<number | null>(null)
  const [autoDetect, setAutoDetect] = useState(true)
  const [glassType, setGlassType] = useState<GlassType>('plain')
  const [confidence, setConfidence] = useState(0)

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

  const lineY = lineFrac === null ? null : lineFrac * size.h
  const result = useMemo(() => (lineY === null ? null : scoreAttempt(lineFraction(lineY, framePx))), [lineY, framePx])

  const getSource = useCallback((): MediaSource | null => {
    if (usingPhoto) return photoReady && imgRef.current ? { kind: 'image', el: imgRef.current } : null
    if (camera.status === 'ready' && videoRef.current && videoRef.current.readyState >= 2) {
      return { kind: 'video', el: videoRef.current }
    }
    return null
  }, [usingPhoto, photoReady, camera.status])

  // Sampling loop: auto-frame the glass, then find the liquid line inside it.
  useEffect(() => {
    if (size.h === 0 || (!autoFrame && !autoDetect)) return
    sampleCanvas.current ??= document.createElement('canvas')
    const tick = () => {
      const src = getSource()
      if (!src) return
      const s = grabSample(src, sampleCanvas.current!, size.w, size.h)
      if (!s) return

      let frame = framePxRef.current
      let centreX = wallsRef.current ? (wallsRef.current.left + wallsRef.current.right) / 2 : size.w / 2
      if (autoFrame) {
        const g = findGlass(s)
        if (g && g.confidence >= MIN_FRAME_CONFIDENCE) {
          const next: GlassFrame = {
            rimY: clamp(g.frame.rimY, size.h * 0.02, size.h * 0.8),
            baseY: clamp(g.frame.baseY, size.h * 0.2, size.h * 0.98),
          }
          // Photos are static: take the fix as is. Live video: smooth it.
          const k = usingPhoto ? 1 : 0.5
          frame = {
            rimY: frame.rimY * (1 - k) + next.rimY * k,
            baseY: frame.baseY * (1 - k) + next.baseY * k,
          }
          centreX = (g.walls.left + g.walls.right) / 2
          setFrameFrac({ rimY: frame.rimY / size.h, baseY: frame.baseY / size.h })
          setWalls((prev) =>
            prev && !usingPhoto
              ? { left: prev.left * (1 - k) + g.walls.left * k, right: prev.right * (1 - k) + g.walls.right * k }
              : g.walls,
          )
          setFrameFound(true)
        } else {
          setFrameFound(false)
        }
      }

      if (autoDetect) {
        const found = findLine(s, frame, centreX)
        if (found) {
          const next = found.y / size.h
          setLineFrac((prev) => (prev === null || usingPhoto ? next : prev * 0.4 + next * 0.6))
          setConfidence(found.detection.confidence)
        } else {
          setConfidence(0)
        }
      }
    }
    tick()
    const id = window.setInterval(tick, usingPhoto ? 1000 : SAMPLE_MS)
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
    setLineFrac(null)
    setAutoDetect(true)
    setAutoFrame(true)
    setWalls(null)
    setFrameFound(false)
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
    setLineFrac((p) => p ?? fractionToY(TARGET_FRACTION, frameFrac))
  }

  function capture() {
    const src = getSource()
    if (!src || !result || lineY === null) return
    const canvas = snapshot(src, size.w, size.h, 2)
    // snapshot() already applied the 2x scale to this context; draw in container px.
    const ctx = canvas.getContext('2d')!
    const cx = walls ? (walls.left + walls.right) / 2 : size.w / 2
    const halfW = walls ? (walls.right - walls.left) / 2 : size.w * 0.3
    const tY = fractionToY(TARGET_FRACTION, framePx)
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

  let hint: { text: string; tone: 'info' | 'warn' } | null = null
  if (camera.status === 'starting' && !usingPhoto) hint = { text: 'Starting camera…', tone: 'info' }
  else if (autoFrame && !frameFound) hint = { text: 'Point at the glass with the whole glass in view.', tone: 'info' }
  else if (lineFrac === null) hint = { text: 'Glass found. Looking for the liquid line…', tone: 'info' }
  else if (autoDetect && confidence < 0.4) hint = { text: 'Weak edge. Drag the line if it looks wrong.', tone: 'warn' }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div ref={containerRef} className="relative flex-1 min-h-0 bg-black overflow-hidden">
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
            lineY={lineY}
            result={result}
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
          {result && (
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

        <button
          onClick={capture}
          disabled={!ready || !result}
          aria-label="Capture"
          className="w-20 h-20 rounded-full bg-gold disabled:opacity-30 flex items-center justify-center shadow-[0_0_0_3px_#241710,0_0_0_4px_rgba(201,164,71,.5)] active:scale-95 transition"
        >
          <span className="w-16 h-16 rounded-full border-4 border-ink flex items-center justify-center text-ink">
            <Pint size={28} />
          </span>
        </button>

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
        </div>
      </div>
    </div>
  )
}
