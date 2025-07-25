// Catch-all route for unmatched URLs
import { json } from "@remix-run/node";

export const loader = () => {
  throw new Response("Not Found", { status: 404 });
};

export default function CatchAll() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900">404</h1>
        <p className="mt-2 text-xl text-gray-600">Page not found</p>
        <a href="/" className="mt-4 inline-block text-blue-600 hover:text-blue-800">
          Go back home
        </a>
      </div>
    </div>
  );
}