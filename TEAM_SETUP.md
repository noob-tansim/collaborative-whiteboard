# 🚀 Collaborative Whiteboard - Team Setup Guide

Welcome to the team! This guide will help you get the project running locally in **5 minutes**.

## 📋 Prerequisites

Make sure you have installed:
- **Node.js** (v16+) and **npm** → [Download](https://nodejs.org/)
- **Java 17+** → [Download](https://www.oracle.com/java/technologies/downloads/)
- **Docker** (optional but recommended) → [Download](https://www.docker.com/)
- **Git** → [Download](https://git-scm.com/)

---

## 🎯 Quick Start (5 minutes)

### Step 1: Clone & Navigate
```bash
cd /path/to/whiteboard
```

### Step 2: Start the Database (PostgreSQL)
```bash
docker compose -f docker-compose.db.yml up -d
```
✅ Database runs on `localhost:5432`

### Step 3: Start the Backend (Java Spring Boot)
```bash
cd whiteboard-app
SPRING_PROFILES_ACTIVE=localpg ./mvnw spring-boot:run
```
✅ Backend runs on `http://localhost:8081`

### Step 4: Start the Frontend (React)
Open a **new terminal** and run:
```bash
cd whiteboard-frontend
npm install  # First time only
npm start
```
✅ Frontend runs on `http://localhost:3000`

---

## 🏗️ Project Structure

```
whiteboard/
├── whiteboard-app/              # 🔧 Backend (Java Spring Boot)
│   ├── src/
│   ├── pom.xml
│   ├── README.md
│   └── Dockerfile
├── whiteboard-frontend/         # ⚛️ Frontend (React)
│   ├── src/
│   ├── package.json
│   ├── README.md
│   └── Dockerfile
├── docker-compose.yml           # Full stack (all services)
├── docker-compose.db.yml        # Database only
└── DEPLOYMENT_GUIDE.md          # Production deployment
```

---

## 🎨 Frontend Development

You'll be working primarily in `whiteboard-frontend/src/`:

- **`components/`** → Reusable UI components
- **`pages/`** → Full page components
- **`services/`** → API & WebSocket communication
- **`styles/`** → CSS/styling

### Key Frontend Technologies
- **React 18** - UI framework
- **STOMP/WebSocket** - Real-time drawing sync
- **Canvas API** - Drawing implementation
- **Tailwind CSS** - Styling

### Common Commands
```bash
npm start       # Run dev server
npm run build   # Production build
npm test        # Run tests
npm run eject   # Advanced config (⚠️ one-way operation)
```

---

## 🔧 Backend Overview (Reference)

The backend handles:
- ✅ Session management
- ✅ Channel creation
- ✅ Chat messaging
- ✅ Drawing shape persistence
- ✅ WebSocket real-time sync

**You don't need to modify the backend unless you're adding new features.**

---

## 🗂️ Database Profiles

Backend supports 3 profiles:

| Profile | Command | Database | Use Case |
|---------|---------|----------|----------|
| `dev` | `./mvnw spring-boot:run` | In-memory H2 | Quick testing |
| `localpg` | `SPRING_PROFILES_ACTIVE=localpg ./mvnw spring-boot:run` | Local Postgres (Docker) | **Recommended for team dev** |
| `prod` | `SPRING_PROFILES_ACTIVE=prod ./mvnw spring-boot:run` | Supabase PostgreSQL | Production deployment |

---

## 🧪 Testing the Setup

Once all services are running, open your browser and test:

1. **Frontend** → http://localhost:3000
2. **Create a session** → Enter session name
3. **Join channel** → Default "general" channel
4. **Draw something** → Should appear in real-time
5. **Send chat message** → Should sync instantly
6. **Open in another tab** → Both tabs should sync in real-time

---

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Check what's using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

### Database Connection Failed
```bash
# Verify Docker container is running
docker ps

# Check logs
docker compose -f docker-compose.db.yml logs
```

### Backend not responding
```bash
# Check if backend is running on 8081
curl http://localhost:8081/api/health

# Check logs
tail -f whiteboard-app/logs/*
```

### Frontend can't connect to backend
- Verify `REACT_APP_API_URL` in `.env.local` is `http://localhost:8081`
- Restart frontend: `npm start`

---

## 📝 Making Changes

### Frontend Changes
1. Edit files in `whiteboard-frontend/src/`
2. Save → Auto-reloads in browser
3. Check console (F12) for any errors

### Backend Changes
1. Edit files in `whiteboard-app/src/`
2. Rebuild: `./mvnw clean compile`
3. Restart backend

---

## 🚀 Deployment

When ready for production, see:
- `DEPLOYMENT_GUIDE.md` - Complete deployment steps
- `DOCKER_DEPLOYMENT.md` - Docker deployment guide
- `docker-compose.yml` - Full stack containerization

---

## 💡 Feature Overview

### Current Features ✅
- 🎨 **Real-time Drawing** - Draw shapes with live sync
- 💬 **Chat System** - Message users in channels
- 📁 **Sessions & Channels** - Organize collaboration
- 🔄 **Real-time Sync** - WebSocket for instant updates
- 📦 **Offline Support** - Local caching with IndexedDB

### Ready for Enhancement
- User authentication & profiles
- More drawing tools
- File uploads
- Permissions & roles
- Drawing history & undo/redo

---

## 🤝 Collaboration Tips

- **Coordinate your changes** before starting
- **Test locally** before committing
- **Use branches** for feature development
- **Pull before pushing** to avoid conflicts
- **Document your changes** in commit messages

---

## ❓ Need Help?

- Check backend README → `whiteboard-app/README.md`
- Check frontend README → `whiteboard-frontend/README.md`
- Check deployment guide → `DEPLOYMENT_GUIDE.md`
- Ask the team lead!

---

**Happy coding! 🎉**
