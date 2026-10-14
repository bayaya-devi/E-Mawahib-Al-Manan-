module.exports = {
  apps: [{
    name: "e-mawahib",
    script: "node_modules/next/dist/bin/next",
    args: "start",
    instances: 1,
    autorestart: true,
    max_memory_restart: "768M",
    exp_backoff_restart_delay: 100,
    env: { NODE_ENV: "production", PORT: 3000 },
  }],
};
