import { useEffect, useRef, useState } from "react"

const CANVAS_MAX_WIDTH = 900
const CANVAS_MAX_HEIGHT = 600

export default function ImageCanvas({ imageSrc }) {
  const canvasRef = useRef(null)
  // scaleRef tracks how the image was scaled onto the canvas so clicks
  // can be converted back to original image coordinates for SAM 2 prompts.
  const scaleRef = useRef({ scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0 })
  const [clickedPoint, setClickedPoint] = useState(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")

    if (!imageSrc) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      canvas.width = CANVAS_MAX_WIDTH
      canvas.height = CANVAS_MAX_HEIGHT
      drawPlaceholder(ctx, canvas.width, canvas.height)
      return
    }

    const img = new Image()
    img.src = imageSrc
    img.onload = () => {
      // Scale image to fit within the max dimensions, preserving aspect ratio
      const scale = Math.min(
        CANVAS_MAX_WIDTH / img.naturalWidth,
        CANVAS_MAX_HEIGHT / img.naturalHeight,
        1  // never upscale
      )
      const drawWidth = img.naturalWidth * scale
      const drawHeight = img.naturalHeight * scale

      canvas.width = drawWidth
      canvas.height = drawHeight

      ctx.drawImage(img, 0, 0, drawWidth, drawHeight)

      // Store scale so click handler can convert canvas coords → image coords
      scaleRef.current = { scaleX: 1 / scale, scaleY: 1 / scale }
      setClickedPoint(null)
    }
  }, [imageSrc])

  function handleClick(e) {
    if (!imageSrc) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()

    // Canvas CSS size may differ from its pixel size — account for device pixel ratio
    const cssToPixelX = canvas.width / rect.width
    const cssToPixelY = canvas.height / rect.height

    const canvasX = (e.clientX - rect.left) * cssToPixelX
    const canvasY = (e.clientY - rect.top) * cssToPixelY

    // Convert to original image coordinates (what SAM 2 expects)
    const { scaleX, scaleY } = scaleRef.current
    const imageX = Math.round(canvasX * scaleX)
    const imageY = Math.round(canvasY * scaleY)

    console.log("SAM 2 point prompt:", [imageX, imageY])
    setClickedPoint({ canvasX, canvasY, imageX, imageY })

    // Draw a marker on the canvas at the clicked position
    const ctx = canvas.getContext("2d")
    ctx.beginPath()
    ctx.arc(canvasX, canvasY, 6, 0, 2 * Math.PI)
    ctx.fillStyle = "rgba(37, 99, 235, 0.85)"
    ctx.fill()
    ctx.strokeStyle = "#fff"
    ctx.lineWidth = 2
    ctx.stroke()
  }

  return (
    <div style={styles.wrapper}>
      <canvas
        ref={canvasRef}
        width={CANVAS_MAX_WIDTH}
        height={CANVAS_MAX_HEIGHT}
        onClick={handleClick}
        style={styles.canvas}
      />
      {clickedPoint && (
        <p style={styles.coords}>
          Canvas ({Math.round(clickedPoint.canvasX)}, {Math.round(clickedPoint.canvasY)})
          {" → "}
          Image ({clickedPoint.imageX}, {clickedPoint.imageY})
        </p>
      )}
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
    maxWidth: "100%",
  },
  coords: {
    margin: 0,
    fontSize: "0.85rem",
    color: "#94a3b8",
    fontFamily: "monospace",
  },
}
