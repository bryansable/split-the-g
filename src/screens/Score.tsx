import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Overlay, type Handle } from '../camera/Overlay'
import { sampleLine, snapshot, type MediaSource } from '../camera/sampler'
import { useCamera } from '../camera/useCamera'
import { DEFAULT_FRAME, G_BAND, TARGET_FRACTION, clamp, fractionToY, lineFraction, type GlassFrame } from '../engine/glass'
import { TIER_COLOR, scoreAttempt } from '../engine/score'
import { newId } from '../data/local'
import type { GlassType } from '../data/types'
import { Button, Notice } from '../components/ui'
import type { PendingResult } from './Result'

const SAMPLE_MS = 250

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
  const lineY = lineFrac === null ? null : lineFrac * size.h
  const result = useMemo(() => (lineY === null ? null : scoreAttempt(lineFraction(lineY, framePx))), [lineY, framePx])

  const getSource = useCallback((): MediaSource | null => {
    if (usingPhoto) return photoReady && imgRef.current ? { kind: 'image', el: imgRef.current } : null
    if (camera.status === 'ready' && videoRef.current && videoRef.current.readyState >= 2) {
      return { kind: 'video', el: videoRef.current }
    }
    return null
  }, [usingPhoto, photoReady, camera.status])

  // Detection loop
  useEffect(() => {
    if (!autoDetect || size.h === 0) return
    sampleCanvas.current ??= document.createElement('canvas')
    const tick = () => {
      const src = getSource()
      if (!src) return
      const found = sampleLine(src, sampleCanvas.current!, size.w, size.h, framePx)
      if (found) {
        const next = found.y / size.h
        setLineFrac((prev) => (prev === null ? next : prev * 0.4 + next * 0.6))
        setConfidence(found.detection.confidence)
      } else {
        setConfidence(0)
      }
    }
    tick()
    const id = window.setInterval(tick, usingPhoto ? 1000 : SAMPLE_MS)
    return () => window.clearInterval(id)
  }, [autoDetect, size, framePx, getSource, usingPhoto])

  const onDrag = useCallback(
    (handle: Handle, y: number) => {
      const f = y / size.h
      if (handle === 'rim') setFrameFrac((p) => ({ ...p, rimY: clamp(f, 0.02, p.baseY - 0.15) }))
      else if (handle === 'base') setFrameFrac((p) => ({ ...p, baseY: clamp(f, p.rimY + 0.15, 0.98) }))
      else {
        setAutoDetect(false)
        setLineFrac(clamp(f, 0, 1))
      }
    },
    [size.h],
  )

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (photoUrl) URL.revokeObjectURL(photoUrl)
    setPhotoReady(false)
    setPhotoUrl(URL.createObjectURL(file))
    setLineFrac(null)
    setAutoDetect(true)
    e.target.value = ''
  }

  function backToCamera() {
    if (photoUrl) URL.revokeObjectURL(photoUrl)
    setPhotoUrl(null)
    setPhotoReady(false)
    setLineFrac(null)
    setAutoDetect(true)
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
    const cx = size.w / 2
    const halfW = size.w * 0.3
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
    const pending: PendingResult = {
      id: newId(),
      createdAt: new Date().toISOString(),
      result,
      glassType,
      snapshotUrl: canvas.toDataURL('image/jpeg', 0.85),
    }
    navigate('/result', { state: pending })
  }

  const cameraProblem = !usingPhoto && (camera.status === 'denied' || camera.status === 'unsupported' || camera.status === 'error')
  const ready = getSource() !== null

  return (
    <div className="flex flex-col h-full">
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
            onDrag={onDrag}
          />
        )}

        {/* top bar */}
        <div className="absolute top-0 inset-x-0 p-3 flex items-center justify-between gap-2 pointer-events-none">
          <div className="pointer-events-auto flex rounded-full bg-black/60 backdrop-blur p-1 text-xs">
            <button
              className={`px-3 py-1.5 rounded-full ${glassType === 'plain' ? 'bg-cream text-ink font-semibold' : 'text-cream/80'}`}
              onClick={() => setGlassType('plain')}
            >
              Any glass
            </button>
            <button
              className={`px-3 py-1.5 rounded-full ${glassType === 'official' ? 'bg-cream text-ink font-semibold' : 'text-cream/80'}`}
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
          ) : camera.status === 'starting' && !usingPhoto ? (
            <span className="rounded-full bg-black/60 px-3 py-1 text-xs text-cream/80">Starting camera…</span>
          ) : lineFrac === null ? (
            <span className="rounded-full bg-black/60 px-3 py-1 text-xs text-cream/80">
              Drag RIM and BASE to your glass. Looking for the beer line…
            </span>
          ) : autoDetect && confidence < 0.4 ? (
            <span className="rounded-full bg-black/60 px-3 py-1 text-xs text-amber-200">Weak edge. Drag the line if it looks wrong.</span>
          ) : null}
        </div>
      </div>

      {/* controls */}
      <div className="p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-ink border-t border-white/10 flex items-center justify-between gap-3">
        <label className="flex flex-col items-center text-[11px] text-cream/70 w-20 cursor-pointer">
          <span className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-lg">🖼️</span>
          Pick photo
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onPickPhoto} />
        </label>

        <button
          onClick={capture}
          disabled={!ready || !result}
          aria-label="Capture"
          className="w-20 h-20 rounded-full bg-cream disabled:opacity-30 flex items-center justify-center shadow-lg active:scale-95 transition"
        >
          <span className="w-16 h-16 rounded-full border-4 border-ink" />
        </button>

        <div className="flex flex-col items-center w-20 gap-1">
          {usingPhoto ? (
            <Button size="sm" variant="secondary" onClick={backToCamera}>
              Camera
            </Button>
          ) : autoDetect ? (
            <Button size="sm" variant="secondary" onClick={placeLineManually}>
              Manual
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => setAutoDetect(true)}>
              Auto
            </Button>
          )}
          {usingPhoto && (
            <button className="text-[11px] text-cream/60" onClick={() => (autoDetect ? placeLineManually() : setAutoDetect(true))}>
              {autoDetect ? 'Manual line' : 'Auto line'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
