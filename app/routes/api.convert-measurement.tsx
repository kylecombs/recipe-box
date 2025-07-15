import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { convertMeasurement } from "~/utils/measurement-converter.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const { ingredient, fromUnit, toUnit, value } = await request.json();
    
    if (!ingredient || !fromUnit || !toUnit || value === undefined) {
      return json({ 
        success: false, 
        error: "Missing required fields: ingredient, fromUnit, toUnit, value" 
      }, { status: 400 });
    }

    const result = await convertMeasurement(
      ingredient,
      fromUnit,
      toUnit,
      value
    );

    return json(result);
  } catch (error) {
    console.error("Conversion API error:", error);
    return json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Conversion failed" 
    }, { status: 500 });
  }
};

// Don't allow GET requests to this endpoint
export const loader = () => {
  return json({ error: "Method not allowed" }, { status: 405 });
};