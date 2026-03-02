import { useEffect, useRef, useState } from "react"

const CANVAS_MAX_WIDTH = 900
const CANVAS_MAX_HEIGHT = 600

export default function ImageCanvas({ imageSrc, onPointClick }) {
  const canvasRef = useRef(null)
  const scaleRef = useRef({ scaleX: 1, scaleY: 1 })
  const imgRef = useRef(null)
  const [clickedPoint, setClickedPoint] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const isDragging = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })

  function drawCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    const img = imgRef.current
    if (!img) return

    const scale = Math.min(
      CANVAS_MAX_WIDTH / img.naturalWidth,
      CANVAS_MAX_HEIGHT / img.naturalHeight,
      1
    )
    const drawWidth = img.naturalWidth * scale
    const drawHeight = img.naturalHeight * scale

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.translate(pan.x, pan.y)
    ctx.scale(zoom, zoom)
    ctx.drawImage(img, 0, 0, drawWidth, drawHeight)
    ctx.restore()

    scaleRef.current = { scaleX: 1 / scale, scaleY: 1 / scale }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")

    if (!imageSrc) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      drawPlaceholder(ctx, CANVAS_MAX_WIDTH, CANVAS_MAX_HEIGHT)
      imgRef.current = null
      return
    }

    const img = new Image()
    img.src = imageSrc
    img.onload = () => {
      imgRef.current = img
      drawCanvas()
      setClickedPoint(null)
    }
  }, [imageSrc])

  useEffect(() => {
    drawCanvas()
  }, [zoom, pan])

  function handleClick(e) {
    if (!imageSrc || isDragging.current) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const cssToPixelX = canvas.width / rect.width
    const cssToPixelY = canvas.height / rect.height

    const canvasX = (e.clientX - rect.left) * cssToPixelX
    const canvasY = (e.clientY - rect.top) * cssToPixelY

    // Convert canvas coords to original image coords, accounting for pan & zoom
    const imgX = (canvasX - pan.x) / zoom
    const imgY = (canvasY - pan.y) / zoom
    const { scaleX, scaleY } = scaleRef.current
    const imageX = Math.round(imgX * scaleX)
    const imageY = Math.round(imgY * scaleY)

    console.log("SAM point prompt:", [imageX, imageY])
    setClickedPoint({ canvasX, canvasY, imageX, imageY })
    if (onPointClick) onPointClick({ x: imageX, y: imageY })

    // Draw marker
    const ctx = canvas.getContext("2d")
    ctx.beginPath()
    ctx.arc(canvasX, canvasY, 6, 0, 2 * Math.PI)
    ctx.fillStyle = "rgba(37, 99, 235, 0.85)"
    ctx.fill()
    ctx.strokeStyle = "#fff"
    ctx.lineWidth = 2
    ctx.stroke()
  }

  function handleWheel(e) {
    e.preventDefault()
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    // Mouse position relative to canvas center
    const cx = CANVAS_MAX_WIDTH / 2
    const cy = CANVAS_MAX_HEIGHT / 2
    const factor = e.deltaY > 0 ? 0.9 : 1.1
    setZoom(prev => {
      const newZoom = Math.min(Math.max(prev * factor, 0.5), 5)
      // Adjust pan so zoom centers on canvas center
      setPan(p => ({
        x: cx - (cx - p.x) * (newZoom / prev),
        y: cy - (cy - p.y) * (newZoom / prev),
      }))
      return newZoom
    })
  }

  function handleContextMenu(e) {
    e.preventDefault()
  }

  function handleMouseDown(e) {
    if (e.button === 2) {
      isDragging.current = true
      lastMouse.current = { x: e.clientX, y: e.clientY }
      e.preventDefault()
    }
  }

  function handleMouseMove(e) {
    if (!isDragging.current) return
    const dx = e.clientX - lastMouse.current.x
    const dy = e.clientY - lastMouse.current.y
    lastMouse.current = { x: e.clientX, y: e.clientY }
    setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }))
  }

  function handleMouseUp(e) {
    if (e && e.button === 2) {
      isDragging.current = false
    }
  }

  // Attach wheel listener with passive: false to allow preventDefault
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener("wheel", handleWheel, { passive: false })
    return () => canvas.removeEventListener("wheel", handleWheel)
  }, [])

  return (
    <div style={styles.wrapper}>
      <canvas
        ref={canvasRef}
        width={CANVAS_MAX_WIDTH}
        height={CANVAS_MAX_HEIGHT}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { isDragging.current = false }}
        style={styles.canvas}
      />
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
        {clickedPoint && (
          <p style={styles.coords}>
            Image ({clickedPoint.imageX}, {clickedPoint.imageY})
          </p>
        )}
        <button
          onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
          style={styles.resetBtn}
        >
          Reset Zoom ({Math.round(zoom * 100)}%)
        </button>
      </div>
    </div>
  )
}

function drawPlaceholder(ctx, w, h) {
  ctx.fillStyle = "#1e1e1e"
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = "#444"
  ctx.font = "16px sans-serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("Upload an image to get started", w / 2, h / 2)
}

const styles = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.75rem",
  },
  canvas: {
    border: "1px solid #333",
    borderRadius: "6px",
    cursor: "crosshair",
    width: CANVAS_MAX_WIDTH,
    height: CANVAS_MAX_HEIGHT,
  },
  coords: {
    margin: 0,
    fontSize: "0.85rem",
    color: "#94a3b8",
    fontFamily: "monospace",
  },
  resetBtn: {
    padding: "0.25rem 0.75rem",
    background: "#333",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "0.8rem",
  },
}
