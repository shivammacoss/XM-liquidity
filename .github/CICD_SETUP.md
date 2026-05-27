# XMLiquidity CI/CD Setup Guide

## Overview
This project uses GitHub Actions for CI/CD with automatic deployment to staging (develop branch) and production (main branch).

## Workflow Files
- **`frontend.yml`** — Build & deploy React frontend
- **`backend.yml`** — Test & deploy FastAPI backend

## Required GitHub Secrets

Go to: **Repository Settings → Secrets and variables → Actions → New repository secret**

### Frontend Secrets
| Secret | Description | Example |
|--------|-------------|---------|
| `VITE_API_URL` | Backend API URL for build | `https://api.xmliquidity.com/api/v1` |

### Staging Server Secrets
| Secret | Description | Example |
|--------|-------------|---------|
| `STAGING_HOST` | Staging server IP/hostname | `staging.xmliquidity.com` |
| `STAGING_USER` | SSH username | `xmliquidity` |
| `STAGING_SSH_KEY` | Private SSH key (full content) | `-----BEGIN OPENSSH...` |

### Production Server Secrets
| Secret | Description | Example |
|--------|-------------|---------|
| `PROD_HOST` | Production server IP/hostname | `xmliquidity.com` |
| `PROD_USER` | SSH username | `xmliquidity` |
| `PROD_SSH_KEY` | Private SSH key (full content) | `-----BEGIN OPENSSH...` |

> **Note:** Paths are hardcoded in workflows:
> - Frontend: `~/XMLiquidity/client/dist`
> - Backend: `~/XMLiquidity/server`

## Server Setup Requirements (AlmaLinux 10)

### 1. Setup SSH key authentication
```bash
# On your local machine, generate key
ssh-keygen -t ed25519 -C "github-actions-deploy"

# Copy public key to server
ssh-copy-id -i ~/.ssh/id_ed25519.pub xmliquidity@your-server

# Add private key content to GitHub Secrets (copy full content)
cat ~/.ssh/id_ed25519
```

### 2. Allow passwordless sudo for systemctl (on server)
```bash
sudo visudo
# Add this line at the end:
xmliquidity ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart xmliquidity-api, /usr/bin/systemctl reload nginx
```

### 3. Backend systemd service (`/etc/systemd/system/xmliquidity-api.service`)
```ini
[Unit]
Description=XMLiquidity FastAPI Backend
After=network.target

[Service]
User=xmliquidity
Group=xmliquidity
WorkingDirectory=/home/xmliquidity/XMLiquidity/server
Environment="PATH=/home/xmliquidity/XMLiquidity/server/venv/bin"
ExecStart=/home/xmliquidity/XMLiquidity/server/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable xmliquidity-api
sudo systemctl start xmliquidity-api
```

### 4. Nginx config for frontend (`/etc/nginx/conf.d/xmliquidity.conf`)
```nginx
server {
    listen 80;
    server_name xmliquidity.com;
    root /home/xmliquidity/XMLiquidity/client/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 5. Create .env file (one-time setup)
```bash
cd ~/XMLiquidity/server
cp .env.example .env
nano .env  # Edit with production values
```

## .env Preservation

Both workflows **automatically preserve** the `.env` file during deployments:

1. **Before deploy**: `.env` is backed up to `/tmp/`
2. **After code pull**: `.env` is restored from backup
3. **Never committed**: `.env` stays on server only

## Deployment Flow

### Staging (develop branch)
```
Push to develop → Build/Test → Deploy to staging server
```

### Production (main branch)
```
Push to main → Build/Test → Backup current → Deploy → Health check → Success/Rollback
```

## Manual Rollback

For backend, trigger the rollback job manually from GitHub Actions:
1. Go to Actions → Backend CI/CD
2. Click "Run workflow"
3. Select "rollback" job

## Branch Strategy
- **`develop`** → Staging environment
- **`main`** → Production environment (requires approval)

## Server Paths (Your Setup)
```
~/XMLiquidity/
├── client/
│   ├── dist/           ← Frontend build output (deployed here)
│   ├── src/
│   └── ...
├── server/
│   ├── app/            ← Backend code
│   ├── venv/           ← Python virtual environment
│   ├── .env            ← PRESERVED during deployments
│   └── requirements.txt
└── README.md
```
