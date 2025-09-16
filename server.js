const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(express.json({ limit: '10mb' })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Store webhook data in memory (in production, use a database)
const webhookData = [];
const extractedData = [];

// Webhook tokens/secrets storage
const webhookTokens = new Map();
const defaultToken = 'webhook-secret-2024'; // Default token for testing

// Initialize with default token
webhookTokens.set(defaultToken, {
  name: 'Default Token',
  created: new Date().toISOString(),
  lastUsed: null,
  usageCount: 0
});

// Token validation middleware
function validateWebhookToken(req, res, next) {
  const token = req.headers['x-webhook-token'] || req.headers['authorization']?.replace('Bearer ', '') || req.query.token;
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Webhook token required',
      hint: 'Add X-Webhook-Token header or ?token=your-token query parameter'
    });
  }
  
  if (!webhookTokens.has(token)) {
    return res.status(401).json({
      success: false,
      message: 'Invalid webhook token',
      hint: 'Use a valid token or create a new one'
    });
  }
  
  // Update token usage
  const tokenData = webhookTokens.get(token);
  tokenData.lastUsed = new Date().toISOString();
  tokenData.usageCount++;
  webhookTokens.set(token, tokenData);
  
  req.webhookToken = token;
  next();
}

// Helper function to extract data from URL with optional token
async function extractDataFromUrl(url, token = null) {
  try {
    console.log(`🔍 Extracting data from URL: ${url}`);
    
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    };
    
    // Add token if provided
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['X-API-Key'] = token;
      console.log(`🔑 Using token for authentication`);
    }
    
    const response = await axios.get(url, {
      timeout: 10000,
      headers: headers
    });

    const contentType = response.headers['content-type'] || '';
    let extractedContent = {};

    if (contentType.includes('application/json')) {
      // Handle JSON data
      extractedContent = {
        type: 'json',
        data: response.data,
        url: url,
        timestamp: new Date().toISOString()
      };
    } else if (contentType.includes('text/html')) {
      // Handle HTML data
      const $ = cheerio.load(response.data);
      extractedContent = {
        type: 'html',
        title: $('title').text().trim(),
        description: $('meta[name="description"]').attr('content') || '',
        text: $('body').text().replace(/\s+/g, ' ').trim(),
        links: $('a[href]').map((i, el) => $(el).attr('href')).get(),
        images: $('img[src]').map((i, el) => $(el).attr('src')).get(),
        url: url,
        timestamp: new Date().toISOString()
      };
    } else if (contentType.includes('text/plain') || contentType.includes('text/markdown')) {
      // Handle plain text or markdown
      extractedContent = {
        type: 'text',
        content: response.data,
        url: url,
        timestamp: new Date().toISOString()
      };
    } else {
      // Handle other content types
      extractedContent = {
        type: 'other',
        contentType: contentType,
        content: response.data,
        url: url,
        timestamp: new Date().toISOString()
      };
    }

    return extractedContent;
  } catch (error) {
    console.error(`❌ Error extracting data from ${url}:`, error.message);
    return {
      type: 'error',
      error: error.message,
      url: url,
      timestamp: new Date().toISOString()
    };
  }
}

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Simple Webhook Server is running!',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    totalWebhooks: webhookData.length
  });
});

