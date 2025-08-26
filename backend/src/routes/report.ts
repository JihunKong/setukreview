import express, { Request, Response } from 'express';
import { param, query, validationResult } from 'express-validator';
import { ValidationService } from '../services/ValidationService';
import { ReportGenerator } from '../services/ReportGenerator';

const router = express.Router();

// Download validation report
router.get('/:id/download', [
  param('id').isUUID().withMessage('Invalid validation ID'),
  query('format').optional().isIn(['json', 'excel', 'csv']).withMessage('Invalid format')
], async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Invalid request',
      details: errors.array()
    });
  }

  const validationId = req.params.id;
  const format = req.query.format as string || 'json';
  
  const result = ValidationService.getResult(validationId);

  if (!result) {
    return res.status(404).json({
      error: 'Validation not found'
    });
  }

  if (result.status !== 'completed') {
    return res.status(400).json({
      error: 'Validation not completed',
      status: result.status
    });
  }

  try {
    const reportGenerator = new ReportGenerator();
    
    switch (format) {
      case 'excel':
        const excelBuffer = await reportGenerator.generateExcelReport(result);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="validation-report-${validationId}.xlsx"`);
        res.send(excelBuffer);
        break;
        
      case 'csv':
        const csvContent = await reportGenerator.generateCSVReport(result);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="validation-report-${validationId}.csv"`);
        res.send('\ufeff' + csvContent); // Add BOM for Excel UTF-8 support
        break;
        
      case 'json':
      default:
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="validation-report-${validationId}.json"`);
        res.json(result);
        break;
    }
  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({
      error: 'Failed to generate report',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get report summary (for preview)
router.get('/:id/summary', [
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

  // Generate summary without full error details
  const summary = {
    fileName: result.fileName,
    status: result.status,
    progress: result.progress,
    summary: result.summary,
    createdAt: result.createdAt,
    completedAt: result.completedAt,
    sampleErrors: {
      errors: result.errors.slice(0, 5), // First 5 errors
      warnings: result.warnings.slice(0, 3), // First 3 warnings
      info: result.info.slice(0, 2), // First 2 info items
    },
    availableFormats: ['json', 'excel', 'csv']
  };

  res.json(summary);
});

// Get errors by type
router.get('/:id/errors/:type', [
  param('id').isUUID().withMessage('Invalid validation ID'),
  param('type').isIn(['korean_english', 'institution_name', 'grammar', 'format', 'ai_validation']).withMessage('Invalid error type')
], (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Invalid request',
      details: errors.array()
    });
  }

  const validationId = req.params.id;
  const errorType = req.params.type;
  
  const result = ValidationService.getResult(validationId);

  if (!result) {
    return res.status(404).json({
      error: 'Validation not found'
    });
  }

  // Filter errors by type
  const allErrors = [...result.errors, ...result.warnings, ...result.info];
  const filteredErrors = allErrors.filter(error => error.type === errorType);

  res.json({
    type: errorType,
    count: filteredErrors.length,
    errors: filteredErrors
  });
});

export { router as reportRouter };