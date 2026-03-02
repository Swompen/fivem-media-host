# FiveM Media Host

A secure, self-hosted media hosting API and admin dashboard for FiveM servers. Upload, manage, and serve images, videos, and audio files with built-in rate limiting, JWT authentication, and a web-based admin interface.

## Features

- **RESTful Media API** — Upload and serve media files (images, audio, video)
- **Admin Dashboard** — Web UI for managing uploads, viewing stats, and batch operations
- **JWT Authentication** — Secure admin access with token-based auth
- **API Key Authentication** — LB-Phone and FiveM scripts authenticate with a simple API key
- **Rate Limiting** — 5 login attempts per 60 seconds to prevent brute force
- **File Type Validation** — Only allows safe media formats (jpg, png, gif, mp4, mp3, etc.)
- **File Management** — Delete, organize, and clean up orphaned/large/old files
- **Batch Operations** — Download multiple files as ZIP, bulk delete
- **Statistics** — Real-time upload stats and history
- **SQLite Database** — Self-contained, zero-dependency storage
- **Docker Ready** — Single-command deployment with Docker Compose
- **Security Hardened** — Timing-safe authentication, CORS disabled by default, padding against timing attacks

## Quick Start

### Prerequisites
- Docker & Docker Compose
- 10 minutes and your domain name

### 1. Clone & Configure

```bash
git clone https://github.com/Swompen/fivem-media-host.git
cd fivem-media-host
cp .env.example .env
```

### 2. Edit `.env`

```bash
nano .env
```

Generate secure secrets (or use `openssl rand -hex 32`):
```env
API_KEY=<your-random-api-key>
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<your-strong-password>
JWT_SECRET=<your-random-64-char-secret>
BASE_URL=https://media.your-domain.com
CORS_ORIGIN=https://your-domain.com
```

### 3. Start the Server

```bash
docker compose up -d
```

- **Admin Dashboard**: http://localhost:3000/admin
- **Media API**: http://localhost:3000/api/media
- **Health Check**: http://localhost:3000/api/media (with valid API key)

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | Server port |
| `BASE_URL` | No | `http://localhost:3000` | Full URL for file links |
| `API_KEY` | **Yes** | — | Secret key for FiveM scripts and LB-Phone |
| `ADMIN_USERNAME` | **Yes** | — | Admin dashboard login username |
| `ADMIN_PASSWORD` | **Yes** | — | Admin dashboard login password |
| `JWT_SECRET` | **Yes** | — | Secret for JWT token signing (64+ chars) |
| `CORS_ORIGIN` | No | Disabled | Enable CORS for this origin (e.g., `https://your-domain.com`) |

## LB-Phone Integration

In your FiveM `server.cfg`:

```
setr lbphone_media_host "https://your-domain.com"
setr lbphone_media_api_key "YOUR_API_KEY_HERE"
```

Then use in scripts:

```lua
-- Upload user photo
TriggerServerEvent('lbphone:media:upload', imageData, function(success, url)
    if success then
        print("Uploaded: " .. url)
    end
end)

-- List media
local media = exports['lbphone-media']:GetMedia({
    type = 'photo',
    limit = 50
})
```

## API Reference

### Public Endpoints

#### List Media
```
GET /api/media
Headers:
  x-api-key: YOUR_API_KEY

Query Parameters:
  page=1          # Page number (default: 1)
  limit=50        # Items per page (default: 50)
  type=image      # Filter by type: image, audio, video
  search=query    # Search in filename
  sort=createdAt  # Field to sort by
  order=DESC      # ASC or DESC

Response:
{
  "data": [
    {
      "id": "uuid",
      "originalName": "photo.jpg",
      "mimeType": "image/jpeg",
      "size": 245632,
      "url": "https://your-domain.com/media/uuid.jpg",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150
  }
}
```

#### Upload Media
```
POST /api/upload
Headers:
  x-api-key: YOUR_API_KEY
Body:
  multipart/form-data with file field

Response:
{
  "id": "uuid",
  "originalName": "photo.jpg",
  "mimeType": "image/jpeg",
  "size": 245632,
  "url": "https://your-domain.com/media/uuid.jpg",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### Admin Endpoints (Requires JWT)

#### Login
```
POST /api/admin/auth/login
Body: {
  "username": "admin",
  "password": "your-password"
}

