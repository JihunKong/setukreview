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
const PORT = parseInt(process.env.PORT || '8080', 10);

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

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);

// File upload rate limiting
const uploadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // limit each IP to 10 uploads per 5 minutes
  message: 'Too many file uploads, please try again later.',
});

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
      'http://localhost:3001'
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
      'http://localhost:3001'
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

// API Routes
app.use('/api/upload', uploadLimiter, uploadRouter);
app.use('/api/validation', validationRouter);
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