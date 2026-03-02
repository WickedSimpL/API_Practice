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
import logging
logging.basicConfig(level=logging.DEBUG)                                                                                                                                                                                                                                                                              
logger = logging.getLogger(__name__)

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
    sam3_model = build_sam3_image_model(enable_inst_interactivity=True)
    sam3_processor = Sam3Processor(sam3_model)
    print("SAM 3 model loaded.")
    yield


# --- App ---

app = FastAPI(title="My API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
      CORSMiddleware,
      allow_origins=["*"],  # Vite dev server
      allow_methods=["*"],
      allow_headers=["*"],
  )

from fastapi.exceptions import RequestValidationError
from starlette.requests import Request

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    print(f"422 DETAIL: {exc.errors()}")
    return JSONResponse(status_code=422, content={"detail": exc.errors()})

# --- Routes ---

@app.get("/")
def root():
    return {"message": "Hello, World!"}




@app.post("/segment")
async def segment_image(
    image: UploadFile = File(...),
    prompt: str = Form(""),
    point_x: int | None = Form(None),
    point_y: int | None = Form(None),
):
    # Read uploaded image
    logger.debug(f"segment request: prompt={prompt!r}, point_x={point_x!r}, point_y={point_y!r}")
    contents = await image.read()
    pil_image = Image.open(io.BytesIO(contents)).convert("RGB")

    # Run SAM 3 inference with text prompt
    inference_state = sam3_processor.set_image(pil_image)

    if not prompt.strip() and (point_x is None or point_y is None):
      return JSONResponse({"error": "Provide either a text prompt or point coordinates"}, status_code=400)

    if prompt.strip():
        output = sam3_processor.set_text_prompt(state=inference_state, prompt=prompt)
        masks = output["masks"]   # list of boolean numpy arrays
        scores = output["scores"] # confidence scores

    import numpy as np
    if point_x is not None and point_y is not None:    
        masks, scores, _ = sam3_model.predict_inst(
            inference_state,
            point_coords=np.array([[point_x, point_y]]),
            point_labels=np.array([1])
        )

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


# --- Run ---

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("Main:app", host="0.0.0.0", port=8000, reload=True)
