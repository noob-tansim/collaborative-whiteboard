# Whiteboard App – Backend

This Spring Boot service powers the collaborative whiteboard experience. It exposes REST and WebSocket endpoints, persists sessions/channels, and streams chat/drawing events.

## Profiles & Databases

The application now supports three fully separate profiles so you can pick the right database for each scenario:

| Profile       | Command snippet                                                         | Database                                     | Use case |
|---------------|-------------------------------------------------------------------------|----------------------------------------------|----------|
| `dev` (default)     | `./mvnw spring-boot:run`                                                  | In-memory H2 (auto-configured)               | Fast local hacking/tests |
| `localpg`     | `SPRING_PROFILES_ACTIVE=localpg ./mvnw spring-boot:run`                 | Local Postgres (Docker or native install)    | Realistic local testing without touching prod |
| `prod`        | `SPRING_PROFILES_ACTIVE=prod ./mvnw spring-boot:run`                    | Supabase-hosted PostgreSQL                   | Deployments / manual prod checks |

> Tip: In IntelliJ/VS Code you can set `SPRING_PROFILES_ACTIVE` in the run configuration instead of exporting it in the shell.

## Local Postgres via Docker

1. Start the container (runs Postgres 16 on port 5432):

	```bash
	docker compose -f docker-compose.db.yml up -d
	```

2. Verify it’s healthy (`docker ps` should show `whiteboard-postgres`).
3. Run the backend with `SPRING_PROFILES_ACTIVE=localpg` so Spring loads `application-localpg.properties`.
4. Stop the DB when you are done:

	```bash
	docker compose -f docker-compose.db.yml down
	```

The default credentials are `whiteboard` / `whiteboard`, and the database name is `whiteboard_local`. Feel free to change them in both `docker-compose.db.yml` and `application-localpg.properties` if needed.

## Production profile

`application-prod.properties` continues to point at the Supabase instance. If you hit “max client connections” again, consider:

- Increasing the Supabase plan / connection limit
- Shutting down stray backend instances
- Tweaking the Hikari pool size in `application-prod.properties`

## Frontend pairing

The React frontend reads `REACT_APP_API_URL` / `REACT_APP_WS_URL`. Point those at the backend corresponding to the profile you are running. Example for local work:

```bash
REACT_APP_API_URL=http://localhost:8081
REACT_APP_WS_URL=http://localhost:8081/ws
npm start
```

## Useful commands

```bash
# Run tests
./mvnw test

# Package the backend
./mvnw clean package

# Apply database migrations (when Flyway/Liquibase is added later)
./mvnw flyway:migrate
```

Have fun building! Reach out if you need help wiring more services into these profiles.