Response:
{
  "access_token": "eyJhbGc..."
}
```

#### Get Admin Stats
```
GET /api/admin/stats
Headers:
  Authorization: Bearer <jwt_token>

Response:
{
  "totalFiles": 1250,
  "totalSize": 52428800,
  "filesByType": { "image": 950, "audio": 200, "video": 100 }
}
```

#### Delete Media
```
DELETE /api/admin/media/:id
Headers:
  Authorization: Bearer <jwt_token>
```

#### Batch Download
```
POST /api/admin/download
Headers:
  Authorization: Bearer <jwt_token>
Body: { "ids": ["uuid1", "uuid2"] }

Response: ZIP file
```

#### Find Orphaned Files
```
GET /api/admin/cleanup/orphaned
Headers:
  Authorization: Bearer <jwt_token>

Response: List of files not referenced in database
```

#### Delete Orphaned Files
```
POST /api/admin/cleanup/orphaned
Headers:
  Authorization: Bearer <jwt_token>

Response: Count of deleted files
```

## Self-Hosting

### Production Deployment

#### With Nginx Reverse Proxy

```nginx
server {
    listen 443 ssl http2;
    server_name media.your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;

    # Rate limit at edge
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Increase timeout for uploads
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
}
```

#### Docker Compose with Cloudflare Tunnel

```yaml
version: '3.8'
services:
  api:
    build: .
    restart: unless-stopped
    env_file: .env
    volumes:
      - ./uploads:/app/uploads
      - ./data:/app/data

  cloudflare-tunnel:
    image: cloudflare/cloudflared:latest
    command: tunnel run --token YOUR_TUNNEL_TOKEN
    restart: unless-stopped
```

### Data Persistence

Files are stored in:
- **Uploads**: `./uploads/` — User media files
- **Database**: `./data/database.sqlite` — Metadata and file index

For backups:
```bash
docker compose exec api tar czf ../backup.tar.gz uploads/ data/
```

### Monitoring

Check health:
```bash
curl http://localhost:3000/api/media \
  -H "x-api-key: YOUR_API_KEY"
```

View logs:
```bash
docker compose logs -f api
```

## Security Notes

### Hardened Against
- **Timing Attacks** — Padding and constant-time comparison
- **Brute Force** — 5 login attempts per 60 seconds
- **File Type Bypass** — Whitelist validation (not extension-based)
- **CORS Misconfiguration** — Disabled by default, opt-in only
- **Unauthorized Uploads** — API key + file type validation

### Best Practices

1. **Strong Secrets**: Generate with `openssl rand -hex 32`
2. **HTTPS Only**: Always use HTTPS in production (`BASE_URL=https://...`)
3. **Firewall**: Restrict port 3000 to reverse proxy only
4. **Backups**: Regularly backup `./uploads/` and `./data/`
5. **Rotation**: Change `API_KEY` and `ADMIN_PASSWORD` periodically
6. **Logs**: Monitor for repeated failed login attempts

## Troubleshooting

### Container won't start
```bash
docker compose logs api
```

### Can't upload files
- Check API key is correct
- File must be in allowed types (jpg, png, gif, mp4, mp3, ogg, webp, wav)
- Check disk space: `df -h ./uploads`

### Admin dashboard login fails
- Verify `.env` credentials match login attempt
- Check rate limiting hasn't blocked you (5 attempts/60s)
- Restart container: `docker compose restart api`

### High memory usage
- Run cleanup: `POST /api/admin/cleanup/orphaned`
- Remove large files: `GET /api/admin/cleanup/large?threshold=100000000`

## License

GPL v3 — See [LICENSE](./LICENSE) file for details.

Free to use, modify, and redistribute with attribution.

## Support

- **Issues**: https://github.com/Swompen/fivem-media-host/issues
- **Discussions**: https://github.com/Swompen/fivem-media-host/discussions

---

**Made with ❤️ for FiveM servers**
