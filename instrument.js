const Sentry = require("@sentry/node")

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: "production",
  tracesSampleRate: 1.0,
})
