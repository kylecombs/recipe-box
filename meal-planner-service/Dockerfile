FROM python:3.11-slim

WORKDIR /app

# Copy the application files
COPY . .

EXPOSE 8001

# Run the pure Python HTTP server (no external dependencies needed)
CMD ["python3", "main.py"]