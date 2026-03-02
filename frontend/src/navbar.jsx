import { Link } from "react-router-dom"

export default function Navbar() {
  return (
    <nav style={styles.nav}>
      <span style={styles.logo}>MedicalDemo</span>
      <ul style={styles.links}>
        <li><Link to="/" style={styles.link}>Home</Link></li>
        <li><Link to="/about" style={styles.link}>About</Link></li>
      </ul>
    </nav>
  )
}

const styles = {
  nav: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 2rem",
    height: "56px",
    background: "#0f172a",       // dark navy
    borderBottom: "1px solid #1e3a5f",
  },
  logo: {
    color: "#e2e8f0",
    fontWeight: 700,
    fontSize: "1.1rem",
    letterSpacing: "0.02em",
  },
  links: {
    display: "flex",
    gap: "1.5rem",
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  link: {
    color: "#94a3b8",
    textDecoration: "none",
    fontSize: "0.9rem",
    transition: "color 0.15s",
  },
}
