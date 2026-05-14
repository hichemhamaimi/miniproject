# Docker Deployment

This project can run through Docker Compose with:

- MySQL 8.4
- MongoDB 7
- Redis
- Qdrant
- Node backend
- Nginx-served React frontend

## 1. Prepare Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Then update at least these values:

```env
MYSQL_ROOT_PASSWORD=change_me
ACCESS_TOKEN_SECRET=change_me_long_random_value
REFRESH_TOKEN_SECRET=change_me_long_random_value
SEB_TOKEN_SECRET=change_me_long_random_value
SEB_SESSION_TRANSFER_SECRET=change_me_long_random_value
APP_ENCRYPTION_KEY=change_me_long_random_value
FRONTEND_URL=http://localhost:5173
PUBLIC_API_URL=http://localhost:3500
CORS_ORIGINS=http://localhost:5173
VITE_API_URL=http://localhost:3500
```

Add whichever AI provider key you want to use:

```env
OPENAI_API_KEY=
GEMINI_API_KEY=
GROQ_API_KEY=
```

## 2. Start Everything

```bash
docker compose up --build
```

Frontend:

```text
http://localhost:5173
```

Backend:

```text
http://localhost:3500
```

## 3. Database Seeding

On first startup, MySQL initializes with the schema and one superadmin user only:

```text
dbs/sqldbscript.sql
dbs/superadmin_seed.sql
```

Default bootstrap login:

```text
Username: superadmin
Password: admin123
```

Change this password immediately after deployment.

If you already created the MySQL Docker volume and want to re-run the schema and seed files, remove the volume first:

```bash
docker compose down -v
docker compose up --build
```

## 4. Production Notes

For real deployment, set public URLs to your domain:

```env
FRONTEND_URL=https://your-frontend-domain.com
PUBLIC_API_URL=https://your-api-domain.com
CORS_ORIGINS=https://your-frontend-domain.com
VITE_API_URL=https://your-api-domain.com
```

Use long random secrets and keep `APP_ENCRYPTION_KEY` stable after the first deployment, because stored provider API keys are encrypted with it.
