$ErrorActionPreference = "Stop"

docker compose up --build -d
Write-Output "Server started at http://127.0.0.1:8000"
