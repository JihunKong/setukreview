import express, { Request, Response } from 'express';
import { param, body, validationResult } from 'express-validator';
import { ValidationService } from '../services/ValidationService';
import { SelectiveValidationService } from '../services/SelectiveValidationService';

const router = express.Router();

// Ensure CORS headers for all validation endpoints
router.use((req: Request, res: Response, next: any) => {
  const origin = req.headers.origin;
  if (origin && (origin.includes('.up.railway.app') || origin.includes('localhost') || process.env.NODE_ENV !== 'production')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  }
  next();
});

// Handle preflight OPTIONS requests
router.options('*', (req: Request, res: Response) => {
  res.status(200).end();
});

// Get validation status and progress
router.get('/:id', [
  param('id').isUUID().withMessage('Invalid validation ID')
], (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Invalid request',
      details: errors.array()
    });
  }

  const validationId = req.params.id;
  const result = ValidationService.getResult(validationId);

  if (!result) {
    return res.status(404).json({
      error: 'Validation not found',
      message: `No validation found with ID: ${validationId}`
    });
  }

  res.json(result);
});

// Cancel validation
router.delete('/:id', [
  param('id').isUUID().withMessage('Invalid validation ID')
], (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Invalid request',
      details: errors.array()
    });
  }

  const validationId = req.params.id;
  const result = ValidationService.getResult(validationId);

  if (!result) {
    return res.status(404).json({
      error: 'Validation not found'
    });
  }

  if (result.status === 'completed' || result.status === 'failed') {
    return res.status(400).json({
      error: 'Cannot cancel completed validation'
    });
  }

  // Cancel the validation
  ValidationService.cancelValidation(validationId);
  
  res.json({
    success: true,
    message: 'Validation cancelled'
  });
});

// Get validation statistics
router.get('/:id/stats', [
  param('id').isUUID().withMessage('Invalid validation ID')
], (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Invalid request',
      details: errors.array()
    });
  }

  const validationId = req.params.id;
  const result = ValidationService.getResult(validationId);

  if (!result) {
    return res.status(404).json({
      error: 'Validation not found'
    });
  }

  // Calculate detailed statistics
  const stats = {
    overview: result.summary,
    errorsByType: {} as Record<string, number>,
    errorsBySeverity: {
      error: result.errors.length,
      warning: result.warnings.length,
      info: result.info.length,
    },
    processingTime: result.completedAt && result.createdAt 
      ? result.completedAt.getTime() - result.createdAt.getTime()
      : null,
    fileName: result.fileName,
    status: result.status,
    progress: result.progress,
  };

  // Count errors by type
  [...result.errors, ...result.warnings, ...result.info].forEach(error => {
    stats.errorsByType[error.type] = (stats.errorsByType[error.type] || 0) + 1;
  });

  res.json(stats);
});

// List recent validations (for debugging/admin purposes)
router.get('/', (req: Request, res: Response) => {
  const recentValidations = ValidationService.getRecentValidations(10);
  
  res.json({
    validations: recentValidations.map(result => ({
      id: result.id,
      fileName: result.fileName,
      status: result.status,
      progress: result.progress,
      errorCount: result.summary.errorCount,
      createdAt: result.createdAt,
      completedAt: result.completedAt,
    }))
  });
});

// ===== BATCH VALIDATION ENDPOINTS =====

const selectiveValidationService = SelectiveValidationService.getInstance();

// Start batch validation
router.post('/batch/:sessionId', [
  param('sessionId').isUUID().withMessage('Invalid session ID'),
  body('options').isObject().withMessage('Validation options required'),
  body('options.validateAll').optional().isBoolean(),
  body('options.selectedCategories').optional().isArray(),
  body('options.selectedFileIds').optional().isArray(),
  body('options.skipDuplicateDetection').optional().isBoolean(),
  body('options.enableCrossValidation').optional().isBoolean(),
  body('options.priority').optional().isIn(['speed', 'accuracy', 'balanced']),
  body('options.maxConcurrency').optional().isInt({ min: 1, max: 10 })
], async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Invalid request',
      details: errors.array()
    });
  }

  try {
    const { sessionId } = req.params;
    const { options } = req.body;

    const batchId = await selectiveValidationService.startBatchValidation(sessionId, options);

    res.json({
      success: true,
      batchId,
      sessionId,
      message: 'Batch validation started'
    });

  } catch (error) {
    console.error('Batch validation start error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start batch validation'
    });
  }
});

