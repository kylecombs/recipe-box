import { useEffect } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  show: boolean;
  duration?: number;
  onClose?: () => void;
}

export default function Toast({ message, type, show, duration = 3000, onClose }: ToastProps) {
  // Auto-close the toast after the specified duration
  useEffect(() => {
    if (show && onClose) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [show, duration, onClose]);

  // Don't render anything if not shown
  if (!show) return null;

  const baseClasses = "fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg transition-all duration-300";
  const typeClasses = type === 'success' 
    ? "bg-green-50 text-green-800 border border-green-200" 
    : "bg-red-50 text-red-800 border border-red-200";
  return (
    <div className={`${baseClasses} ${typeClasses} translate-x-0 opacity-100`}>
      {type === 'success' ? (
        <CheckCircle size={20} className="text-green-600" />
      ) : (
        <XCircle size={20} className="text-red-600" />
      )}
      <span className="text-sm font-medium">{message}</span>
      <button
        onClick={() => {
          if (onClose) {
            onClose();
          }
        }}
        className="ml-2 text-gray-500 hover:text-gray-700"
      >
        <X size={16} />
      </button>
    </div>
  );
}