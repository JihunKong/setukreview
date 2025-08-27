import express, { Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { ExcelProcessor } from '../services/ExcelProcessor';
import { ValidationService } from '../services/ValidationService';
import { FileUploadResult, ValidationResult } from '../types/validation';
import { SessionManager, SessionData } from '../services/SessionManager';
import { FileCategory } from '../services/FileCategoryDetector';

const router = express.Router();

// Configure multer for file uploads
const singleUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.xlsx', '.xls', '.xlsm'];
    const fileExtension = file.originalname.toLowerCase().substr(file.originalname.lastIndexOf('.'));
    
    if (allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls, .xlsm) are allowed'));
    }
  },
});

// Configure multer for multiple file uploads
const multipleUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 50, // Maximum 50 files per upload
    fieldSize: 100 * 1024 * 1024, // Total 100MB for all files
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.xlsx', '.xls', '.xlsm'];
    const fileExtension = file.originalname.toLowerCase().substr(file.originalname.lastIndexOf('.'));
    
    if (allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error(`File ${file.originalname}: Only Excel files (.xlsx, .xls, .xlsm) are allowed`));
    }
  },
});

// Get session manager instance
const sessionManager = SessionManager.getInstance();

// Single file upload endpoint (backward compatibility)
router.post('/', singleUpload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      } as FileUploadResult);
    }

    // Generate unique validation ID
    const validationId = uuidv4();
    
    console.log(`📁 Processing file: ${req.file.originalname} (${req.file.size} bytes)`);

    // Process Excel file
    const excelProcessor = new ExcelProcessor();
    const excelData = await excelProcessor.processFile(req.file.buffer, req.file.originalname);

    // Initialize validation result
    const validationResult: ValidationResult = {
      id: validationId,
      fileName: req.file.originalname,
      status: 'pending',
      progress: 0,
      errors: [],
      warnings: [],
      info: [],
      summary: {
        totalCells: 0,
        checkedCells: 0,
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
      },
      createdAt: new Date(),
    };

    // Calculate total cells for progress tracking
    let totalCells = 0;
    Object.values(excelData.sheets).forEach(sheet => {
      totalCells += sheet.data.flat().filter(cell => cell !== null && cell !== undefined && cell !== '').length;
    });
    validationResult.summary.totalCells = totalCells;

    // Store validation result (in production, use Redis or database)
    ValidationService.storeResult(validationId, validationResult);

    // Start validation process asynchronously
    ValidationService.validateData(validationId, excelData)
      .catch(error => {
        console.error(`Validation failed for ${validationId}:`, error);
        const result = ValidationService.getResult(validationId);
        if (result) {
          result.status = 'failed';
          ValidationService.storeResult(validationId, result);
        }
      });

    // Return validation ID immediately
    res.json({
      success: true,
      validationId,
    } as FileUploadResult);

  } catch (error) {
    console.error('File upload error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    res.status(400).json({
      success: false,
      error: errorMessage
    } as FileUploadResult);
  }
});

// Get upload status
router.get('/status', (req: Request, res: Response) => {
  res.json({
    maxFileSize: '10MB',
    allowedExtensions: ['.xlsx', '.xls', '.xlsm'],
    supportedLanguages: ['Korean', 'English'],
    validationRules: [
      'Korean/English input validation',
      'Institution name validation',
      'Grammar and format checking',
      'AI-powered content validation',
      'Duplicate detection',
      'Cross-student validation'
    ]
  });
});

// ===== NEW MULTI-FILE UPLOAD ENDPOINTS =====

// Create new session
router.post('/session', (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    const sessionId = sessionManager.createSession(userId);
    
    res.json({
      success: true,
      sessionId,
      message: 'Session created successfully'
    });
  } catch (error) {
    console.error('Session creation error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create session'
    });
  }
});

