export default function About() {
  return (
    <div style={styles.content}>
      <h1 style={styles.heading}>About</h1>
      <p style={styles.body}>
        MedicalDemo uses SAM 2 (Segment Anything Model 2) to segment regions
        of interest in medical images directly in the browser.
      </p>
    </div>
  )
}

const styles = {
  content: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "1rem",
    padding: "2rem",
  },
  heading: {
    margin: 0,
    fontSize: "1.4rem",
    fontWeight: 600,
  },
  body: {
    color: "#94a3b8",
    maxWidth: "480px",
    textAlign: "center",
    lineHeight: 1.6,
  },
}
