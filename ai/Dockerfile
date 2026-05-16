FROM tensorflow/tensorflow:2.15.0-jupyter

WORKDIR /app

# Copy requirements first for caching
COPY requirements.txt .

# Install all dependencies from requirements.txt only (manage versions there)
RUN python3 -m pip install --no-cache-dir --progress-bar off -r requirements.txt

# Ensure notebooks directory exists and set permissions
RUN mkdir -p /app/notebooks && chmod -R 777 /app

EXPOSE 8888