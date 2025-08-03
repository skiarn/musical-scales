# AI Training Environment Setup

## Using Docker (Recommended)

1. Install Docker and Docker Compose on your system
2. Build and start the container:
```bash
docker-compose up --build
```
3. Access Jupyter notebook at: http://localhost:8888

## Alternative: Local Setup

If you prefer a local setup without Docker use dev.dockerfile



```bash
python -m venv aienv
mac `source aienv/bin/activate` windows `.\aienv\Scripts\activate` or  .\aienv\Scripts\Activate.ps1 .\aienv\Scripts\Activate.ps1 and Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

pip install -r requirements.txt
```

## Running the Training

1. Generate training data file harmonic_training_data.csv:
```bash
python src/data/guitar_generation.py
```


2. Train the model will generate harmonic_classifier_tf:
```bash
python src/train/train_classifier.py
```

3. Create js model:
```bash
tensorflowjs_converter --input_format=keras harmonic_autoencoder.h5 tfjs_model/
```

