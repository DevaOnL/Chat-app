import React, { useState, useEffect } from 'react';

interface FileMessageProps {
  fileName: string;
  fileSize: number;
  fileType: string;
  fileUrl?: string;
  isImage: boolean;
  className?: string;
}

const FileMessage: React.FC<FileMessageProps> = ({ 
  fileName, 
  fileSize, 
  fileType, 
  fileUrl, 
  isImage,
  className = '' 
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileType: string): string => {
    if (fileType.startsWith('image/')) {
      return '🖼️';
    } else if (fileType === 'application/pdf') {
      return '📄';
    } else if (fileType.includes('word')) {
      return '📝';
    } else if (fileType.includes('excel') || fileType.includes('sheet')) {
      return '📊';
    } else if (fileType.includes('text')) {
      return '📄';
    } else {
      return '📎';
    }
  };

  const handleDownload = () => {
    if (fileUrl) {
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const openModal = () => {
    setIsModalOpen(true);
    setIsAnimating(true);
  };

  const closeModal = () => {
    setIsAnimating(false);
    // Delay hiding the modal to allow close animation to complete
    setTimeout(() => {
      setIsModalOpen(false);
    }, 200);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  };

  // Trigger animation when modal opens
  useEffect(() => {
    if (isModalOpen) {
      // Small delay to ensure modal is rendered before animating
      const timer = setTimeout(() => setIsAnimating(true), 10);
      return () => clearTimeout(timer);
    }
  }, [isModalOpen]);

  if (isImage && fileUrl) {
    return (
      <>
        <div className={`max-w-sm ${className}`}>
          <div className="rounded-lg overflow-hidden bg-panelAlt border border-border">
            <img
              src={fileUrl}
              alt={fileName}
              className="w-full h-auto max-h-64 object-cover cursor-pointer hover:opacity-90 transition-opacity"
              onClick={openModal}
              onError={(e) => {
                // Fallback to file icon if image fails to load
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <div className="hidden p-3 text-center">
              <div className="text-2xl mb-2">🖼️</div>
              <p className="text-sm text-fg opacity-70">Image preview unavailable</p>
            </div>
            <div className="p-3 border-t border-border">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-fg truncate">{fileName}</p>
                  <p className="text-xs text-fg opacity-70">{formatFileSize(fileSize)}</p>
                </div>
                <button
                  onClick={handleDownload}
                  className="ml-2 p-1 text-fg opacity-70 hover:text-accent transition-colors"
                  title="Download"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Image Modal */}
        {isModalOpen && (
          <div 
            className={`fixed inset-0 flex items-center justify-center z-50 p-4 transition-all duration-200 ease-out ${
              isAnimating 
                ? 'bg-black bg-opacity-75 backdrop-blur-sm' 
                : 'bg-black bg-opacity-0'
            }`}
            onClick={closeModal}
            onKeyDown={handleKeyDown}
            tabIndex={0}
          >
            <div 
              className={`relative max-w-4xl max-h-full flex items-center justify-center transition-all duration-200 ease-out ${
                isAnimating 
                  ? 'scale-100 opacity-100' 
                  : 'scale-95 opacity-0'
              }`}
            >
              <img
                src={fileUrl}
                alt={fileName}
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
              <button
                onClick={closeModal}
                className={`absolute top-4 right-4 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-75 transition-all duration-200 ${
                  isAnimating ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
                }`}
                title="Close (ESC)"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div 
                className={`absolute bottom-4 left-4 bg-black bg-opacity-50 text-white px-3 py-2 rounded-lg transition-all duration-200 ${
                  isAnimating ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
                }`}
              >
                <p className="text-sm font-medium">{fileName}</p>
                <p className="text-xs opacity-75">{formatFileSize(fileSize)}</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload();
                }}
                className={`absolute bottom-4 right-4 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-75 transition-all duration-200 ${
                  isAnimating ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
                }`}
                title="Download"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Non-image files
  return (
    <div className={`max-w-sm ${className}`}>
      <div className="flex items-center p-3 bg-panelAlt border border-border rounded-lg hover:bg-panelAlt transition-colors">
        <div className="text-2xl mr-3 flex-shrink-0">
          {getFileIcon(fileType)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-fg truncate" title={fileName}>
            {fileName}
          </p>
          <p className="text-xs text-fg opacity-70">
            {formatFileSize(fileSize)} • {fileType.split('/')[1]?.toUpperCase() || 'FILE'}
          </p>
        </div>
        <button
          onClick={handleDownload}
          className="ml-2 p-2 text-fg opacity-70 hover:text-accent transition-colors flex-shrink-0"
          title="Download"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default FileMessage;
