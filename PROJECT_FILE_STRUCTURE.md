# Collaborative Whiteboard Application - Project Structure

## Project Overview
A real-time collaborative whiteboard application with chat functionality, built using Spring Boot (backend) and React (frontend).

---

## Root Directory

```
collaborative-whiteboard/
├── README.md                              # Project documentation
├── .gitignore                             # Git ignore rules
├── collaborative-whiteboard.code-workspace # VS Code workspace config
├── viva.txt                               # Project presentation notes
│
├── Deployment Configuration Files
│   ├── Dockerfile                         # Main Docker configuration
│   ├── docker-compose.yml                 # Docker Compose setup
│   ├── docker-compose.db.yml              # Database Docker setup
│   ├── k8s-deployment.yaml                # Kubernetes deployment config
│   ├── Procfile                           # Heroku/Railway deployment
│   ├── railway.json                       # Railway deployment config
│   ├── deploy-docker.sh                   # Docker deployment script
│   ├── deploy-kubernetes.sh               # Kubernetes deployment script
│   ├── deploy-aws-ecs.sh                  # AWS ECS deployment script
│   └── deploy-gcloud-run.sh               # Google Cloud Run deployment script
│
└── Documentation
    ├── DEPLOYMENT_GUIDE.md                # Deployment instructions
    ├── DOCKER_DEPLOYMENT.md               # Docker-specific deployment guide
    ├── DOCKER_SUMMARY.md                  # Docker summary
    ├── PRODUCTION_CHECKLIST.md            # Pre-production checklist
    ├── TEAM_SETUP.md                      # Team collaboration setup
    └── UI_ENHANCEMENTS.md                 # UI improvement notes
```

---

## Backend Application (whiteboard-app/)

### Root Files
```
whiteboard-app/
├── pom.xml                                # Maven project configuration
├── mvnw                                   # Maven wrapper (Linux/Mac)
├── mvnw.cmd                               # Maven wrapper (Windows)
├── README.md                              # Backend documentation
└── .gitignore                             # Backend-specific ignore rules
```

### Source Code Structure
```
src/
├── main/
│   ├── java/com/masterwayne/whiteboard_app/
│   │   ├── WhiteboardAppApplication.java  # Spring Boot entry point
│   │   │
│   │   ├── config/                        # Configuration Classes
│   │   │   ├── CorsConfig.java            # CORS configuration
│   │   │   ├── MonitoringConfig.java      # Monitoring setup
│   │   │   ├── WebConfig.java             # Web MVC configuration
│   │   │   ├── WebSocketConfig.java       # WebSocket configuration
│   │   │   └── WebSocketInterceptor.java  # WebSocket interceptor
│   │   │
│   │   ├── controller/                    # REST & WebSocket Controllers
│   │   │   ├── SessionController.java     # Session management endpoints
│   │   │   ├── WebSocketController.java   # WebSocket message handlers
│   │   │   ├── UploadController.java      # File upload endpoints
│   │   │   └── RecoveryController.java    # Data recovery endpoints
│   │   │
│   │   ├── dto/                           # Data Transfer Objects
│   │   │   ├── CreateSessionRequest.java  # Session creation request
│   │   │   ├── JoinSessionRequest.java    # Join session request
│   │   │   ├── SessionResponseDTO.java    # Session response data
│   │   │   ├── ChannelDTO.java            # Channel data transfer
│   │   │   ├── ChatPayload.java           # Chat message payload
│   │   │   └── UploadResponse.java        # File upload response
│   │   │
│   │   ├── model/                         # JPA Entity Models
│   │   │   ├── WhiteboardSession.java     # Session entity
│   │   │   ├── Channel.java               # Channel entity
│   │   │   ├── ChatMessage.java           # Chat message embeddable
│   │   │   ├── DrawPayload.java           # Drawing event embeddable
│   │   │   ├── Participant.java           # Participant entity
│   │   │   └── SessionManager.java        # Session manager embeddable
│   │   │
│   │   ├── repository/                    # JPA Repositories
│   │   │   └── WhiteboardSessionRepository.java
│   │   │
│   │   ├── service/                       # Business Logic
│   │   │   └── WhiteboardService.java     # Main service layer
│   │   │
│   │   ├── persistence/                   # Async Persistence
│   │   │   └── PersistenceWorker.java     # Background persistence worker
│   │   │
│   │   ├── storage/                       # File Storage
│   │   │   └── FallbackStorage.java       # Offline fallback storage
│   │   │
│   │   └── exception/                     # Custom Exceptions
│   │       ├── WhiteboardException.java   # Base exception
│   │       ├── SessionException.java      # Session-related errors
│   │       ├── PersistenceException.java  # Persistence errors
│   │       ├── SocketCommunicationException.java
│   │       └── RestExceptionhandler.java  # Global exception handler
│   │
│   └── resources/                         # Configuration Files
│       ├── application.properties         # Main configuration
│       ├── application-dev.properties     # Development config
│       ├── application-prod.properties    # Production config
│       ├── application-localpg.properties # PostgreSQL config
│       └── logback-spring.xml             # Logging configuration
│
└── test/                                  # Test Classes
    └── java/com/masterwayne/whiteboard_app/
        ├── WhiteboardAppApplicationTests.java
        ├── WhiteboardServiceTests.java
        └── SessionControllerIntegrationTests.java
```

