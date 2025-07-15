import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useActionData, useSearchParams } from "@remix-run/react";
import { commitSession, getSession } from "~/utils/session.server";
import { db } from "~/utils/db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  if (session.has("userId")) {
    return redirect("/recipes");
  }
  return json({});
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");
  const name = formData.get("name");
  const redirectTo = formData.get("redirectTo") || "/recipes";

  if (!email) {
    return json({ errors: { email: "Email is required" } }, { status: 400 });
  }

  if (!password) {
    return json({ errors: { password: "Password is required" } }, { status: 400 });
  }

  if (!name) {
    return json({ errors: { name: "Name is required" } }, { status: 400 });
  }

  // For demo purposes, create user in database
  const userId = `demo-${email.toString().replace("@", "-").replace(".", "-")}`;
  
  try {
    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email: email.toString() }
    });
    
    if (existingUser) {
      return json({ errors: { email: "A user with this email already exists" } }, { status: 400 });
    }

    // Create new user
    await db.user.create({
      data: {
        id: userId,
        email: email.toString(),
        name: name.toString(),
        password: "demo-password" // This is just for demo, not a real auth system
      }
    });
    
    const session = await getSession(request.headers.get("Cookie"));
    session.set("userId", userId);

    return redirect(redirectTo.toString(), {
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    return json({ errors: { email: "Failed to create account" } }, { status: 500 });
  }
}

export default function SignupPage() {
  const actionData = useActionData<typeof action>();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/recipes";

  return (
    <div className="flex min-h-full flex-col justify-center">
      <div className="mx-auto w-full max-w-md px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Create Account</h1>
          <p className="mt-2 text-gray-600">Join the Recipe Organizer demo</p>
        </div>

        <Form method="post" className="space-y-6">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700"
            >
              Full Name
            </label>
            <div className="mt-1">
              <input
                id="name"
                required
                name="name"
                type="text"
                autoComplete="name"
                aria-invalid={actionData?.errors && 'name' in actionData.errors ? true : undefined}
                aria-describedby="name-error"
                className="w-full rounded border border-gray-500 px-2 py-1 text-lg"
              />
              {actionData?.errors && 'name' in actionData.errors ? (
                <div className="pt-1 text-red-700" id="name-error">
                  {actionData.errors.name}
                </div>
              ) : null}
            </div>
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              Email address
            </label>
            <div className="mt-1">
              <input
                id="email"
                required
                name="email"
                type="email"
                autoComplete="email"
                aria-invalid={actionData?.errors && 'email' in actionData.errors ? true : undefined}
                aria-describedby="email-error"
                className="w-full rounded border border-gray-500 px-2 py-1 text-lg"
              />
              {actionData?.errors && 'email' in actionData.errors ? (
                <div className="pt-1 text-red-700" id="email-error">
                  {actionData.errors.email}
                </div>
              ) : null}
            </div>
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              Password
            </label>
            <div className="mt-1">
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                aria-invalid={actionData?.errors && 'password' in actionData.errors ? true : undefined}
                aria-describedby="password-error"
                className="w-full rounded border border-gray-500 px-2 py-1 text-lg"
              />
              {actionData?.errors && 'password' in actionData.errors ? (
                <div className="pt-1 text-red-700" id="password-error">
                  {actionData.errors.password}
                </div>
              ) : null}
            </div>
          </div>

          <input type="hidden" name="redirectTo" value={redirectTo} />
          <button
            type="submit"
            className="w-full rounded bg-green-500 px-4 py-2 text-white hover:bg-green-600 focus:bg-green-400"
          >
            Create Account
          </button>
        </Form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}