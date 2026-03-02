import { useState, useRef } from "react"
import ImageCanvas from "../ImageCanvas"
import JSZip from "jszip"
import { saveAs } from "file-saver"

export default function Home() {
  const [imageSrc, setImageSrc] = useState(null)
  const [prompt, setPrompt] = useState("")
  const [resultSrc, setResultSrc] = useState(null)
  const [loading, setLoading] = useState(false)
  const [point, setPoint] = useState(null)
  const [gallery, setGallery] = useState([])
  const fileRef = useRef(null)

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    fileRef.current = file
    if (imageSrc) URL.revokeObjectURL(imageSrc)
    setImageSrc(URL.createObjectURL(file))
    setResultSrc(null)
  }

  async function handleDownload() {
    const zip = new JSZip()
    for (let i = 0; i < gallery.length; i++) {
      const res = await fetch(gallery[i])
      const blob = await res.blob()
      zip.file(`mask_${i + 1}.png`, blob)
    }
    const content = await zip.generateAsync({ type: "blob" })
    saveAs(content, "segmentation_masks.zip")
  }

 async function handleSegment(pointOverride = null) {
    if (!fileRef.current) return
    const activePoint = pointOverride || point
    if (!prompt.trim() && !activePoint) return
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append("image", fileRef.current)
      formData.append("prompt", prompt)
      if (!prompt.trim() && activePoint && activePoint.x != null && activePoint.y != null) {
        formData.append("point_x", activePoint.x)
        formData.append("point_y", activePoint.y)
  }

      const res = await fetch("http://localhost:8000/segment", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      console.log("data.image:", data.image ? "received" : "empty", "gallery length:", gallery.length + 1)
      setResultSrc(data.image)  // base64 data URL
      setGallery(prev => [...prev, data.image])
    } catch (err) {
      console.error("Segmentation failed:", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.content}>
      <h1 style={styles.heading}>Image Segmentation</h1>

      <label style={styles.uploadLabel}>
        Choose image
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={styles.fileInput}
        />
      </label>
      {imageSrc && (
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input
            type="text"
            placeholder='e.g. "yellow school bus"'
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            style={{
              padding: "0.5rem 0.75rem",
              borderRadius: "6px",
              border: "1px solid #444",
              background: "#1e1e1e",
              color: "#fff",
              fontSize: "0.95rem",
              width: "300px",
            }}
          />
          <button
            onClick={() => { setPoint(null); handleSegment(); }}
            disabled={loading || !prompt.trim()}
            style={{
              padding: "0.5rem 1.25rem",
              background: loading ? "#555" : "#16a34a",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: loading ? "wait" : "pointer",
              fontSize: "0.95rem",
            }}
          >
            {loading ? "Segmenting..." : "Segment"}
          </button>
        </div>
      )}
      <ImageCanvas
    imageSrc={resultSrc || imageSrc}
    onPointClick={(pt) => { setPoint(pt); handleSegment(pt); }}
  />
  {gallery.length > 0 && (
    <div style={{
      display: "flex",
      gap: "0.75rem",
      overflowX: "auto",
      padding: "1rem 0",
      maxWidth: "900px",
      width: "100%",
    }}>
      {gallery.map((src, i) => (
        <img
          key={i}
          src={src}
          alt={`Mask ${i + 1}`}
          onClick={() => setResultSrc(src)}
          style={{
            height: "100px",
            borderRadius: "4px",
            border: resultSrc === src ? "2px solid #2563eb" : "2px solid transparent",
            cursor: "pointer",
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  )}
     <button
    onClick={handleDownload}
    style={{
      padding: "0.5rem 1.25rem",
      background: "#2563eb",
      color: "#fff",
      border: "none",
      borderRadius: "6px",
      cursor: "pointer",
      fontSize: "0.95rem",
    }}
  >
    Download All ({gallery.length})
  </button>
    </div>
  )
}

const styles = {
  content: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "1.5rem",
    padding: "2rem",
  },
  heading: {
    margin: 0,
    fontSize: "1.4rem",
    fontWeight: 600,
  },
  uploadLabel: {
    cursor: "pointer",
    padding: "0.5rem 1.25rem",
    background: "#2563eb",
    color: "#fff",
    borderRadius: "6px",
    fontSize: "0.95rem",
  },
  fileInput: {
    display: "none",
  },
}
