import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
// import path from 'path'; // Removed for Railway deployment
import { uploadRouter } from './routes/upload';
import { validationRouter } from './routes/validation';
import { reportRouter } from './routes/report';

const app = express();
const PORT = parseInt(process.env.PORT || (process.env.NODE_ENV === 'production' ? '8080' : '3001'), 10);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Enhanced Rate limiting with CORS headers
const createRateLimiter = (options: any) => {
  return rateLimit({
    ...options,
    handler: (req: Request, res: Response) => {
      // Ensure CORS headers are present on rate limit responses
      const origin = req.headers.origin;
      if (origin && (origin.includes('.up.railway.app') || origin.includes('localhost') || process.env.NODE_ENV !== 'production')) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      }
      
      res.status(429).json({
        error: 'Too Many Requests',
        message: options.message || 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil(options.windowMs / 1000)
      });
    }
  });
};

// General rate limiting - increased for validation polling
const generalLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Increased from 100 to 500 requests per 15 minutes
  message: 'Too many requests from this IP, please try again later.',
});

// Validation endpoint specific rate limiting - higher limit for polling
const validationLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // High limit for validation status polling
  message: 'Too many validation requests, please slow down.',
});

// File upload rate limiting - keep conservative
const uploadLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // Slightly increased from 10 to 20 uploads per 5 minutes
  message: 'Too many file uploads, please try again later.',
});

app.use(generalLimiter);

// Middleware
app.use(compression());

// Enhanced CORS configuration
app.use(cors({
  origin: (origin: string | undefined, callback: (error: Error | null, success?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    // Explicit whitelist for production
    const allowedOrigins = [
      'https://setukreview-frontend-production.up.railway.app',
      'https://setukreview-backend-production.up.railway.app',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:8080'
    ];
    
    if (process.env.NODE_ENV === 'production') {
      if (allowedOrigins.includes(origin) || origin.includes('.up.railway.app')) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked origin: ${origin}`);
        callback(null, false);
      }
    } else {
      callback(null, true); // Allow all in development
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
}));

// Additional CORS headers middleware to ensure headers on all responses
app.use((req: Request, res: Response, next: any) => {
  const origin = req.headers.origin;
  if (origin) {
    const allowedOrigins = [
      'https://setukreview-frontend-production.up.railway.app',
      'https://setukreview-backend-production.up.railway.app',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:8080'
    ];
    
    if (allowedOrigins.includes(origin) || origin.includes('.up.railway.app') || process.env.NODE_ENV !== 'production') {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    }
  }
  next();
});
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// API Routes with specific rate limiting
app.use('/api/upload', uploadLimiter, uploadRouter);
app.use('/api/validation', validationLimiter, validationRouter);
app.use('/api/report', reportRouter);

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API-only backend for Railway deployment

// 404 handler with CORS headers
app.use('*', (req: Request, res: Response) => {
  // Ensure CORS headers on 404 responses
  const origin = req.headers.origin;
  if (origin && (origin.includes('.up.railway.app') || origin.includes('localhost') || process.env.NODE_ENV !== 'production')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.status(404).json({ error: 'Not Found' });
});

// Error handler with CORS headers
app.use((err: Error, req: Request, res: Response, _next: any) => {
  console.error('Server Error:', err);
  
  // Ensure CORS headers on error responses
  const origin = req.headers.origin;
  if (origin && (origin.includes('.up.railway.app') || origin.includes('localhost') || process.env.NODE_ENV !== 'production')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  
  res.status(500).json({ 
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal Server Error' 
      : err.message 
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 API documentation available at http://localhost:${PORT}/api/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;