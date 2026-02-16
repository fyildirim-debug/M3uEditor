const express = require('express');
const path = require('path');
const cors = require('cors');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();

// Core middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '..', 'public')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/channels'));
app.use('/api', require('./routes/categories'));
app.use('/api', require('./routes/import'));
app.use('/api', require('./routes/epg'));
app.use('/api', require('./routes/export'));
app.use('/api', require('./routes/playlists'));

// Client-side routing: serve index.html for non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// 404 handler for unknown routes (before error handler)
app.use(notFound);

// Error handler (must be last)
app.use(errorHandler);

module.exports = app;
