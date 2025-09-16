const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(express.json({ limit: '10mb' })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Store webhook data in memory (in production, use a database)
const webhookData = [];

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Simple Webhook Server is running!',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    totalWebhooks: webhookData.length
  });
});

// Main webhook endpoint - accepts POST requests
app.post('/webhook', (req, res) => {
  try {
    const webhookPayload = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      headers: req.headers,
      body: req.body,
      query: req.query,
      method: req.method,
      url: req.url,
      ip: req.ip || req.connection.remoteAddress
    };

    // Store the webhook data
    webhookData.push(webhookPayload);

    // Log the webhook data
    console.log('📨 New webhook received:', {
      id: webhookPayload.id,
      timestamp: webhookPayload.timestamp,
      headers: webhookPayload.headers,
      body: webhookPayload.body
    });

    // Respond with success
    res.status(200).json({
      success: true,
      message: 'Webhook received successfully',
      webhookId: webhookPayload.id,
      timestamp: webhookPayload.timestamp
    });

  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get all webhooks endpoint
app.get('/webhooks', (req, res) => {
  res.json({
    success: true,
    count: webhookData.length,
    webhooks: webhookData
  });
});

// Get specific webhook by ID
app.get('/webhook/:id', (req, res) => {
  const webhookId = req.params.id;
  const webhook = webhookData.find(w => w.id === webhookId);
  
  if (!webhook) {
    return res.status(404).json({
      success: false,
      message: 'Webhook not found'
    });
  }

  res.json({
    success: true,
    webhook: webhook
  });
});

// Clear all webhooks (useful for testing)
app.delete('/webhooks', (req, res) => {
  webhookData.length = 0;
  res.json({
    success: true,
    message: 'All webhooks cleared'
  });
});

// Catch-all for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    availableEndpoints: [
      'GET / - Health check',
      'POST /webhook - Receive webhook',
      'GET /webhooks - List all webhooks',
      'GET /webhook/:id - Get specific webhook',
      'DELETE /webhooks - Clear all webhooks'
    ]
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Unhandled error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'production' ? 'Something went wrong' : error.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Webhook server is running on port ${PORT}`);
  console.log(`📡 Webhook URL: http://localhost:${PORT}/webhook`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/webhooks`);
});

module.exports = app;
