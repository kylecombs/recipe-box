import { useState } from "react";
import { ChevronDown, ChevronUp, Activity, Info } from "lucide-react";
import type { RecipeNutrition, NutritionData } from "~/utils/nutrition.server";

interface NutritionFactsProps {
  nutrition: RecipeNutrition;
  className?: string;
}

interface NutrientDisplayProps {
  label: string;
  value: number;
  unit: string;
  dailyValue?: number; // percentage of daily value
  isMain?: boolean;
}

const NutrientDisplay = ({ label, value, unit, dailyValue, isMain = false }: NutrientDisplayProps) => {
  const formattedValue = value < 1 ? value.toFixed(1) : Math.round(value);
  
  return (
    <div className={`flex justify-between items-center py-1 ${isMain ? 'border-b border-gray-300 font-semibold' : ''}`}>
      <span className={isMain ? 'text-base' : 'text-sm text-gray-700'}>{label}</span>
      <div className="flex items-center gap-2">
        <span className={isMain ? 'font-bold' : 'font-medium'}>{formattedValue}{unit}</span>
        {dailyValue && (
          <span className="text-xs text-gray-500 min-w-[3rem] text-right">{dailyValue}%</span>
        )}
      </div>
    </div>
  );
};

const MacronutrientRing = ({ nutrition }: { nutrition: NutritionData }) => {
  const totalCalories = nutrition.calories;
  const proteinCals = nutrition.protein * 4;
  const carbCals = nutrition.carbohydrates * 4;
  const fatCals = nutrition.fat * 9;
  
  const proteinPercent = totalCalories > 0 ? (proteinCals / totalCalories) * 100 : 0;
  const carbPercent = totalCalories > 0 ? (carbCals / totalCalories) * 100 : 0;
  const fatPercent = totalCalories > 0 ? (fatCals / totalCalories) * 100 : 0;
  
  const circumference = 2 * Math.PI * 45; // radius of 45
  const proteinOffset = 0;
  const carbOffset = (proteinPercent / 100) * circumference;
  const fatOffset = ((proteinPercent + carbPercent) / 100) * circumference;
  
  return (
    <div className="relative w-48 h-48 sm:w-56 sm:h-56">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="8"
        />
        
        {/* Protein arc */}
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="#ef4444" // red
          strokeWidth="8"
          strokeDasharray={`${(proteinPercent / 100) * circumference} ${circumference}`}
          strokeDashoffset={-proteinOffset}
          className="transition-all duration-500"
        />
        
        {/* Carbs arc */}
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="#3b82f6" // blue
          strokeWidth="8"
          strokeDasharray={`${(carbPercent / 100) * circumference} ${circumference}`}
          strokeDashoffset={-carbOffset}
          className="transition-all duration-500"
        />
        
        {/* Fat arc */}
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="#eab308" // yellow
          strokeWidth="8"
          strokeDasharray={`${(fatPercent / 100) * circumference} ${circumference}`}
          strokeDashoffset={-fatOffset}
          className="transition-all duration-500"
        />
      </svg>
      
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-xs font-medium text-gray-700">
        <div className="text-lg font-bold">{Math.round(totalCalories)}</div>
        <div>cal</div>
      </div>
    </div>
  );
};