### Runtime Directories
```
whiteboard-app/
├── data/                                  # Application Data
│   ├── uploads/                           # Uploaded files storage
│   └── offline-persist.jsonl              # Offline persistence backup
│
├── logs/                                  # Application Logs
│   ├── whiteboard-app.log                 # Current log file
│   ├── whiteboard-app-error.log           # Error logs
│   └── whiteboard-app-{date}.log.gz       # Archived logs
│
└── target/                                # Maven Build Output
    ├── classes/                           # Compiled Java classes
    ├── test-classes/                      # Compiled test classes
    ├── generated-sources/                 # Generated source files
    └── whiteboard-app-0.0.1-SNAPSHOT.jar  # Executable JAR
```

---

## Frontend Application (whiteboard-frontend/)

### Root Files
```
whiteboard-frontend/
├── package.json                           # NPM dependencies & scripts
├── package-lock.json                      # NPM lock file
├── README.md                              # Frontend documentation
├── Dockerfile                             # Frontend Docker config
└── FRONTEND_UPDATES.md                    # Frontend change log
```

### Public Assets
```
public/
├── index.html                             # HTML entry point
├── manifest.json                          # PWA manifest
├── robots.txt                             # SEO robots file
└── favicon.ico                            # Application icon
```

### Source Code
```
src/
├── index.js                               # React entry point
├── index.css                              # Global styles
├── App.js                                 # Main App component
├── App.css                                # App component styles
├── setupProxy.js                          # Proxy configuration
│
├── Pages/Components
│   ├── HomePage.js                        # Landing/home page
│   ├── HomePage.css                       # Home page styles
│   ├── LoginPage.js                       # Login/session page
│   ├── LoginPage.css                      # Login page styles
│   ├── WhiteboardPage.js                  # Main whiteboard page
│   ├── WhiteboardPage.css                 # Whiteboard page styles
│   ├── SessionForm.js                     # Session form component
│   └── SessionForm.css                    # Session form styles
│
├── Canvas Module
│   ├── Canvas.js                          # Drawing canvas component
│   └── Canvas.css                         # Canvas styles
│
├── Chat Module
│   ├── Chat.js                            # Chat component
│   └── Chat.css                           # Chat styles
│
└── Channel Management
    ├── ChannelManager.js                  # Channel switcher component
    └── ChannelManager.css                 # Channel manager styles
```

### Build Output
```
whiteboard-frontend/
├── build/                                 # Production build
│   ├── static/                            # Static assets
│   │   ├── css/                           # Compiled CSS
│   │   ├── js/                            # Compiled JavaScript
│   │   └── media/                         # Media files
│   ├── index.html                         # Optimized HTML
│   └── manifest.json                      # PWA manifest
│
└── node_modules/                          # NPM dependencies
```

---

## Technology Stack

### Backend
- **Framework**: Spring Boot 3.5.6
- **Language**: Java 21
- **Build Tool**: Maven 3.9+
- **Database**: H2 (in-memory), PostgreSQL (production)
- **ORM**: Hibernate / JPA
- **WebSocket**: STOMP Protocol
- **Security**: CORS configured
- **Logging**: SLF4J + Logback

### Frontend
- **Framework**: React 18
- **Language**: JavaScript (ES6+)
- **Build Tool**: Create React App / Webpack
- **WebSocket**: STOMP.js + SockJS
- **Styling**: CSS3 (Component-scoped)
- **Icons**: React Icons
- **HTTP Client**: Fetch API

### DevOps & Deployment
- **Containerization**: Docker, Docker Compose
- **Orchestration**: Kubernetes
- **Cloud Platforms**: AWS ECS, Google Cloud Run, Railway, Heroku
- **Version Control**: Git / GitHub
- **CI/CD**: GitHub Actions (disabled)

---

## Key Features by Module

### Backend Modules
1. **Session Management** - Create, join, and manage whiteboard sessions
2. **Real-time Communication** - WebSocket-based drawing and chat
3. **Persistence Layer** - Async background persistence with fallback storage
4. **File Upload** - Image and file attachment support
5. **Channel System** - Multi-channel support per session
6. **Recovery System** - Backup and replay functionality

### Frontend Modules
1. **Drawing Canvas** - Multi-tool drawing with smooth pen rendering
2. **Real-time Chat** - Text messages with image/file attachments
3. **Channel Management** - Switch between multiple channels
4. **Session Management** - Create/join sessions with user authentication
5. **Responsive UI** - Dark mode, minimizable chat, mobile-friendly

---

## Port Configuration
- **Backend**: 8081 (Spring Boot)
- **Frontend**: 3000 (React Dev Server)
- **H2 Console**: /h2-console (development only)
- **WebSocket**: /ws endpoint

---

## Database Schema

### Tables
1. **sessions** - Whiteboard sessions
2. **channels** - Channels within sessions
3. **participants** - Session participants
4. **channel_shapes** - Drawing events
5. **channel_chat_messages** - Chat messages

---

*Generated on: January 3, 2026*
*Repository: https://github.com/noob-tansim/collaborative-whiteboard*
