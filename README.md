# AI Debugging Agent

Detects errors in Python, Java, C++, and JavaScript, explains the root cause,
suggests a corrected version of the code, walks through debugging steps, and
recommends relevant best practices.

**Architecture:** React frontend → FastAPI backend → static analysis tools
(pyflakes / node --check / g++ syntax check) feed grounding context into
Claude, which returns a structured JSON diagnosis (not free-text), so the
output is reliable enough to render into a real UI rather than a chat blob.

```
frontend (React + Vite, served by nginx)  --HTTP-->  backend (FastAPI)
                                                          |
                                                          v
                                              static analysis tools
                                                          |
                                                          v
                                               Claude API (reasoning)
```

## Run locally

1. Copy `.env.example` to `.env` and add your Anthropic API key:
   ```
   cp .env.example .env
   ```
2. Start everything:
   ```
   docker compose up --build
   ```
3. Open http://localhost:3000 (frontend) — it talks to the backend at
   http://localhost:8000.

Backend-only health check: `curl http://localhost:8000/health`

## Project structure

```
debug-agent/
├── backend/
│   ├── app/
│   │   ├── main.py       # FastAPI routes
│   │   └── analyzer.py   # static analysis + Claude call + schema
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/App.jsx        # UI
│   ├── src/App.css
│   ├── Dockerfile          # multi-stage build -> nginx
│   └── nginx.conf
└── docker-compose.yml
```

## Deploying to AWS (ECS Fargate)

This is the path to talk through in interviews: containers built locally,
pushed to a private registry, run serverlessly behind a load balancer.

### 1. Push images to ECR

```bash
aws ecr create-repository --repository-name debug-agent-backend
aws ecr create-repository --repository-name debug-agent-frontend

aws ecr get-login-password --region <region> \
  | docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com

docker build -t debug-agent-backend ./backend
docker tag debug-agent-backend:latest <account-id>.dkr.ecr.<region>.amazonaws.com/debug-agent-backend:latest
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/debug-agent-backend:latest

docker build -t debug-agent-frontend \
  --build-arg VITE_API_BASE=https://<your-backend-domain> ./frontend
docker tag debug-agent-frontend:latest <account-id>.dkr.ecr.<region>.amazonaws.com/debug-agent-frontend:latest
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/debug-agent-frontend:latest
```

### 2. Store the API key in Secrets Manager

```bash
aws secretsmanager create-secret \
  --name debug-agent/anthropic-key \
  --secret-string "sk-ant-..."
```

Reference this secret ARN in the backend task definition's `secrets` block
instead of putting the key in plain environment variables.

### 3. ECS setup

- Create an ECS **cluster** (Fargate launch type).
- Create two **task definitions** (backend, frontend), each pointing at its
  ECR image. Backend task pulls `ANTHROPIC_API_KEY` from the secret above.
- Create two **services** in the cluster, each running 1+ tasks behind an
  **Application Load Balancer** (ALB):
  - `/api/*` path rule → backend target group (port 8000)
  - `/*` default rule → frontend target group (port 80)
- Point your domain at the ALB (Route 53 + ACM cert for HTTPS).

### 4. CI/CD (optional, but a strong resume line)

A minimal GitHub Actions workflow: on push to `main`, build both images,
push to ECR, then call `aws ecs update-service --force-new-deployment` for
each service. This gives you a full build → ship → run pipeline to describe
in interviews.

## Extending this project

- Add Java support: compile with `javac` in a temp dir with a matching
  filename derived from the `public class` name.
- Swap the textarea for Monaco Editor for real syntax highlighting.
- Add a history panel (store past analyses in DynamoDB) to demonstrate
  persistence + a second AWS service.
- Add auth (Cognito) if you want to demo multi-user isolation.
