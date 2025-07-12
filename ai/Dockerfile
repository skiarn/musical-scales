FROM tensorflow/tensorflow:latest-jupyter

WORKDIR /app

# Copy requirements
COPY requirements.txt .

# Update pip and install dependencies
RUN python -m pip install --no-cache-dir --progress-bar off --no-deps \
    --ignore-installed -r requirements.txt

# Ensure notebooks directory exists
RUN mkdir -p /app/notebooks && \
    chmod -R 777 /app

EXPOSE 8888