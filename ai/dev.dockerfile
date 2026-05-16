# Development environment for python in docker container
# docker build -t python-dev -f dev.dockerfile .
# docker run -v "pwd":/home/ubuntu -it python-dev

# Use an official Python runtime as the base image
FROM python:3.11-slim

# Set environment variables to prevent Python from buffering stdout and stderr
ENV PYTHONUNBUFFERED=1

# Set the working directory inside the container
WORKDIR /app

# Copy your application code to the image
COPY ./src /app
COPY requirements.txt /app
# Install dependencies if you have a requirements.txt file
RUN pip install -r requirements.txt

RUN echo "Development environment setup complete."
# Expose a port (optional, if your app runs a server)
EXPOSE 8000

# Command to run the app or open the shell for development
CMD ["bash"]