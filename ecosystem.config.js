module.exports = {
  apps: [
    {
      name: 'setukreview-backend',
      script: 'dist/server.js',
      cwd: '/home/ubuntu/setukreview/backend',
      instances: 1,
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        UPSTAGE_API_KEY: 'up_kcU1IMWm9wcC1rqplsIFMsEeqlUXN'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
        UPSTAGE_API_KEY: 'up_kcU1IMWm9wcC1rqplsIFMsEeqlUXN'
      },
      log_file: '/home/ubuntu/logs/setukreview-backend.log',
      out_file: '/home/ubuntu/logs/setukreview-backend-out.log',
      error_file: '/home/ubuntu/logs/setukreview-backend-error.log',
      time: true,
      merge_logs: true
    }
  ]
};