# FiveM Media Host

Self-hosted media hosting API for FiveM servers. Upload, manage, and serve images, videos, and audio files with admin dashboard, rate limiting, and secure authentication.
<img width="2539" height="1262" alt="{ABE9906D-B64A-47D1-8176-72414B4A2131}" src="https://github.com/user-attachments/assets/3598761e-d164-4a28-8fbe-6dde4a237142" />

## Features

- RESTful media API with file upload/download
- Web-based admin dashboard
- JWT authentication for admin access
- API key authentication for FiveM scripts
- Rate limiting (5 login attempts per 60 seconds)
- File type validation (jpg, png, gif, mp4, mp3, ogg, webp, wav)
- Batch operations (download as ZIP, bulk delete)
- Statistics and file management
- SQLite database (self-contained, zero dependencies)
- Docker ready

## Quick Start

Clone and configure:
```bash
git clone https://github.com/Swompen/fivem-media-host.git
cd fivem-media-host
cp .env.example .env
```

Edit `.env` with your settings:
```env
API_KEY=your-random-api-key
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-strong-password
JWT_SECRET=your-random-64-char-secret
BASE_URL=https://media.your-domain.com
```

Start the server:
```bash
docker compose up -d
```

Access:
- Admin Dashboard: http://localhost:3000/admin
- Media API: http://localhost:3000/api/media

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| PORT | No | Server port (default: 3000) |
| BASE_URL | No | Full URL for file links |
| API_KEY | Yes | Secret key for API authentication |
| ADMIN_USERNAME | Yes | Admin dashboard username |
| ADMIN_PASSWORD | Yes | Admin dashboard password |
| JWT_SECRET | Yes | JWT signing secret (64+ chars) |
| CORS_ORIGIN | No | Enable CORS for this origin (disabled by default) |

Generate secure secrets:
```bash
openssl rand -hex 32  # For API_KEY and JWT_SECRET
```

## API Endpoints

### List Media
```
GET /api/media
Headers: x-api-key: YOUR_API_KEY

Query parameters:
  page=1          # Page number
  limit=50        # Items per page
  type=image      # Filter: image, audio, video
  search=query    # Search filename
  sort=createdAt  # Field to sort by
  order=DESC      # ASC or DESC
```

Response:
```json
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
  "pagination": { "page": 1, "limit": 50, "total": 150 }
}
```

### Upload Media
```
POST /api/upload
Headers: x-api-key: YOUR_API_KEY
Body: multipart/form-data with file field

Response: Media object (same as list response)
```

### Admin Login
```
POST /api/admin/auth/login
Body: { "username": "admin", "password": "your-password" }

Response: { "access_token": "eyJhbGc..." }
```

### Admin Endpoints (require Authorization header with JWT)

Get statistics:
```
GET /api/admin/stats
```

Get all media:
```
GET /api/admin/media?page=1&limit=50&search=query
```

Delete media:
```
DELETE /api/admin/media/:id
```

Batch download:
```
POST /api/admin/download
Body: { "ids": ["uuid1", "uuid2"] }
Response: ZIP file
```

Find orphaned files:
```
GET /api/admin/cleanup/orphaned
```

Delete orphaned files:
```
POST /api/admin/cleanup/orphaned
```

## LB-Phone Integration

Add to FiveM `server.cfg`:
```
setr lbphone_media_host "https://your-domain.com"
setr lbphone_media_api_key "YOUR_API_KEY_HERE"
```


## License

GPL v3 - See LICENSE file

## Support

Issues: https://github.com/Swompen/fivem-media-host/issues

## This project is based on https://github.com/EGOistentum/fivem-media with security hardening and production improvements.

