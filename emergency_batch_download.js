// Emergency client-side batch download solution
// This can be added to the frontend as a temporary workaround

async function emergencyBatchDownload(batchResults, format = 'json') {
  const reports = [];
  
  for (const [id, result] of batchResults.entries()) {
    try {
      const response = await fetch(`/api/report/${id}/download?format=${format}`, {
        method: 'GET'
      });
      
      if (response.ok) {
        if (format === 'json') {
          const data = await response.json();
          reports.push({ id, fileName: result.fileName, data });
        } else {
          const blob = await response.blob();
          reports.push({ id, fileName: result.fileName, blob });
        }
      }
    } catch (error) {
      console.error(`Failed to download report for ${id}:`, error);
    }
  }
  
  // Combine and download
  if (format === 'json') {
    const combined = {
      batchSummary: {
        totalFiles: reports.length,
        generatedAt: new Date(),
      },
      reports: reports
    };
    
    const blob = new Blob([JSON.stringify(combined, null, 2)], 
                         { type: 'application/json' });
    downloadBlob(blob, 'emergency_batch_report.json');
  }
}

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
