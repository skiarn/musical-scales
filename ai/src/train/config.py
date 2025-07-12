import os

# Base paths
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
MODELS_DIR = os.path.join(PROJECT_ROOT, 'ai', 'models')
DATA_DIR = os.path.join(PROJECT_ROOT, 'ai', 'data')

# Training config
BATCH_SIZE = 32
EPOCHS = 100
VALIDATION_SPLIT = 0.2
LEARNING_RATE = 0.001

# Model config
INPUT_SIZE = 1024
ENCODING_DIM = 16
