import React, { useState } from 'react';
import { ValidationResult } from '../types/validation';
import { ValidationResults } from './ValidationResults';

interface BatchValidationResultsProps {
  batchResults: Map<string, ValidationResult>;
  uploadedFiles: Array<{ fileName: string; category?: string; }>;
  onStartNew: () => void;
  onError: (error: string) => void;
}

const BatchValidationResults: React.FC<BatchValidationResultsProps> = ({
  batchResults,
  uploadedFiles,
  onStartNew,
  onError
}) => {
  const [selectedFileId, setSelectedFileId] = useState<string | null>(() => {
    return batchResults.size > 0 ? Array.from(batchResults.keys())[0] : null;
  });

  const selectedResult = selectedFileId ? batchResults.get(selectedFileId) : null;

  // Calculate batch statistics
  const batchStats = {
    totalFiles: batchResults.size,
    totalErrors: Array.from(batchResults.values()).reduce((sum, result) => 
      sum + (result.errors?.length || 0), 0
    ),
    totalWarnings: Array.from(batchResults.values()).reduce((sum, result) => 
      sum + (result.warnings?.length || 0), 0
    ),
    totalInfo: Array.from(batchResults.values()).reduce((sum, result) => 
      sum + (result.info?.length || 0), 0
    ),
    totalCells: Array.from(batchResults.values()).reduce((sum, result) => 
      sum + (result.summary?.totalCells || 0), 0
    )
  };

  // Group files by category
  const filesByCategory = Array.from(batchResults.entries()).reduce((acc, [fileId, result]) => {
    const fileName = result.fileName || `File ${fileId}`;
    const category = uploadedFiles.find(f => f.fileName === fileName)?.category || 'Unknown';
    
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push({ fileId, result });
    return acc;
  }, {} as Record<string, Array<{ fileId: string; result: ValidationResult }>>);

  const getStatusColor = (result: ValidationResult) => {
    const errorCount = result.errors?.length || 0;
    const warningCount = result.warnings?.length || 0;
    
    if (errorCount > 0) return 'bg-red-100 border-red-300 text-red-800';
    if (warningCount > 0) return 'bg-yellow-100 border-yellow-300 text-yellow-800';
    return 'bg-green-100 border-green-300 text-green-800';
  };

  const getCategoryDisplayName = (category: string) => {
    const categoryMap: Record<string, string> = {
      '인적사항': '인적사항',
      '출결상황': '출결상황',
      'personal_info': '인적사항',
      'attendance': '출결상황',
      'Unknown': '기타'
    };
    return categoryMap[category] || category;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Batch Summary */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">일괄 검증 결과</h1>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg border">
              <div className="text-2xl font-bold text-blue-600">{batchStats.totalFiles}</div>
              <div className="text-sm text-gray-600">총 파일 수</div>
            </div>
            <div className="bg-white p-4 rounded-lg border">
              <div className="text-2xl font-bold text-gray-600">{batchStats.totalCells.toLocaleString()}</div>
              <div className="text-sm text-gray-600">검사한 셀</div>
            </div>
            <div className="bg-white p-4 rounded-lg border">
              <div className="text-2xl font-bold text-red-600">{batchStats.totalErrors}</div>
              <div className="text-sm text-gray-600">오류</div>
            </div>
            <div className="bg-white p-4 rounded-lg border">
              <div className="text-2xl font-bold text-yellow-600">{batchStats.totalWarnings}</div>
              <div className="text-sm text-gray-600">경고</div>
            </div>
            <div className="bg-white p-4 rounded-lg border">
              <div className="text-2xl font-bold text-blue-600">{batchStats.totalInfo}</div>
              <div className="text-sm text-gray-600">정보</div>
            </div>
          </div>
        </div>

        <div className="flex gap-6">
          {/* File Navigation Sidebar */}
          <div className="w-1/3 bg-white rounded-lg border p-4">
            <h2 className="text-lg font-semibold mb-4">검증된 파일 목록</h2>
            
            {Object.entries(filesByCategory).map(([category, files]) => (
              <div key={category} className="mb-6">
                <h3 className="font-medium text-gray-800 mb-2 border-b pb-1">
                  {getCategoryDisplayName(category)} ({files.length}개 파일)
                </h3>
                
                {files.map(({ fileId, result }) => {
                  const errorCount = result.errors?.length || 0;
                  const warningCount = result.warnings?.length || 0;
                  const infoCount = result.info?.length || 0;
                  
                  return (
                    <button
                      key={fileId}
                      onClick={() => setSelectedFileId(fileId)}
                      className={`w-full text-left p-3 rounded-lg border mb-2 transition-colors ${
                        selectedFileId === fileId 
                          ? 'border-blue-500 bg-blue-50' 
                          : getStatusColor(result)
                      }`}
                    >
                      <div className="font-medium text-sm truncate">
                        {result.fileName || `File ${fileId}`}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        오류: {errorCount} · 경고: {warningCount} · 정보: {infoCount}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Main Results Area */}
          <div className="flex-1">
            {selectedResult ? (
              <ValidationResults
                validationResult={selectedResult}
                onStartNew={onStartNew}
                onError={onError}
              />
            ) : (
              <div className="bg-white rounded-lg border p-8 text-center">
                <p className="text-gray-600">파일을 선택하여 상세 결과를 확인하세요.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BatchValidationResults;