import axios from 'axios';
import { ValidationResult, FileUploadResult, ValidationStats } from '../types/validation';

const API_BASE = process.env.NODE_ENV === 'production' 
  ? 'https://setukreview-backend-production.up.railway.app' // Point to backend Railway service
  : 'http://localhost:3001';

console.log(`🌍 API Configuration - Environment: ${process.env.NODE_ENV}, API_BASE: ${API_BASE}`);

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 300000, // 5 minutes timeout for file uploads
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth headers and logging
api.interceptors.request.use(
  (config) => {
    console.log(`📤 API Request: ${config.method?.toUpperCase()} ${config.url}`, {
      baseURL: config.baseURL,
      headers: config.headers,
    });
    return config;
  },
  (error) => {
    console.error('📤 API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling and logging
api.interceptors.response.use(
  (response) => {
    console.log(`📥 API Response: ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`, {
      status: response.status,
      data: response.data
    });
    return response;
  },
  (error) => {
    console.error('📥 API Response Error:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      url: error.config?.url,
      baseURL: error.config?.baseURL
    });
    
    if (error.response?.status === 429) {
      throw new Error('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
    }
    if (error.response?.status >= 500) {
      throw new Error('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    }
    if (error.code === 'NETWORK_ERROR' || !error.response) {
      throw new Error('네트워크 연결을 확인해주세요.');
    }
    return Promise.reject(error);
  }
);

export const fileUploadApi = {
  uploadFile: async (file: File): Promise<FileUploadResult> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  },

  getUploadStatus: async () => {
    const response = await api.get('/upload/status');
    return response.data;
  },

  // === Multi-file Upload APIs ===
  createSession: async (userId?: string) => {
    const response = await api.post('/upload/session', { userId });
    return response.data;
  },

  uploadMultipleFiles: async (sessionId: string, files: File[]) => {
    console.log(`📤 Preparing to upload ${files.length} files to session ${sessionId}`);
    
    const formData = new FormData();
    files.forEach((file, index) => {
      console.log(`📄 Adding file ${index + 1}: ${file.name} (${file.size} bytes)`);
      formData.append('files', file);
    });

    const response = await api.post(`/upload/multiple/${sessionId}`, formData, {
      headers: {
        // Let axios set Content-Type automatically for multipart/form-data
      },
      timeout: 300000, // 5 minutes for multiple file uploads
    });

    return response.data;
  },

  // NEW: Sequential upload - upload files one by one for reliability
  uploadFilesSequentially: async (sessionId: string, files: File[], onProgress?: (current: number, total: number, fileName: string) => void) => {
    console.log(`📤 Starting sequential upload of ${files.length} files to session ${sessionId}`);
    
    const results = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`📄 Uploading file ${i + 1}/${files.length}: ${file.name} (${file.size} bytes)`);
      
      // Report progress
      if (onProgress) {
        onProgress(i + 1, files.length, file.name);
      }
      
      try {
        const result = await fileUploadApi.addFileToSession(sessionId, file);
        results.push(result);
        console.log(`✅ Successfully uploaded: ${file.name}`);
      } catch (error) {
        console.error(`❌ Failed to upload ${file.name}:`, error);
        // Continue with other files even if one fails
        results.push({ error: error, fileName: file.name });
      }
    }
    
    console.log(`📦 Sequential upload completed: ${results.length} files processed`);
    return {
      success: true,
      sessionId,
      results,
      totalFiles: files.length
    };
  },

  addFileToSession: async (sessionId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post(`/upload/session/${sessionId}/file`, formData, {
      headers: {
        // Let axios set Content-Type automatically for multipart/form-data
      },
    });

    return response.data;
  },

  getSession: async (sessionId: string) => {
    const response = await api.get(`/upload/session/${sessionId}`);
    return response.data;
  },

  getFilesByCategory: async (sessionId: string, category: string) => {
    const response = await api.get(`/upload/session/${sessionId}/category/${category}`);
    return response.data;
  },

  updateFileCategory: async (sessionId: string, fileId: string, category: string) => {
    const response = await api.put(`/upload/session/${sessionId}/file/${fileId}/category`, {
      category,
    });
    return response.data;
  },

  removeFile: async (sessionId: string, fileId: string) => {
    const response = await api.delete(`/upload/session/${sessionId}/file/${fileId}`);
    return response.data;
  },

  clearSession: async (sessionId: string) => {
    const response = await api.delete(`/upload/session/${sessionId}/files`);
    return response.data;
  },

  deleteSession: async (sessionId: string) => {
    const response = await api.delete(`/upload/session/${sessionId}`);
    return response.data;
  },

  getSystemStats: async () => {
    const response = await api.get('/upload/system/stats');
    return response.data;
  },
};

export const validationApi = {
  getValidation: async (validationId: string): Promise<ValidationResult> => {
    const response = await api.get(`/validation/${validationId}`);
    return response.data;
  },

  cancelValidation: async (validationId: string): Promise<void> => {
    await api.delete(`/validation/${validationId}`);
  },

  getValidationStats: async (validationId: string): Promise<ValidationStats> => {
    const response = await api.get(`/validation/${validationId}/stats`);
    return response.data;
  },

  getRecentValidations: async () => {
    const response = await api.get('/validation');
    return response.data.validations;
  },

  // === Session Validation APIs (matches backend) ===
  validateSession: async (sessionId: string) => {
    const response = await api.post(`/validation/session/${sessionId}`, {}, {
      timeout: 300000, // 5 minutes for validation
    });
    return response.data;
  },

  getValidationResults: async (sessionId: string) => {
    // COMPLETELY DISABLED - This endpoint does not exist!
    // Return mock data to prevent 404 errors
    console.error('❌ getValidationResults called - this endpoint is deprecated and removed!');
    console.error('Use validateSession instead for immediate results');
    throw new Error('getValidationResults is deprecated - use validateSession instead');
  },

  // Legacy batch validation APIs (deprecated - kept for backward compatibility)
  startBatchValidation: async (sessionId: string, options: any) => {
    // Route to the working session validation instead
    return validationApi.validateSession(sessionId);
  },

  validateAll: async (sessionId: string, options?: any) => {
    // Route to the working session validation instead  
    return validationApi.validateSession(sessionId);
  },

  getBatchValidation: async (batchId: string) => {
    // Since validation is synchronous now, return a mock completed response
    // This prevents 404 errors from old polling logic
    console.warn('getBatchValidation is deprecated - validation is now synchronous');
    return { 
      status: 'completed', 
      progress: 100, 
      results: {},
      batchId,
      message: 'Synchronous validation complete'
    };
  },

  // Placeholder functions for compatibility
  validateCategory: async (sessionId: string, category: string, options?: any) => {
    return validationApi.validateSession(sessionId);
  },

  cancelBatchValidation: async (batchId: string) => {
    return { success: true, message: 'Cancellation not supported in session validation' };
  },

  getBatchCategoryStats: async (batchId: string) => {
    return { categories: [], stats: {} };
  },

  getSessionBatches: async (sessionId: string) => {
    return { batches: [] };
  },

  getServiceStats: async () => {
    return { stats: {} };
  },
};

export const reportApi = {
  downloadReport: async (validationId: string, format: 'json' | 'excel' | 'csv' = 'excel'): Promise<Blob> => {
    const response = await api.get(`/report/${validationId}/download`, {
      params: { format },
      responseType: 'blob',
    });

    return response.data;
  },

  getReportSummary: async (validationId: string) => {
    const response = await api.get(`/report/${validationId}/summary`);
    return response.data;
  },

  getErrorsByType: async (validationId: string, type: string) => {
    const response = await api.get(`/report/${validationId}/errors/${type}`);
    return response.data;
  },
};

export const healthApi = {
  checkHealth: async () => {
    const response = await api.get('/health');
    return response.data;
  },
};

// Utility function to handle file downloads
export const downloadFile = (blob: Blob, filename: string): void => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export default api;