// Validate specific category
router.post('/batch/:sessionId/category/:category', [
  param('sessionId').isUUID().withMessage('Invalid session ID'),
  param('category').isString().withMessage('Category is required'),
  body('options').optional().isObject()
], async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Invalid request',
      details: errors.array()
    });
  }

  try {
    const { sessionId, category } = req.params;
    const options = req.body.options || {};

    const batchId = await selectiveValidationService.validateCategory(sessionId, category, options);

    res.json({
      success: true,
      batchId,
      sessionId,
      category,
      message: `Validation started for category: ${category}`
    });

  } catch (error) {
    console.error('Category validation start error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start category validation'
    });
  }
});

// Validate all files in session
router.post('/batch/:sessionId/all', [
  param('sessionId').isUUID().withMessage('Invalid session ID'),
  body('options').optional().isObject()
], async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Invalid request',
      details: errors.array()
    });
  }

  try {
    const { sessionId } = req.params;
    const options = req.body.options || {};

    const batchId = await selectiveValidationService.validateAll(sessionId, options);

    res.json({
      success: true,
      batchId,
      sessionId,
      message: 'Validation started for all files'
    });

  } catch (error) {
    console.error('Validate all start error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start validation for all files'
    });
  }
});

// Get batch validation status
router.get('/batch/:batchId', [
  param('batchId').isUUID().withMessage('Invalid batch ID')
], (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Invalid request',
      details: errors.array()
    });
  }

  const { batchId } = req.params;
  const batchResult = selectiveValidationService.getBatchResult(batchId);

  if (!batchResult) {
    return res.status(404).json({
      error: 'Batch validation not found',
      message: `No batch validation found with ID: ${batchId}`
    });
  }

  // Convert Map to object for JSON serialization with validation
  const results: Record<string, any> = {};
  let conversionErrors = 0;
  
  batchResult.results.forEach((value, key) => {
    try {
      if (value && typeof value === 'object') {
        results[key] = value;
      } else {
        console.warn(`⚠️ Invalid validation result for key ${key}:`, value);
        conversionErrors++;
      }
    } catch (error) {
      console.error(`❌ Error converting result for key ${key}:`, error);
      conversionErrors++;
    }
  });

  console.log(`📊 Batch ${batchId} serialization:`, {
    totalResults: batchResult.results.size,
    serializedResults: Object.keys(results).length,
    conversionErrors,
    resultKeys: Array.from(batchResult.results.keys()),
    serializedKeys: Object.keys(results)
  });

  res.json({
    ...batchResult,
    results
  });
});

// Cancel batch validation
router.delete('/batch/:batchId', [
  param('batchId').isUUID().withMessage('Invalid batch ID')
], (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Invalid request',
      details: errors.array()
    });
  }

  const { batchId } = req.params;
  const success = selectiveValidationService.cancelBatchValidation(batchId);

  if (!success) {
    return res.status(404).json({
      error: 'Cannot cancel batch validation',
      message: 'Batch not found or already completed'
    });
  }

  res.json({
    success: true,
    message: 'Batch validation cancelled'
  });
});

// Get batch validation statistics by category
router.get('/batch/:batchId/stats/category', [
  param('batchId').isUUID().withMessage('Invalid batch ID')
], (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Invalid request',
      details: errors.array()
    });
  }

  const { batchId } = req.params;
  const stats = selectiveValidationService.getCategoryValidationStats(batchId);

  res.json({
    batchId,
    categoryStats: stats
  });
});

// Get all batch validations for a session
router.get('/batch/session/:sessionId', [
  param('sessionId').isUUID().withMessage('Invalid session ID')
], (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Invalid request',
      details: errors.array()
    });
  }

  const { sessionId } = req.params;
  const batches = selectiveValidationService.getSessionBatches(sessionId);

  // Convert Maps to objects for JSON serialization
  const serializedBatches = batches.map(batch => ({
    ...batch,
    results: Object.fromEntries(batch.results)
  }));

  res.json({
    sessionId,
    batches: serializedBatches
  });
});

// Get selective validation service statistics
router.get('/batch/stats/service', (req: Request, res: Response) => {
  const stats = selectiveValidationService.getServiceStats();
  
  res.json({
    success: true,
    stats
  });
});

// Direct session validation - validates ALL files and returns results immediately
router.post('/session/:sessionId', [
  param('sessionId').isUUID().withMessage('Invalid session ID')
], async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Invalid request',
      details: errors.array()
    });
  }

  try {
    const { sessionId } = req.params;
    
    // Validate all files in the session directly
    const results = await selectiveValidationService.validateAllFilesSync(sessionId);
    
    res.json({
      success: true,
      sessionId,
      results,
      message: 'All files validated successfully'
    });

  } catch (error) {
    console.error('Session validation error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to validate session files'
    });
  }
});

export { router as validationRouter };