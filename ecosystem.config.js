module.exports = {
  apps: [
    {
      name: 'NestStarterApi',
      script: 'dist/src/main.js',
      instances: 1,
      env_production: {
        NODE_ENV: 'production',
      },
      env_development: {
        NODE_ENV: 'development',
      },
    },
  ],
};
