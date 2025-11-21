# Docker Deployment Guide

## Quick Start

### 1. Prerequisites
```bash
# Install Docker and Docker Compose
docker --version
docker-compose --version
```

### 2. Setup Environment
```bash
cp .env.docker .env
# Edit .env with your configuration
nano .env
```

### 3. Build and Run
```bash
# Build images
docker-compose build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### 4. Verify Services
```bash
# Check container status
docker-compose ps

# Test backend
curl http://localhost:8081/actuator/health

# Test frontend
curl http://localhost:3000

# Check database
docker-compose exec postgres pg_isready -U whiteboard

# Check Redis
docker-compose exec redis redis-cli ping
```

---

## Service Details

### Backend (Spring Boot)
- **Port**: 8081
- **Health Check**: `/actuator/health`
- **Database**: PostgreSQL (auto-initialized)
- **Cache**: Redis
- **Profile**: `prod`

### Frontend (React + Nginx)
- **Port**: 3000
- **Proxy**: Routes /api to backend
- **WebSocket**: Proxied from backend

### PostgreSQL
- **Port**: 5432
- **Default DB**: whiteboard
- **Default User**: whiteboard
- **Volume**: postgres-data (persistent)

### Redis
- **Port**: 6379
- **Auth**: Enabled (password-protected)
- **Volume**: redis-data (persistent)

---

## Production Deployment

### With Supabase PostgreSQL
Update `docker-compose.yml`:
```yaml
backend:
  environment:
    SPRING_DATASOURCE_URL: jdbc:postgresql://YOUR_SUPABASE_URL:5432/postgres
    SPRING_DATASOURCE_USERNAME: postgres
    SPRING_DATASOURCE_PASSWORD: ${SUPABASE_PASSWORD}
```

### Environment Variables (Update Before Deployment)
```bash
# CRITICAL: Change these values in production
DB_PASSWORD=<strong-password>
REDIS_PASSWORD=<strong-password>
JWT_SECRET=<random-long-string>
```

---

## Monitoring & Troubleshooting

### View Logs
```bash
# All services
docker-compose logs

# Specific service
docker-compose logs backend
docker-compose logs frontend
docker-compose logs postgres

# Follow logs
docker-compose logs -f
```

### Database Access
```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U whiteboard -d whiteboard

# Common commands
\dt              # List tables
\du              # List users
SELECT * FROM sessions;
```

### Redis Access
```bash
# Connect to Redis
docker-compose exec redis redis-cli -a <REDIS_PASSWORD>

# Common commands
PING             # Test connection
KEYS *           # List all keys
FLUSHALL         # Clear all data (careful!)
```

### Restart Services
```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart backend

# Hard restart (rebuild)
docker-compose down && docker-compose up -d
```

---

## Performance Tuning

### Memory Limits
Edit `docker-compose.yml`:
```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 1G
        reservations:
          memory: 512M
```

### Connection Pool
Backend `application-prod.properties`:
```properties
spring.datasource.hikari.maximum-pool-size=20
spring.datasource.hikari.minimum-idle=5
```

---

## Security Checklist

- [ ] Change all default passwords in `.env`
- [ ] Use strong JWT_SECRET (32+ characters)
- [ ] Enable HTTPS (use reverse proxy like nginx/traefik)
- [ ] Restrict database access (firewall rules)
- [ ] Regular backups of postgres-data and redis-data volumes
- [ ] Monitor container logs for errors
- [ ] Keep Docker images updated

---

## Backup & Restore

### Backup Database
```bash
docker-compose exec postgres pg_dump -U whiteboard whiteboard > backup.sql
```

### Restore Database
```bash
docker-compose exec -T postgres psql -U whiteboard whiteboard < backup.sql
```

### Backup Redis
```bash
docker cp whiteboard-redis:/data/dump.rdb ./redis-backup.rdb
```

---

## Useful Docker Commands

```bash
# Remove unused resources
docker system prune

# View resource usage
docker stats

# Clean up volumes
docker volume prune

# Push to registry
docker tag whiteboard-backend:latest myregistry/whiteboard-backend:latest
docker push myregistry/whiteboard-backend:latest
```

---

## Deployment Platforms

### AWS ECS
```bash
# Push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com
docker tag whiteboard-backend:latest <account>.dkr.ecr.us-east-1.amazonaws.com/whiteboard-backend:latest
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/whiteboard-backend:latest
```

### Google Cloud Run
```bash
gcloud builds submit --tag gcr.io/PROJECT-ID/whiteboard-backend
gcloud run deploy whiteboard-backend --image gcr.io/PROJECT-ID/whiteboard-backend
```

### Azure Container Instances
```bash
az acr build --registry myregistry --image whiteboard-backend:latest .
az container create --resource-group mygroup --name whiteboard --image myregistry.azurecr.io/whiteboard-backend:latest
```

---

## Support & Debugging

For issues:
1. Check `docker-compose logs`
2. Verify environment variables in `.env`
3. Ensure all ports are available (no conflicts)
4. Check firewall/network rules
5. Verify Docker daemon is running

```bash
# Debug mode
docker-compose up --no-start
docker-compose exec backend bash
```
