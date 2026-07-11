// PM2 ecosystem for Project Teams — API + RAG worker.
// Styled to match your avmg setup (absolute cwd, explicit log files, env_production).
//
// This file lives in the backend dir, so derive paths from __dirname — that way
// `cwd` is always correct no matter where the repo is cloned, and there's no
// absolute path to mistype.
const BACKEND_DIR = __dirname;
const LOG_DIR = `${BACKEND_DIR}/logs`; // run `mkdir -p` on this once

module.exports = {
  apps: [
    {
      name: "pt-api",
      cwd: BACKEND_DIR,
      script: "src/app.js",
      instances: 1, // single instance: in-memory Socket.IO presence, no Redis adapter
      exec_mode: "fork", // fork not cluster (sockets would split across workers)
      max_memory_restart: "400M",
      env_production: {
        NODE_ENV: "production",
        // Auth cookie security is controlled by COOKIE_SECURE (see auth.js), NOT
        // NODE_ENV. Keep it false on HTTP; set "true" only once HTTPS is in front.
        COOKIE_SECURE: "false",
      },
      out_file: `${LOG_DIR}/api-out.log`,
      error_file: `${LOG_DIR}/api-error.log`,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
    {
      name: "pt-worker",
      cwd: BACKEND_DIR,
      script: "src/worker.js",
      instances: 1, // workers should be 1 instance only
      exec_mode: "fork", // fork not cluster for workers
      max_memory_restart: "500M", // PDF parsing + embeddings can spike memory
      // worker.js closes the BullMQ worker on SIGTERM; PM2 defaults to SIGINT,
      // so switch the signal and give in-flight jobs a few seconds to drain.
      kill_signal: "SIGTERM",
      kill_timeout: 5000,
      env_production: {
        NODE_ENV: "production",
      },
      out_file: `${LOG_DIR}/worker-out.log`,
      error_file: `${LOG_DIR}/worker-error.log`,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
