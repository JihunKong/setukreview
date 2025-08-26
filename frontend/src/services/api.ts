import axios from 'axios';
import { ValidationResult, FileUploadResult, ValidationStats } from '../types/validation';

const API_BASE = process.env.NODE_ENV === 'production' 
  ? process.env.REACT_APP_API_URL || 'https://setukreview-backend-production.up.railway.app'
  : 'http://localhost:8080';

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 60000, // 1 minute timeout for file uploads
});

// Request interceptor to add auth headers if needed
api.interceptors.request.use(
  (config) => {
    // Add any authentication headers here if needed
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 429) {
      throw new Error('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
    }
    if (error.response?.status >= 500) {
      throw new Error('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
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