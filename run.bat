@echo off
echo ========================================================
echo        Starting NEST Application Stack...
echo ========================================================

echo.
echo [1/5] Installing Node Dependencies...
call pnpm install

echo.
echo [2/5] Starting Docker Containers (Database)...
docker compose -f infra/docker/docker-compose.dev.yml up -d

echo.
echo [3/5] Generating Prisma Client...
call pnpm run prisma:generate

echo.
echo [4/5] Starting Backend in a new window...
start "NEST Backend" cmd /k "pnpm run dev:backend"

echo.
echo [5/5] Starting Frontend in a new window...
start "NEST Frontend" cmd /k "pnpm run dev:frontend"

echo.
echo ========================================================
echo All services are starting up!
echo - Database is running in Docker.
echo - Backend and Frontend are in separate windows.
echo You can safely close this launcher window.
echo ========================================================
pause
