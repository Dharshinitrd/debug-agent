FROM python:3.11-slim

# g++ for C++ syntax checks, default-jdk for future java support,
# nodejs for `node --check` JS syntax checks
RUN apt-get update && apt-get install -y --no-install-recommends \
    g++ nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir pyflakes

COPY app ./app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
