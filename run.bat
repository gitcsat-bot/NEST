@echo off
echo ========================================================
echo        Starting NEST Application Stack...
echo ========================================================

echo.
echo [1/4] Starting Docker Containers (Database)...
docker-compose -f infra/docker/docker-compose.dev.yml up -d

echo.
echo [2/4] Generating Prisma Client...
call pnpm run prisma:generate

echo.
echo [3/4] Starting Backend in a new window...
start "NEST Backend" cmd /k "pnpm run dev:backend"

echo.
echo [4/4] Starting Frontend in a new window...
start "NEST Frontend" cmd /k "pnpm run dev:frontend"

echo.
echo ========================================================
echo All services are starting up!
echo - Database is running in Docker.
echo - Backend and Frontend are in separate windows.
echo You can safely close this launcher window.
echo ========================================================
pause
