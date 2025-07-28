import { ReactNode, useState } from "react";

interface TooltipProps {
  content: string;
  children: ReactNode;
  className?: string;
}

export default function Tooltip({ content, children, className = "" }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className={`relative inline-block ${className}`}>
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        {children}
      </div>
      
      {isVisible && (
        <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 pointer-events-none">
          <div className="bg-gray-900 text-white text-xs rounded-md py-1 px-2 whitespace-nowrap">
            {content}
          </div>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-px">
            <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
          </div>
        </div>
      )}
    </div>
  );
}