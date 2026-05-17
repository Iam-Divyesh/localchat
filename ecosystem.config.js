module.exports = {
  apps: [{
    name: "localchat",
    script: "lib/cli.js",
    args: "start",
    node_args: "--experimental-sqlite",
    env: {
      NODE_ENV: "production",
      PORT: 5001,
    },
    restart_delay: 2000,
    max_restarts: 10,
    autorestart: true,
    watch: false,
  }],
};
