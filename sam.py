import requests
import numpy as np
import torch
from PIL import Image
from transformers import Sam2Model, Sam2Processor

# --- Device ---
# MPS = Apple Silicon GPU. Falls back to CPU if unavailable.
device = "mps" if torch.backends.mps.is_available() else "cpu"
print(f"Using device: {device}")

# --- Load model & processor ---
# "hiera-small" is a good balance of speed and accuracy.
# First run will download ~180MB of weights from HuggingFace and cache them.
MODEL_ID = "facebook/sam2-hiera-small"
print(f"Loading {MODEL_ID} ...")
processor = Sam2Processor.from_pretrained(MODEL_ID)
model = Sam2Model.from_pretrained(MODEL_ID).to(device)
model.eval()
print("Model ready.\n")

# --- Load a sample image ---
IMG_URL = "https://huggingface.co/ybelkada/segment-anything/resolve/main/assets/car.png"
image = Image.open(requests.get(IMG_URL, stream=True).raw).convert("RGB")
print(f"Image size: {image.size}")  # (width, height)

# --- Define a point prompt ---
# SAM 2 segments whatever object your point falls inside.
# Format: [[[x, y]]] — outer list = images, inner list = points per image
input_points = [[[[1323, 875]]]]  # roughly the centre of the car

# --- Prepare inputs ---
inputs = processor(
    images=image,
    input_points=input_points,
    return_tensors="pt",
).to(device)

# --- Run inference ---
with torch.no_grad():
    outputs = model(**inputs)

# --- Post-process ---
# Masks come out at a reduced resolution; this resizes them back to the original image size.
masks = processor.post_process_masks(
    outputs.pred_masks.cpu(),
    inputs["original_sizes"].cpu()
)

# SAM 2 returns 3 mask candidates per point (low / medium / high quality).
# `iou_scores` is the model's own confidence estimate for each.
scores = outputs.iou_scores[0][0].tolist()
print(f"Mask scores (3 candidates): {[f'{s:.3f}' for s in scores]}")

best_idx = outputs.iou_scores[0][0].argmax().item()
best_mask = masks[0][0][best_idx].numpy()  # bool array, shape (H, W)
print(f"Best mask index: {best_idx}  |  pixels selected: {best_mask.sum()}")

# --- Visualise ---
# Blue overlay on the selected region, save to output.png
overlay = np.array(image, dtype=np.float32)
overlay[best_mask] = overlay[best_mask] * 0.4 + np.array([0, 100, 255]) * 0.6
result = Image.fromarray(overlay.astype(np.uint8))
result.save("output.png")
print("\nSaved output.png")
