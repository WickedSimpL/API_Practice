import sqlite3
from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import io
import base64
from fastapi import File, Form, UploadFile
from fastapi.responses import JSONResponse
from sam3.model_builder import build_sam3_image_model
from sam3.model.sam3_image_processor import Sam3Processor
from PIL import Image

DB_PATH = "items.db"


# --- Database helpers ---

def get_db():
    """Dependency that opens a DB connection, yields it to the route,
    then closes it automatically when the request is done."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    """Create the items table if it doesn't already exist."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS items (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT    NOT NULL,
            description TEXT,
            price       REAL    NOT NULL
        )
    """)
    conn.commit()
    conn.close()


# --- Lifespan (runs init_db on startup) ---

sam3_model = None
sam3_processor = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global sam3_model, sam3_processor
    init_db()
    sam3_model = build_sam3_image_model()
    sam3_processor = Sam3Processor(sam3_model)
    print("SAM 3 model loaded.")
    yield


# --- App ---

app = FastAPI(title="My API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
      CORSMiddleware,
      allow_origins=["http://localhost:5173"],  # Vite dev server
      allow_methods=["*"],
      allow_headers=["*"],
  )

# --- Models ---

class ItemIn(BaseModel):
    """What the client sends when creating an item."""
    name: str
    description: str | None = None
    price: float

class ItemOut(ItemIn):
    """What the API returns — includes the auto-assigned id."""
    id: int


# --- Routes ---

@app.get("/")
def root():
    return {"message": "Hello, World!"}


@app.get("/items", response_model=list[ItemOut])
def list_items(conn: sqlite3.Connection = Depends(get_db)):
    rows = conn.execute("SELECT * FROM items").fetchall()
    return [dict(row) for row in rows]


@app.get("/items/{item_id}", response_model=ItemOut)
def get_item(item_id: int, conn: sqlite3.Connection = Depends(get_db)):
    row = conn.execute(
        "SELECT * FROM items WHERE id = ?", (item_id,)
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Item not found")
    return dict(row)

@app.post("/segment")
async def segment_image(
    image: UploadFile = File(...),
    prompt: str = Form(...),
):
    # Read uploaded image
    contents = await image.read()
    pil_image = Image.open(io.BytesIO(contents)).convert("RGB")

    # Run SAM 3 inference with text prompt
    inference_state = sam3_processor.set_image(pil_image)
    output = sam3_processor.set_text_prompt(state=inference_state, prompt=prompt)

    masks = output["masks"]   # list of boolean numpy arrays
    scores = output["scores"] # confidence scores

    # Create overlay image for each mask
    import numpy as np
    overlay = np.array(pil_image, dtype=np.float32)
    colors = [
        [255, 0, 0], [0, 255, 0], [0, 100, 255],
        [255, 255, 0], [255, 0, 255], [0, 255, 255],
    ]
    for i, mask in enumerate(masks):
        color = colors[i % len(colors)]
        mask_np = mask.cpu().numpy() if hasattr(mask, 'cpu') else np.array(mask)
        if mask_np.ndim == 3:
            mask_np = mask_np.squeeze()
        overlay[mask_np > 0.5] = overlay[mask_np > 0.5] * 0.4 + np.array(color) * 0.6

    # Encode result as base64 PNG
    result_image = Image.fromarray(overlay.astype(np.uint8))
    buffer = io.BytesIO()
    result_image.save(buffer, format="PNG")
    b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

    return JSONResponse({
        "image": f"data:image/png;base64,{b64}",
        "num_masks": len(masks),
        "scores": [float(s) for s in scores],
    })


@app.post("/items", response_model=ItemOut, status_code=201)
def create_item(item: ItemIn, conn: sqlite3.Connection = Depends(get_db)):
    print(f"Inserting: {(item.name, item.description, item.price)}")
    cursor = conn.execute(
        "INSERT INTO items (name, description, price) VALUES (?, ?, ?)",
        (item.name, item.description, item.price),
    )
    conn.commit()
    row = conn.execute(
        "SELECT * FROM items WHERE id = ?", (cursor.lastrowid,)
    ).fetchone()
    return dict(row)


@app.delete("/items/{item_id}", status_code=204)
def delete_item(item_id: int, conn: sqlite3.Connection = Depends(get_db)):
    row = conn.execute(
        "SELECT id FROM items WHERE id = ?", (item_id,)
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Item not found")
    conn.execute("DELETE FROM items WHERE id = ?", (item_id,))
    conn.commit()


# --- Run ---

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("Main:app", host="0.0.0.0", port=8000, reload=True)