// Main webhook endpoint - accepts POST requests (with token validation)
app.post('/webhook', validateWebhookToken, async (req, res) => {
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

    // Check if webhook contains URLs to extract data from
    const urlsToExtract = [];
    
    // Look for URLs in the webhook body
    if (req.body && typeof req.body === 'object') {
      const bodyStr = JSON.stringify(req.body);
      const urlRegex = /https?:\/\/[^\s"<>]+/g;
      const foundUrls = bodyStr.match(urlRegex);
      if (foundUrls) {
        urlsToExtract.push(...foundUrls);
      }
    }

    // Look for URLs in headers
    if (req.headers.referer) {
      urlsToExtract.push(req.headers.referer);
    }

    // Extract data from URLs if found
    let extractedResults = [];
    if (urlsToExtract.length > 0) {
      console.log(`🔍 Found ${urlsToExtract.length} URLs to extract data from`);
      
      for (const url of urlsToExtract) {
        try {
          const extractedContent = await extractDataFromUrl(url, req.webhookToken);
          extractedResults.push(extractedContent);
          extractedData.push(extractedContent);
          
          console.log(`✅ Successfully extracted data from: ${url}`);
          
          // Display extracted data in terminal
          console.log('\n' + '='.repeat(80));
          console.log(`📄 EXTRACTED DATA FROM: ${url}`);
          console.log('='.repeat(80));
          console.log(`Type: ${extractedContent.type}`);
          console.log(`Timestamp: ${extractedContent.timestamp}`);
          console.log('-'.repeat(40));
          
          if (extractedContent.type === 'html') {
            console.log(`Title: ${extractedContent.title}`);
            console.log(`Description: ${extractedContent.description}`);
            console.log(`\nText Content (first 500 chars):`);
            console.log(extractedContent.text.substring(0, 500) + '...');
            console.log(`\nLinks found: ${extractedContent.links.length}`);
            console.log(`Images found: ${extractedContent.images.length}`);
          } else if (extractedContent.type === 'json') {
            console.log('JSON Data:');
            console.log(JSON.stringify(extractedContent.data, null, 2));
          } else if (extractedContent.type === 'text') {
            console.log('Text Content:');
            console.log(extractedContent.content.substring(0, 1000) + '...');
          } else if (extractedContent.type === 'error') {
            console.log(`❌ Error: ${extractedContent.error}`);
          } else {
            console.log('Raw Content:');
            console.log(JSON.stringify(extractedContent, null, 2));
          }
          
          console.log('='.repeat(80) + '\n');
          
        } catch (error) {
          console.error(`❌ Failed to extract data from ${url}:`, error.message);
        }
      }
    }

    // Respond with success
    res.status(200).json({
      success: true,
      message: 'Webhook received successfully',
      webhookId: webhookPayload.id,
      timestamp: webhookPayload.timestamp,
      urlsFound: urlsToExtract.length,
      extractedData: extractedResults.length > 0 ? extractedResults : null
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

// Public webhook endpoint (no token required)
app.post('/webhook-public', async (req, res) => {
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
    console.log('📨 New public webhook received:', {
      id: webhookPayload.id,
      timestamp: webhookPayload.timestamp,
      headers: webhookPayload.headers,
      body: webhookPayload.body
    });

    // Check if webhook contains URLs to extract data from
    const urlsToExtract = [];
    
    // Look for URLs in the webhook body
    if (req.body && typeof req.body === 'object') {
      const bodyStr = JSON.stringify(req.body);
      const urlRegex = /https?:\/\/[^\s"<>]+/g;
      const foundUrls = bodyStr.match(urlRegex);
      if (foundUrls) {
        urlsToExtract.push(...foundUrls);
      }
    }

    // Look for URLs in headers
    if (req.headers.referer) {
      urlsToExtract.push(req.headers.referer);
    }

    // Extract data from URLs if found (without token)
    let extractedResults = [];
    if (urlsToExtract.length > 0) {
      console.log(`🔍 Found ${urlsToExtract.length} URLs to extract data from (public webhook)`);
      
      for (const url of urlsToExtract) {
        try {
          const extractedContent = await extractDataFromUrl(url); // No token for public webhook
          extractedResults.push(extractedContent);
          extractedData.push(extractedContent);
          
          console.log(`✅ Successfully extracted data from: ${url}`);
          
          // Display extracted data in terminal
          console.log('\n' + '='.repeat(80));
          console.log(`📄 EXTRACTED DATA FROM: ${url}`);
          console.log('='.repeat(80));
          console.log(`Type: ${extractedContent.type}`);
          console.log(`Timestamp: ${extractedContent.timestamp}`);
          console.log('-'.repeat(40));
          
          if (extractedContent.type === 'html') {
            console.log(`Title: ${extractedContent.title}`);
            console.log(`Description: ${extractedContent.description}`);
            console.log(`\nText Content (first 500 chars):`);
            console.log(extractedContent.text.substring(0, 500) + '...');
            console.log(`\nLinks found: ${extractedContent.links.length}`);
            console.log(`Images found: ${extractedContent.images.length}`);
          } else if (extractedContent.type === 'json') {
            console.log('JSON Data:');
            console.log(JSON.stringify(extractedContent.data, null, 2));
          } else if (extractedContent.type === 'text') {
            console.log('Text Content:');
            console.log(extractedContent.content.substring(0, 1000) + '...');
          } else if (extractedContent.type === 'error') {
            console.log(`❌ Error: ${extractedContent.error}`);
          } else {
            console.log('Raw Content:');
            console.log(JSON.stringify(extractedContent, null, 2));
          }
          
          console.log('='.repeat(80) + '\n');
          
        } catch (error) {
          console.error(`❌ Failed to extract data from ${url}:`, error.message);
        }
      }
    }

    // Respond with success
    res.status(200).json({
      success: true,
      message: 'Public webhook received successfully',
      webhookId: webhookPayload.id,
      timestamp: webhookPayload.timestamp,
      urlsFound: urlsToExtract.length,
      extractedData: extractedResults.length > 0 ? extractedResults : null
    });

  } catch (error) {
    console.error('❌ Error processing public webhook:', error);
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

// Token management endpoints
app.get('/tokens', (req, res) => {
  const tokens = Array.from(webhookTokens.entries()).map(([token, data]) => ({
    token: token.substring(0, 8) + '...', // Show only first 8 chars for security
    name: data.name,
    created: data.created,
    lastUsed: data.lastUsed,
    usageCount: data.usageCount
  }));
  
  res.json({
    success: true,
    count: tokens.length,
    tokens: tokens
  });
});

// Create new token
app.post('/tokens', (req, res) => {
  const { name } = req.body;
  const newToken = 'webhook-' + Date.now() + '-' + Math.random().toString(36).substring(2, 15);
  
  webhookTokens.set(newToken, {
    name: name || 'Generated Token',
    created: new Date().toISOString(),
    lastUsed: null,
    usageCount: 0
  });
  
  res.json({
    success: true,
    message: 'Token created successfully',
    token: newToken,
    name: name || 'Generated Token'
  });
});

// Delete token
app.delete('/tokens/:token', (req, res) => {
  const token = req.params.token;
  
  if (!webhookTokens.has(token)) {
    return res.status(404).json({
      success: false,
      message: 'Token not found'
    });
  }
  
  webhookTokens.delete(token);
  res.json({
    success: true,
    message: 'Token deleted successfully'
  });
});

// Extract data from URL endpoint (with token validation)
app.post('/extract', validateWebhookToken, async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'URL is required'
      });
    }

    console.log(`🔍 Manual extraction requested for: ${url}`);
    const extractedContent = await extractDataFromUrl(url, req.webhookToken);
    extractedData.push(extractedContent);

    // Display extracted data in terminal
    console.log('\n' + '='.repeat(80));
    console.log(`📄 MANUAL EXTRACTION FROM: ${url}`);
    console.log('='.repeat(80));
    console.log(`Type: ${extractedContent.type}`);
    console.log(`Timestamp: ${extractedContent.timestamp}`);
    console.log('-'.repeat(40));
    
    if (extractedContent.type === 'html') {
      console.log(`Title: ${extractedContent.title}`);
      console.log(`Description: ${extractedContent.description}`);
      console.log(`\nText Content (first 500 chars):`);
      console.log(extractedContent.text.substring(0, 500) + '...');
      console.log(`\nLinks found: ${extractedContent.links.length}`);
      console.log(`Images found: ${extractedContent.images.length}`);
    } else if (extractedContent.type === 'json') {
      console.log('JSON Data:');
      console.log(JSON.stringify(extractedContent.data, null, 2));
    } else if (extractedContent.type === 'text') {
      console.log('Text Content:');
      console.log(extractedContent.content.substring(0, 1000) + '...');
    } else if (extractedContent.type === 'error') {
      console.log(`❌ Error: ${extractedContent.error}`);
    } else {
      console.log('Raw Content:');
      console.log(JSON.stringify(extractedContent, null, 2));
    }
    
    console.log('='.repeat(80) + '\n');

    res.json({
      success: true,
      message: 'Data extracted successfully',
      extractedData: extractedContent
    });

  } catch (error) {
    console.error('❌ Error extracting data:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get all extracted data endpoint
app.get('/extracted', (req, res) => {
  res.json({
    success: true,
    count: extractedData.length,
    extractedData: extractedData
  });
});

// Extract data from multiple URLs (with token validation)
app.post('/extract-batch', validateWebhookToken, async (req, res) => {
  try {
    const { urls } = req.body;
    
    if (!urls || !Array.isArray(urls)) {
      return res.status(400).json({
        success: false,
        message: 'URLs array is required'
      });
    }

    console.log(`🔍 Batch extraction requested for ${urls.length} URLs`);
    const results = [];

    for (const url of urls) {
      try {
        const extractedContent = await extractDataFromUrl(url, req.webhookToken);
        results.push(extractedContent);
        extractedData.push(extractedContent);
        
        // Display extracted data in terminal
        console.log('\n' + '='.repeat(80));
        console.log(`📄 BATCH EXTRACTION FROM: ${url}`);
        console.log('='.repeat(80));
        console.log(`Type: ${extractedContent.type}`);
        console.log(`Timestamp: ${extractedContent.timestamp}`);
        console.log('-'.repeat(40));
        
        if (extractedContent.type === 'html') {
          console.log(`Title: ${extractedContent.title}`);
          console.log(`Description: ${extractedContent.description}`);
          console.log(`\nText Content (first 500 chars):`);
          console.log(extractedContent.text.substring(0, 500) + '...');
          console.log(`\nLinks found: ${extractedContent.links.length}`);
          console.log(`Images found: ${extractedContent.images.length}`);
        } else if (extractedContent.type === 'json') {
          console.log('JSON Data:');
          console.log(JSON.stringify(extractedContent.data, null, 2));
        } else if (extractedContent.type === 'text') {
          console.log('Text Content:');
          console.log(extractedContent.content.substring(0, 1000) + '...');
        } else if (extractedContent.type === 'error') {
          console.log(`❌ Error: ${extractedContent.error}`);
        } else {
          console.log('Raw Content:');
          console.log(JSON.stringify(extractedContent, null, 2));
        }
        
        console.log('='.repeat(80) + '\n');
        
      } catch (error) {
        const errorResult = {
          type: 'error',
          error: error.message,
          url: url,
          timestamp: new Date().toISOString()
        };
        results.push(errorResult);
        
        console.log('\n' + '='.repeat(80));
        console.log(`❌ BATCH EXTRACTION ERROR: ${url}`);
        console.log('='.repeat(80));
        console.log(`Error: ${error.message}`);
        console.log('='.repeat(80) + '\n');
      }
    }

    res.json({
      success: true,
      message: `Extracted data from ${urls.length} URLs`,
      results: results
    });

  } catch (error) {
    console.error('❌ Error in batch extraction:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
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

// Clear all extracted data
app.delete('/extracted', (req, res) => {
  extractedData.length = 0;
  res.json({
    success: true,
    message: 'All extracted data cleared'
  });
});

// Catch-all for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    availableEndpoints: [
      'GET / - Health check',
      'POST /webhook - Receive webhook (requires token)',
      'POST /webhook-public - Receive webhook (no token required)',
      'GET /webhooks - List all webhooks',
      'GET /webhook/:id - Get specific webhook',
      'DELETE /webhooks - Clear all webhooks',
      'POST /extract - Extract data from single URL (requires token)',
      'POST /extract-batch - Extract data from multiple URLs (requires token)',
      'GET /extracted - List all extracted data',
      'DELETE /extracted - Clear all extracted data',
      'GET /tokens - List all tokens',
      'POST /tokens - Create new token',
      'DELETE /tokens/:token - Delete token'
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