// Multiple file upload endpoint
router.post('/multiple/:sessionId', multipleUpload.array('files'), async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }

    console.log(`📁 Processing ${files.length} files for session ${sessionId}`);

    const uploadedFiles: FileCategory[] = [];
    const errors: string[] = [];

    // Process each file
    for (const file of files) {
      try {
        const fileCategory = await sessionManager.addFileToSession(
          sessionId,
          file.buffer,
          file.originalname,
          file.size
        );
        uploadedFiles.push(fileCategory);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`${file.originalname}: ${errorMessage}`);
      }
    }

    res.json({
      success: errors.length === 0,
      sessionId,
      uploadedFiles,
      totalFiles: uploadedFiles.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully uploaded ${uploadedFiles.length} of ${files.length} files`
    });

  } catch (error) {
    console.error('Multiple file upload error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Multiple file upload failed'
    });
  }
});

// Add single file to existing session
router.post('/session/:sessionId/file', singleUpload.single('file'), async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const fileCategory = await sessionManager.addFileToSession(
      sessionId,
      req.file.buffer,
      req.file.originalname,
      req.file.size
    );

    res.json({
      success: true,
      sessionId,
      file: fileCategory,
      message: 'File added to session successfully'
    });

  } catch (error) {
    console.error('Add file to session error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add file to session'
    });
  }
});

// Get session information
router.get('/session/:sessionId', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = sessionManager.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    const files = sessionManager.getSessionFiles(sessionId);
    const stats = sessionManager.getSessionStats(sessionId);
    const categorySummary = sessionManager.getCategorySummary(sessionId);

    res.json({
      success: true,
      session: {
        id: session.id,
        status: session.status,
        createdAt: session.createdAt,
        lastAccessedAt: session.lastAccessedAt,
        metadata: session.metadata
      },
      files,
      stats,
      categorySummary
    });

  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get session'
    });
  }
});

// Get files by category in session
router.get('/session/:sessionId/category/:category', (req: Request, res: Response) => {
  try {
    const { sessionId, category } = req.params;
    const files = sessionManager.getFilesByCategory(sessionId, category);
    
    res.json({
      success: true,
      category,
      files,
      count: files.length
    });

  } catch (error) {
    console.error('Get files by category error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get files by category'
    });
  }
});

// Update file category manually
router.put('/session/:sessionId/file/:fileId/category', (req: Request, res: Response) => {
  try {
    const { sessionId, fileId } = req.params;
    const { category } = req.body;

    if (!category) {
      return res.status(400).json({
        success: false,
        error: 'Category is required'
      });
    }

    const success = sessionManager.updateFileCategory(sessionId, fileId, category);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'File or session not found'
      });
    }

    res.json({
      success: true,
      message: 'File category updated successfully'
    });

  } catch (error) {
    console.error('Update file category error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update file category'
    });
  }
});

// Remove file from session
router.delete('/session/:sessionId/file/:fileId', (req: Request, res: Response) => {
  try {
    const { sessionId, fileId } = req.params;
    const success = sessionManager.removeFile(sessionId, fileId);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'File or session not found'
      });
    }

    res.json({
      success: true,
      message: 'File removed from session successfully'
    });

  } catch (error) {
    console.error('Remove file error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove file'
    });
  }
});

// Clear session (remove all files)
router.delete('/session/:sessionId/files', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const success = sessionManager.clearSession(sessionId);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    res.json({
      success: true,
      message: 'Session cleared successfully'
    });

  } catch (error) {
    console.error('Clear session error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clear session'
    });
  }
});

// Delete session completely
router.delete('/session/:sessionId', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const success = sessionManager.deleteSession(sessionId);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    res.json({
      success: true,
      message: 'Session deleted successfully'
    });

  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete session'
    });
  }
});

// Get system statistics
router.get('/system/stats', (req: Request, res: Response) => {
  try {
    const stats = sessionManager.getSystemStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Get system stats error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get system stats'
    });
  }
});

export { router as uploadRouter };