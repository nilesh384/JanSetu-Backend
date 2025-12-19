import app from './app.js';
import dotenv from 'dotenv';
import redisService from './services/redis.js';

dotenv.config({path: './.env'});

const PORT = process.env.PORT || 4000;

// Check if we're running on Vercel (serverless)
const isVercel = process.env.VERCEL === '1' || process.env.NOW_REGION;

if (!isVercel) {
  // Local development - run as traditional server
  
  // Global error handlers to prevent crashes
  process.on('uncaughtException', (error) => {
    console.error('🚨 Uncaught Exception:', error.message);
    console.error('Stack:', error.stack);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
  });

  // Graceful shutdown handlers
  const gracefulShutdown = async () => {
    console.log('\n🛑 Shutting down gracefully...');
    
    await redisService.disconnect();
    
    if (global.server) {
      global.server.close(() => {
        console.log('✅ HTTP server closed');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);

  // Start server for local development
  const startServer = async () => {
    try {
      try {
        await redisService.connect();
      } catch (redisError) {
        console.log('⚠️ Redis connection failed, continuing without cache');
      }
      
      const server = app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
      });

      server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          console.error(`❌ Port ${PORT} is already in use`);
        } else {
          console.error('❌ Server error:', error);
        }
      });

      global.server = server;

      return server;
    } catch (error) {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  };

  startServer();
}

// Export app for Vercel serverless
export default app;
