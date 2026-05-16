@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Installing dependencies...
  npm install
)
echo Seeding database...
npm run seed
echo Starting app...
npm start
pause
