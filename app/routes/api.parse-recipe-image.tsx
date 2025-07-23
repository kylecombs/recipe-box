import { json } from "@remix-run/node";
import type { ActionFunction } from "@remix-run/node";
import { parseRecipeFromImage, validateImageBuffer } from "~/utils/image-processor.server";
import { requireUserId } from "~/utils/auth.server";

export const action: ActionFunction = async ({ request }) => {
  // Ensure user is authenticated
  await requireUserId(request);
  
  try {
    const formData = await request.formData();
    const imageFile = formData.get("image") as File;
    
    if (!imageFile || !(imageFile instanceof File)) {
      return json(
        { error: "No image file provided" },
        { status: 400 }
      );
    }
    
    // Convert file to buffer
    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Validate image
    const isValidImage = await validateImageBuffer(buffer);
    if (!isValidImage) {
      return json(
        { error: "Invalid image file" },
        { status: 400 }
      );
    }
    
    // Check file size (limit to 10MB)
    if (buffer.length > 10 * 1024 * 1024) {
      return json(
        { error: "Image file too large. Maximum size is 10MB" },
        { status: 400 }
      );
    }
    
    // Process the image and extract recipe data
    const recipeData = await parseRecipeFromImage(buffer);
    
    return json({
      success: true,
      recipe: recipeData,
    });
    
  } catch (error) {
    console.error("Error parsing recipe from image:", error);
    
    if (error instanceof Error && error.message === "Image quality is too low for reliable text extraction") {
      return json(
        { error: "Image quality is too low. Please try a clearer image." },
        { status: 400 }
      );
    }
    
    return json(
      { error: "Failed to parse recipe from image. Please try again or enter manually." },
      { status: 500 }
    );
  }
};