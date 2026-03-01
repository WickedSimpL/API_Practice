import { Routes, Route } from "react-router-dom"
import Navbar from "./navbar"
import Home from "./pages/Home"
import About from "./pages/About"

export default function App() {
  return (
    <div style={styles.root}>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </div>
  )
}

const styles = {
  root: {
    display: "flex",
    flexDirection: "column",
    fontFamily: "sans-serif",
    background: "#111",
    minHeight: "100vh",
    color: "#eee",
  },
}
