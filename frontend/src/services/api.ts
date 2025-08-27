import axios from 'axios';
import { ValidationResult, FileUploadResult, ValidationStats } from '../types/validation';

const API_BASE = process.env.NODE_ENV === 'production' 
  ? process.env.REACT_APP_API_URL || 'https://setukreview-backend-production.up.railway.app'
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

  addFileToSession: async (sessionId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post(`/upload/session/${sessionId}/file`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
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

  // === Batch Validation APIs ===
  startBatchValidation: async (sessionId: string, options: any) => {
    const response = await api.post(`/validation/batch/${sessionId}`, { options }, {
      timeout: 300000, // 5 minutes for batch validation
    });
    return response.data;
  },

  validateCategory: async (sessionId: string, category: string, options?: any) => {
    const response = await api.post(`/validation/batch/${sessionId}/category/${category}`, {
      options: options || {},
    });
    return response.data;
  },

  validateAll: async (sessionId: string, options?: any) => {
    const response = await api.post(`/validation/batch/${sessionId}/all`, {
      options: options || {},
    });
    return response.data;
  },

  getBatchValidation: async (batchId: string) => {
    const response = await api.get(`/validation/batch/${batchId}`);
    return response.data;
  },

  cancelBatchValidation: async (batchId: string) => {
    const response = await api.delete(`/validation/batch/${batchId}`);
    return response.data;
  },

  getBatchCategoryStats: async (batchId: string) => {
    const response = await api.get(`/validation/batch/${batchId}/stats/category`);
    return response.data;
  },

  getSessionBatches: async (sessionId: string) => {
    const response = await api.get(`/validation/batch/session/${sessionId}`);
    return response.data;
  },

  getServiceStats: async () => {
    const response = await api.get('/validation/batch/stats/service');
    return response.data;
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