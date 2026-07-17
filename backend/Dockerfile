FROM python:3.12-slim

WORKDIR /app

# Install dependencies first so this layer is cached unless requirements.txt changes.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Directory for the SQLite file when DATABASE_URL points here (see docker-compose.yml,
# which mounts a named volume at this path so data survives container restarts).
RUN mkdir -p /app/data

# Run as a non-root user rather than the default root.
RUN useradd --create-home appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
