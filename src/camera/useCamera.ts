import { useCallback, useEffect, useRef, useState } from 'react'

export type CameraStatus = 'idle' | 'starting' | 'ready' | 'denied' | 'unsupported' | 'error'

export interface CameraState {
  status: CameraStatus
  error?: string
}

/**
 * Starts the rear camera into the given <video>. Stops it on unmount.
 * iOS needs playsInline + muted + autoplay on the element (set in JSX).
 */
export function useCamera(videoRef: React.RefObject<HTMLVideoElement>, enabled: boolean) {
  const [state, setState] = useState<CameraState>({ status: 'idle' })
  const streamRef = useRef<MediaStream | null>(null)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [videoRef])

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState({ status: 'unsupported', error: 'This browser cannot access the camera. Use "Pick a photo" instead.' })
      return
    }
    setState({ status: 'starting' })
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
      })
      streamRef.current = stream
      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      await video.play().catch(() => undefined)
      setState({ status: 'ready' })
    } catch (e) {
      const err = e as DOMException
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
        setState({ status: 'denied', error: 'Camera permission was denied. Allow it in your browser settings, or pick a photo.' })
      } else {
        setState({ status: 'error', error: err?.message || 'Could not start the camera.' })
      }
    }
  }, [videoRef])

  useEffect(() => {
    if (!enabled) {
      stop()
      setState({ status: 'idle' })
      return
    }
    void start()
    return stop
  }, [enabled, start, stop])

  return { ...state, restart: start, stop }
}
