import { useState } from "react"
import ImageCanvas from "../ImageCanvas"

export default function Home() {
  const [imageSrc, setImageSrc] = useState(null)
  const [prompt, setPrompt] = useState("")
  const [resultSrc, setResultSrc] = useState(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef(null)

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    fileRef.current = file
    if (imageSrc) URL.revokeObjectURL(imageSrc)
    setImageSrc(URL.createObjectURL(file))
    setResultSrc(null)
  }

  async function handleSegment() {
    if (!fileRef.current || !prompt.trim()) return
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append("image", fileRef.current)
      formData.append("prompt", prompt)

      const res = await fetch("http://localhost:8000/segment", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      setResultSrc(data.image)  // base64 data URL
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
            onClick={handleSegment}
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
      <ImageCanvas imageSrc={resultSrc || imageSrc} />
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
