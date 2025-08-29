module.exports = {
  apps: [
    {
      name: 'setukreview-frontend',
      script: 'serve',
      args: '-s frontend/build -p 3000',
      cwd: '/app',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/app/logs/frontend-error.log',
      out_file: '/app/logs/frontend-out.log',
      log_file: '/app/logs/frontend.log',
      time: true
    },
    {
      name: 'setukreview-backend',
      script: 'backend/server.js',
      cwd: '/app',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        CORS_ORIGIN: 'http://43.201.9.224:3000'
      },
      error_file: '/app/logs/backend-error.log',
      out_file: '/app/logs/backend-out.log', 
      log_file: '/app/logs/backend.log',
      time: true
    }
  ]
};