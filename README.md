# Simple Webhook Server

A simple, lightweight webhook server built with Node.js and Express that can receive and process webhook requests from any service.

## Features

- ✅ Receive POST requests at `/webhook` endpoint
- ✅ Store webhook data in memory
- ✅ View all received webhooks at `/webhooks`
- ✅ Get specific webhook by ID
- ✅ CORS enabled for cross-origin requests
- ✅ Security headers with Helmet
- ✅ JSON and URL-encoded body parsing
- ✅ Comprehensive logging
- ✅ Health check endpoint

## Quick Start

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the server:**
   ```bash
   npm start
   ```
   
   Or for development with auto-restart:
   ```bash
   npm run dev
   ```

3. **Test the webhook:**
   ```bash
   curl -X POST http://localhost:3000/webhook \
     -H "Content-Type: application/json" \
     -d '{"message": "Hello from webhook!", "data": {"key": "value"}}'
   ```

## API Endpoints

### `GET /`
Health check endpoint
```json
{
  "message": "Simple Webhook Server is running!",
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "totalWebhooks": 5
}
```

### `POST /webhook`
Main webhook endpoint - accepts any POST request
```json
{
  "success": true,
  "message": "Webhook received successfully",
  "webhookId": "1704067200000",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### `GET /webhooks`
Get all received webhooks
```json
{
  "success": true,
  "count": 2,
  "webhooks": [...]
}
```

### `GET /webhook/:id`
Get a specific webhook by ID

### `DELETE /webhooks`
Clear all stored webhooks (useful for testing)

## Deployment on Render

### Method 1: Deploy from Git Repository

1. **Push your code to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial webhook server"
   git remote add origin https://github.com/yourusername/simple-webhook.git
   git push -u origin main
   ```

2. **Deploy on Render:**
   - Go to [render.com](https://render.com)
   - Sign up/Login with your GitHub account
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Configure:
     - **Name:** `simple-webhook` (or any name you prefer)
     - **Runtime:** `Node`
     - **Build Command:** `npm install`
     - **Start Command:** `npm start`
     - **Environment:** `Node`
   - Click "Create Web Service"

3. **Your webhook URL will be:**
   ```
   https://your-app-name.onrender.com/webhook
   ```

### Method 2: Deploy from Render Dashboard

1. **Create a new Web Service on Render**
2. **Connect your GitHub repository**
3. **Use these settings:**
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment Variables:** None required

## Usage Examples

### Send a webhook with JSON data:
```bash
curl -X POST https://your-app-name.onrender.com/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "user.signup",
    "data": {
      "userId": "12345",
      "email": "user@example.com",
      "timestamp": "2024-01-01T00:00:00.000Z"
    }
  }'
```

### Send a webhook with form data:
```bash
curl -X POST https://your-app-name.onrender.com/webhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "name=John&email=john@example.com&message=Hello World"
```

### View all received webhooks:
```bash
curl https://your-app-name.onrender.com/webhooks
```

## Environment Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)

## Security Features

- **Helmet.js** for security headers
- **CORS** enabled for cross-origin requests
- **Request size limits** (10MB max)
- **Error handling** with proper HTTP status codes

## Monitoring

The server logs all incoming webhooks to the console with:
- Webhook ID
- Timestamp
- Headers
- Body content

## Limitations

- Webhook data is stored in memory (resets on server restart)
- No authentication/authorization (anyone can send webhooks)
- No rate limiting
- No persistence to database

## Production Considerations

For production use, consider adding:
- Database persistence (MongoDB, PostgreSQL, etc.)
- Authentication/API keys
- Rate limiting
- Input validation
- Monitoring and alerting
- SSL/TLS termination

## License

MIT License - feel free to use this code for your projects!