export default function NutritionFacts({ nutrition, className = "" }: NutritionFactsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPerServing, setShowPerServing] = useState(true);
  
  const currentNutrition = showPerServing ? nutrition.perServing : nutrition.totalNutrition;
  const servingText = showPerServing ? "Per Serving" : `Total Recipe (${nutrition.servings} servings)`;
  
  // Calculate daily values (based on 2000 calorie diet)
  const dailyValues = {
    fat: Math.round((currentNutrition.fat / 65) * 100),
    carbs: Math.round((currentNutrition.carbohydrates / 300) * 100),
    fiber: Math.round((currentNutrition.fiber / 25) * 100),
    protein: Math.round((currentNutrition.protein / 50) * 100),
    sodium: Math.round((currentNutrition.sodium / 2300) * 100),
    cholesterol: Math.round((currentNutrition.cholesterol / 300) * 100),
    vitaminC: Math.round((currentNutrition.vitaminC / 90) * 100),
    calcium: Math.round((currentNutrition.calcium / 1300) * 100),
    iron: Math.round((currentNutrition.iron / 18) * 100),
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
      >
        <div className="flex items-center gap-3">
          <Activity size={20} className="text-green-600" />
          <div>
            <h3 className="font-semibold text-gray-900">Nutrition Facts</h3>
            <p className="text-sm text-gray-600">{servingText}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Quick nutrition preview */}
          <div className="hidden sm:flex items-center gap-4 text-sm text-gray-600">
            <span>{Math.round(currentNutrition.calories)} cal</span>
            <span>{Math.round(currentNutrition.protein)}g protein</span>
            <span>{Math.round(currentNutrition.carbohydrates)}g carbs</span>
            <span>{Math.round(currentNutrition.fat)}g fat</span>
          </div>
          
          {isExpanded ? (
            <ChevronUp size={20} className="text-gray-400" />
          ) : (
            <ChevronDown size={20} className="text-gray-400" />
          )}
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-gray-100 p-4">
          {/* Serving toggle */}
          <div className="flex justify-center mb-4">
            <div className="bg-gray-100 rounded-lg p-1 flex">
              <button
                onClick={() => setShowPerServing(true)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  showPerServing 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Per Serving
              </button>
              <button
                onClick={() => setShowPerServing(false)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  !showPerServing 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Total Recipe
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Macronutrient visualization */}
            <div className="flex flex-col justify-between p-4 sm:p-8 gap-6">
              <div className="flex items-center justify-center">
                <MacronutrientRing nutrition={currentNutrition} />
              </div>
              
              {/* Macro legend */}
              <div className="flex flex-col gap-3 text-md">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span>Protein ({Math.round((currentNutrition.protein * 4 / currentNutrition.calories) * 100) || 0}%)</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span>Carbs ({Math.round((currentNutrition.carbohydrates * 4 / currentNutrition.calories) * 100) || 0}%)</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <span>Fat ({Math.round((currentNutrition.fat * 9 / currentNutrition.calories) * 100) || 0}%)</span>
                </div>
              </div>
            </div>

            {/* Detailed nutrition facts */}
            <div className="space-y-2">
              <div className="flex justify-between items-center mb-3">
                <span className="font-semibold">Nutrition Facts</span>
                <span className="text-xs text-gray-500">% Daily Value*</span>
              </div>
              
              <NutrientDisplay 
                label="Calories" 
                value={currentNutrition.calories} 
                unit="" 
                isMain 
              />
              
              <NutrientDisplay 
                label="Total Fat" 
                value={currentNutrition.fat} 
                unit="g" 
                dailyValue={dailyValues.fat} 
              />
              
              <NutrientDisplay 
                label="Cholesterol" 
                value={currentNutrition.cholesterol} 
                unit="mg" 
                dailyValue={dailyValues.cholesterol} 
              />
              
              <NutrientDisplay 
                label="Sodium" 
                value={currentNutrition.sodium} 
                unit="mg" 
                dailyValue={dailyValues.sodium} 
              />
              
              <NutrientDisplay 
                label="Total Carbohydrates" 
                value={currentNutrition.carbohydrates} 
                unit="g" 
                dailyValue={dailyValues.carbs} 
              />
              
              <NutrientDisplay 
                label="  Dietary Fiber" 
                value={currentNutrition.fiber} 
                unit="g" 
                dailyValue={dailyValues.fiber} 
              />
              
              <NutrientDisplay 
                label="  Total Sugars" 
                value={currentNutrition.sugar} 
                unit="g" 
              />
              
              <NutrientDisplay 
                label="Protein" 
                value={currentNutrition.protein} 
                unit="g" 
                dailyValue={dailyValues.protein} 
                isMain 
              />
              
              {/* Vitamins and minerals */}
              <div className="mt-3">
                <NutrientDisplay 
                  label="Vitamin C" 
                  value={currentNutrition.vitaminC} 
                  unit="mg" 
                  dailyValue={dailyValues.vitaminC} 
                />
                <NutrientDisplay 
                  label="Calcium" 
                  value={currentNutrition.calcium} 
                  unit="mg" 
                  dailyValue={dailyValues.calcium} 
                />
                <NutrientDisplay 
                  label="Iron" 
                  value={currentNutrition.iron} 
                  unit="mg" 
                  dailyValue={dailyValues.iron} 
                />
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div className="mt-4 pt-3 border-t border-gray-200 flex items-center gap-2 text-xs text-gray-500">
            <Info size={12} />
            <span>
              *Daily Values are based on a 2000 calorie diet. Analyzed on {nutrition.lastAnalyzed.toLocaleDateString()}.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}