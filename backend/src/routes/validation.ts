import express, { Request, Response } from 'express';
import { param, validationResult } from 'express-validator';
import { ValidationService } from '../services/ValidationService';

const router = express.Router();

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

export { router as validationRouter };