import express, { Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { ExcelProcessor } from '../services/ExcelProcessor';
import { ValidationService } from '../services/ValidationService';
import { FileUploadResult, ValidationResult } from '../types/validation';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
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

// File upload endpoint
router.post('/', upload.single('file'), async (req: Request, res: Response) => {
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
      'AI-powered content validation'
    ]
  });
});

export { router as uploadRouter };