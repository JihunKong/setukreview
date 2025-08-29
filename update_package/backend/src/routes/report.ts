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

// Batch download validation reports
router.post('/batch/download', [
  query('format').optional().isIn(['json', 'excel', 'csv', 'zip']).withMessage('Invalid format')
], async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Invalid request',
      details: errors.array()
    });
  }

  const { validationIds, mergeResults } = req.body;
  const format = req.query.format as string || 'excel';
  
  if (!Array.isArray(validationIds) || validationIds.length === 0) {
    return res.status(400).json({
      error: 'validationIds array is required and must not be empty'
    });
  }

  // Get all validation results
  const results = validationIds
    .map(id => ValidationService.getResult(id))
    .filter((result): result is NonNullable<typeof result> => result !== undefined);

  if (results.length === 0) {
    return res.status(404).json({
      error: 'No valid validation results found'
    });
  }

  // Check if all validations are completed
  const incompleteResults = results.filter(result => result.status !== 'completed');
  if (incompleteResults.length > 0) {
    return res.status(400).json({
      error: 'Some validations are not completed',
      incompleteResults: incompleteResults.map(r => ({ id: r.id, status: r.status }))
    });
  }

  try {
    const reportGenerator = new ReportGenerator();
    
    if (format === 'zip') {
      // Generate individual reports and create ZIP
      const zipBuffer = await reportGenerator.generateZipReport(results);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="validation-reports-batch.zip"`);
      res.send(zipBuffer);
    } else if (mergeResults) {
      // Generate merged report
      switch (format) {
        case 'excel':
          const excelBuffer = await reportGenerator.generateBatchExcelReport(results);
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', `attachment; filename="validation-batch-report.xlsx"`);
          res.send(excelBuffer);
          break;
          
        case 'csv':
          const csvContent = await reportGenerator.generateBatchCSVReport(results);
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          res.setHeader('Content-Disposition', `attachment; filename="validation-batch-report.csv"`);
          res.send('\ufeff' + csvContent);
          break;
          
        case 'json':
        default:
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Content-Disposition', `attachment; filename="validation-batch-report.json"`);
          res.json({
            batchSummary: {
              totalFiles: results.length,
              totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0),
              totalWarnings: results.reduce((sum, r) => sum + r.warnings.length, 0),
              totalInfo: results.reduce((sum, r) => sum + r.info.length, 0),
              generatedAt: new Date()
            },
            results: results
          });
          break;
      }
    } else {
      return res.status(400).json({
        error: 'For non-zip batch downloads, mergeResults must be true'
      });
    }
  } catch (error) {
    console.error('Batch report generation error:', error);
    res.status(500).json({
      error: 'Failed to generate batch report',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Download all validation reports from a session
router.get('/session/:sessionId/download', [
  param('sessionId').isUUID().withMessage('Invalid session ID'),
  query('format').optional().isIn(['json', 'excel', 'csv', 'zip']).withMessage('Invalid format')
], async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Invalid request',
      details: errors.array()
    });
  }

  const sessionId = req.params.sessionId;
  const format = req.query.format as string || 'excel';
  
  // Get all validation results (this is a simplified approach - in production you might need a SessionService)
  // For now, we'll use the ValidationService to get recent validations and filter by sessionId if available
  const recentValidations = ValidationService.getRecentValidations(100);
  
  // Filter by sessionId if the validation result has this information
  // Note: This implementation assumes ValidationResult has sessionId - you might need to adjust
  const sessionResults = recentValidations.filter(result => 
    (result as any).sessionId === sessionId || result.id.startsWith(sessionId.slice(0, 8))
  );

  if (sessionResults.length === 0) {
    return res.status(404).json({
      error: 'No validation results found for session'
    });
  }

  try {
    const reportGenerator = new ReportGenerator();
    
    switch (format) {
      case 'zip':
        const zipBuffer = await reportGenerator.generateZipReport(sessionResults);
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="session-${sessionId.slice(0, 8)}-reports.zip"`);
        res.send(zipBuffer);
        break;
        
      case 'excel':
        const excelBuffer = await reportGenerator.generateBatchExcelReport(sessionResults);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="session-${sessionId.slice(0, 8)}-report.xlsx"`);
        res.send(excelBuffer);
        break;
        
      case 'csv':
        const csvContent = await reportGenerator.generateBatchCSVReport(sessionResults);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="session-${sessionId.slice(0, 8)}-report.csv"`);
        res.send('\ufeff' + csvContent);
        break;
        
      case 'json':
      default:
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="session-${sessionId.slice(0, 8)}-report.json"`);
        res.json({
          sessionId,
          batchSummary: {
            totalFiles: sessionResults.length,
            totalErrors: sessionResults.reduce((sum, r) => sum + r.errors.length, 0),
            totalWarnings: sessionResults.reduce((sum, r) => sum + r.warnings.length, 0),
            totalInfo: sessionResults.reduce((sum, r) => sum + r.info.length, 0),
            generatedAt: new Date()
          },
          results: sessionResults
        });
        break;
    }
  } catch (error) {
    console.error('Session report generation error:', error);
    res.status(500).json({
      error: 'Failed to generate session report',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as reportRouter };