import { useState } from "react";
import { ArrowRightLeft, Loader2 } from "lucide-react";

interface MeasurementConverterProps {
  ingredientName: string;
  quantity: string | null;
  unit: string | null;
  className?: string;
}

interface ConversionResult {
  success: boolean;
  convertedValue?: number;
  unit?: string;
  error?: string;
}

// Common conversion targets that users might want
const CONVERSION_TARGETS = [
  { unit: 'grams', label: 'grams' },
  { unit: 'ounces', label: 'ounces' },
  { unit: 'pounds', label: 'pounds' },
  { unit: 'cups', label: 'cups' },
  { unit: 'tablespoons', label: 'tablespoons' },
  { unit: 'teaspoons', label: 'teaspoons' },
  { unit: 'milliliters', label: 'mL' },
  { unit: 'liters', label: 'liters' },
];

export default function MeasurementConverter({ 
  ingredientName, 
  quantity, 
  unit, 
  className = "" 
}: MeasurementConverterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [conversions, setConversions] = useState<Record<string, ConversionResult>>({});

  // Don't show converter if we don't have quantity and unit
  if (!quantity || !unit) {
    return null;
  }

  const handleConvert = async (targetUnit: string) => {
    if (!quantity || !unit) return;

    setIsConverting(true);
    
    try {
      // Parse the quantity - handle mixed fractions
      let numericValue: number;
      
      if (quantity.includes(' ')) {
        // Handle mixed fractions like "1 1/2"
        const parts = quantity.split(' ');
        const whole = parseInt(parts[0]);
        if (parts[1]?.includes('/')) {
          const [num, den] = parts[1].split('/').map(Number);
          numericValue = whole + (num / den);
        } else {
          numericValue = parseFloat(quantity);
        }
      } else if (quantity.includes('/')) {
        // Handle simple fractions like "1/2"
        const [num, den] = quantity.split('/').map(Number);
        numericValue = num / den;
      } else {
        numericValue = parseFloat(quantity);
      }

      if (isNaN(numericValue)) {
        setConversions(prev => ({
          ...prev,
          [targetUnit]: { success: false, error: 'Invalid quantity format' }
        }));
        return;
      }

      const response = await fetch('/api/convert-measurement', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ingredient: ingredientName,
          fromUnit: unit,
          toUnit: targetUnit,
          value: numericValue
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        console.error('Conversion failed:', result);
      }
      
      setConversions(prev => ({
        ...prev,
        [targetUnit]: result
      }));

    } catch (error) {
      setConversions(prev => ({
        ...prev,
        [targetUnit]: { 
          success: false, 
          error: error instanceof Error ? error.message : 'Conversion failed' 
        }
      }));
    } finally {
      setIsConverting(false);
    }
  };

  const formatConvertedValue = (value: number): string => {
    if (value >= 1000) {
      return value.toLocaleString();
    }
    if (value < 1) {
      return value.toFixed(2);
    }
    return value.toFixed(1);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
        title="Convert measurements"
      >
        <ArrowRightLeft size={12} className="mr-1" />
        Convert
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-64">
          <div className="p-3">
            <div className="text-sm font-medium text-gray-900 mb-2">
              Convert {quantity} {unit} of {ingredientName}
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              {CONVERSION_TARGETS
                .filter(target => {
                  // Don't show current unit - check for various forms
                  const normalizedUnit = unit?.toLowerCase().replace(/[s\s]/g, '');
                  const normalizedTarget = target.unit.toLowerCase().replace(/[s\s]/g, '');
                  return normalizedUnit !== normalizedTarget;
                })
                .map(target => (
                  <button
                    key={target.unit}
                    onClick={() => handleConvert(target.unit)}
                    disabled={isConverting}
                    className="text-left px-2 py-1 text-sm bg-gray-50 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                  >
                    {target.label}
                  </button>
                ))}
            </div>

            {Object.keys(conversions).length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="text-sm font-medium text-gray-900 mb-2">Results:</div>
                <div className="space-y-1">
                  {Object.entries(conversions).map(([unit, result]) => (
                    <div key={unit} className="text-sm">
                      {result.success ? (
                        <div>
                          <span className="text-green-700">
                            {formatConvertedValue(result.convertedValue!)} {result.unit}
                          </span>
                          {result.error && (
                            <span className="text-xs text-gray-500 ml-1">
                              (approx)
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-red-600">
                          {result.error || 'Conversion failed'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isConverting && (
              <div className="mt-3 flex items-center justify-center">
                <Loader2 size={16} className="animate-spin text-blue-600" />
                <span className="ml-2 text-sm text-gray-600">Converting...</span>
              </div>
            )}
          </div>
          
          <div className="px-3 py-2 border-t border-gray-200 bg-gray-50 rounded-b-lg">
            <button
              onClick={() => setIsOpen(false)}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}