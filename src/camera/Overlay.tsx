import { useRef } from 'react'
import { G_BAND, G_LETTER_HEIGHT, TARGET_FRACTION, clamp, fractionToY, glassHeight, type GlassFrame } from '../engine/glass'
import { TIER_COLOR, type ScoreResult } from '../engine/score'

export type Handle = 'rim' | 'base' | 'line'

export interface OverlayProps {
  width: number
  height: number
  /** rim/base in container pixels */
  frame: GlassFrame
  /** liquid line in container pixels, or null when not found */
  lineY: number | null
  result: ScoreResult | null
  showGhost: boolean
  autoDetect: boolean
  /** detected wall positions in container px, when the glass was auto-framed */
  walls?: { left: number; right: number } | null
  onDrag: (handle: Handle, y: number) => void
}

const CREAM = '#f5e6c8'

/**
 * SVG overlay drawn on top of the camera: glass guide with draggable rim/base,
 * a ghost "G" at the target height, and the detected liquid line.
 */
export function Overlay({ width, height, frame, lineY, result, showGhost, autoDetect, walls, onDrag }: OverlayProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const dragging = useRef<Handle | null>(null)

  const gh = glassHeight(frame)
  const cx = walls ? (walls.left + walls.right) / 2 : width / 2
  const glassW = walls ? walls.right - walls.left : Math.min(width * 0.62, gh * 0.72)
  const targetY = fractionToY(TARGET_FRACTION, frame)
  const gSize = G_LETTER_HEIGHT * gh
  const bandPx = G_BAND * gh

  function yFromEvent(e: React.PointerEvent): number {
    const rect = svgRef.current!.getBoundingClientRect()
    return clamp(e.clientY - rect.top, 0, height)
  }

  function startDrag(handle: Handle) {
    return (e: React.PointerEvent) => {
      dragging.current = handle
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
      e.preventDefault()
    }
  }

  function move(e: React.PointerEvent) {
    if (!dragging.current) return
    onDrag(dragging.current, yFromEvent(e))
  }

  function end() {
    dragging.current = null
  }

  const lineColor = result ? TIER_COLOR[result.tier] : CREAM

  // Simple tulip pint silhouette between rim and base.
  const top = frame.rimY
  const bot = frame.baseY
  const rW = glassW / 2
  const bulgeY = top + gh * 0.32
  const waistY = top + gh * 0.72
  const baseW = rW * 0.72
  const glassPath = [
    `M ${cx - rW * 0.94} ${top}`,
    `C ${cx - rW * 1.02} ${bulgeY}, ${cx - rW * 0.98} ${bulgeY + gh * 0.15}, ${cx - rW * 0.8} ${waistY}`,
    `L ${cx - baseW} ${bot}`,
    `L ${cx + baseW} ${bot}`,
    `L ${cx + rW * 0.8} ${waistY}`,
    `C ${cx + rW * 0.98} ${bulgeY + gh * 0.15}, ${cx + rW * 1.02} ${bulgeY}, ${cx + rW * 0.94} ${top}`,
    'Z',
  ].join(' ')

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="absolute inset-0 touch-none select-none"
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#000" floodOpacity="0.8" />
        </filter>
      </defs>

      {/* glass silhouette: detected walls, or a generic tulip guide */}
      {walls ? (
        <g stroke={CREAM} strokeOpacity={0.55} strokeWidth={2} strokeDasharray="6 6">
          <line x1={walls.left} x2={walls.left} y1={top} y2={bot} />
          <line x1={walls.right} x2={walls.right} y1={top} y2={bot} />
        </g>
      ) : (
        <path d={glassPath} fill="none" stroke={CREAM} strokeOpacity={0.45} strokeWidth={2} strokeDasharray="6 6" />
      )}

      {/* G band + ghost */}
      {showGhost && (
        <g filter="url(#shadow)">
          <rect x={cx - rW * 0.8} y={targetY - bandPx} width={rW * 1.6} height={bandPx * 2} fill={CREAM} fillOpacity={0.12} />
          <text
            x={cx}
            y={targetY}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="Georgia, 'Times New Roman', serif"
            fontWeight={700}
            fontSize={gSize * 1.35}
            fill="none"
            stroke={CREAM}
            strokeOpacity={0.9}
            strokeWidth={2}
          >
            G
          </text>
          <line x1={cx - rW * 0.8} x2={cx + rW * 0.8} y1={targetY} y2={targetY} stroke={CREAM} strokeOpacity={0.7} strokeWidth={1} strokeDasharray="3 4" />
        </g>
      )}
      {!showGhost && (
        <line x1={cx - rW * 0.8} x2={cx + rW * 0.8} y1={targetY} y2={targetY} stroke={CREAM} strokeOpacity={0.6} strokeWidth={1} strokeDasharray="3 4" />
      )}

      {/* rim + base handles */}
      <HandleLine y={top} width={width} label="RIM" onDown={startDrag('rim')} />
      <HandleLine y={bot} width={width} label="BASE" onDown={startDrag('base')} />

      {/* detected / manual liquid line */}
      {lineY !== null && (
        <g filter="url(#shadow)">
          <line x1={cx - rW * 1.1} x2={cx + rW * 1.1} y1={lineY} y2={lineY} stroke={lineColor} strokeWidth={3} />
          <circle
            cx={cx + rW * 1.1}
            cy={lineY}
            r={18}
            fill={lineColor}
            fillOpacity={0.9}
            onPointerDown={startDrag('line')}
            style={{ cursor: 'ns-resize' }}
          />
          <text x={cx + rW * 1.1} y={lineY} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700} fill="#0a0a0a" pointerEvents="none">
            {autoDetect ? 'AUTO' : 'DRAG'}
          </text>
          {result && (
            <text x={cx - rW * 1.1} y={lineY - 10} fontSize={14} fontWeight={700} fill={lineColor}>
              {result.score}
            </text>
          )}
        </g>
      )}
    </svg>
  )
}

function HandleLine({ y, width, label, onDown }: { y: number; width: number; label: string; onDown: (e: React.PointerEvent) => void }) {
  return (
    <g filter="url(#shadow)">
      <line x1={0} x2={width} y1={y} y2={y} stroke={CREAM} strokeOpacity={0.8} strokeWidth={1.5} />
      {/* big invisible hit area */}
      <rect x={0} y={y - 22} width={width} height={44} fill="transparent" onPointerDown={onDown} style={{ cursor: 'ns-resize' }} />
      <rect x={10} y={y - 12} width={48} height={24} rx={12} fill={CREAM} onPointerDown={onDown} style={{ cursor: 'ns-resize' }} />
      <text x={34} y={y} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700} fill="#0a0a0a" pointerEvents="none">
        {label}
      </text>
    </g>
  )
}
