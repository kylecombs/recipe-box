import { Form } from "@remix-run/react";

export default function URLImporter() {
  return (
    <Form method="post">
      <label htmlFor="url" className="block mb-2">Import Recipe from URL:</label>
      <input
        type="url"
        id="url"
        name="recipeUrl"
        required
        className="border rounded p-2 w-full mb-2"
        placeholder="https://example.com/recipe"
      />
      <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
        Import
      </button>
    </Form>
  );
} 