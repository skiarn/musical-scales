# AI Training Environment Setup

## Using Docker (Recommended)

1. Install Docker and Docker Compose on your system
2. Build and start the container:
```bash
docker-compose up --build
```
3. Access Jupyter notebook at: http://localhost:8888

## Alternative: Local Setup

If you prefer a local setup without Docker:

```bash
python3.9 -m venv aienv
source aienv/bin/activate
pip install -r requirements.txt
```

## Running the Training

1. Generate training data:
```bash
python src/train/generate_training_data.py
```

2. Train the model:
```bash
python src/train/train_model.py
```

3. Convert to TensorFlow.js:
```bash
python convert_to_tfjs.py
```