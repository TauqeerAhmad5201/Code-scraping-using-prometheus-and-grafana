const express = require('express');
const client = require('prom-client');
const app = express();

// Create a Registry to register the metrics
const register = new client.Registry();

// Create custom metrics
const httpRequestCounter = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code']
});

const httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code']
});

// Create specific metrics for Node.js stats
const processStartTime = new client.Gauge({
    name: 'process_start_time_seconds',
    help: 'Process start time in seconds',
});

const nodeVersionInfo = new client.Gauge({
    name: 'nodejs_version_info',
    help: 'Node.js version info',
    labelNames: ['version', 'major', 'minor', 'patch']
});

const activeHandlers = new client.Gauge({
    name: 'nodejs_active_handles',
    help: 'Number of active handles',
});

const processRestart = new client.Counter({
    name: 'process_restart_count',
    help: 'Number of process restarts',
});

// Add these new metrics after your existing metric declarations
const cpuUsageMetric = new client.Gauge({
    name: 'process_cpu_usage',
    help: 'Process CPU Usage percentage',
});

const eventLoopLag = new client.Gauge({
    name: 'nodejs_eventloop_lag_seconds',
    help: 'Node.js event loop lag in seconds',
});

// Register custom metrics
register.registerMetric(httpRequestCounter);
register.registerMetric(httpRequestDuration);

// Register these new metrics
register.registerMetric(processStartTime);
register.registerMetric(nodeVersionInfo);
register.registerMetric(activeHandlers);
register.registerMetric(processRestart);

// Register the new metrics
register.registerMetric(cpuUsageMetric);
register.registerMetric(eventLoopLag);

// Enable the collection of default metrics
client.collectDefaultMetrics({
  app: 'node-application-monitoring',
  prefix: 'node_',
  timeout: 10000,
  register
});

// Set their values
processStartTime.setToCurrentTime();
const version = process.version.slice(1).split('.');
nodeVersionInfo.labels(process.version, version[0], version[1], version[2]).set(1);

// Update active handlers periodically
setInterval(() => {
    activeHandlers.set(process._getActiveHandles().length);
}, 10000);

// Add this after your existing setInterval blocks
// Update CPU usage every 5 seconds
setInterval(() => {
    const startUsage = process.cpuUsage();
    setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const totalUsage = (endUsage.user + endUsage.system) / 1000000; // Convert to seconds
        cpuUsageMetric.set(totalUsage);
    }, 100);
}, 5000);

// Monitor Event Loop Lag
let lastLoop = Date.now();
setInterval(() => {
    const now = Date.now();
    const lag = (now - lastLoop) / 1000;
    eventLoopLag.set(lag);
    lastLoop = now;
}, 1000);

// Middleware to measure request duration
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        httpRequestCounter.inc({ method: req.method, route: req.path, status_code: res.statusCode });
        httpRequestDuration.observe({ method: req.method, route: req.path, status_code: res.statusCode }, duration);
    });
    next();
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.setHeader('Content-Type', register.contentType);
  const metrics = await register.metrics();
  res.send(metrics);
});

// Root endpoint
app.get('/', (req, res) => {
  res.send('Node.js Monitoring with Prometheus and Grafana');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
