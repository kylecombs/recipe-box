import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useActionData, useSearchParams } from "@remix-run/react";
import { AuthService } from "~/services/auth.server";
import { getOptionalUser, createAuthCookie } from "~/utils/jwt.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getOptionalUser(request);
  if (user) {
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

  if (!email || typeof email !== "string") {
    return json({ errors: { email: "Email is required" } }, { status: 400 });
  }

  if (!password || typeof password !== "string") {
    return json({ errors: { password: "Password is required" } }, { status: 400 });
  }

  if (!name || typeof name !== "string") {
    return json({ errors: { name: "Name is required" } }, { status: 400 });
  }

  if (password.length < 6) {
    return json({ errors: { password: "Password must be at least 6 characters" } }, { status: 400 });
  }

  try {
    const user = await AuthService.createUser(email, password, name);
    const { accessToken } = AuthService.generateTokens(user);

    return redirect(redirectTo.toString(), {
      headers: {
        "Set-Cookie": createAuthCookie(accessToken),
      },
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return json({ errors: { email: "A user with this email already exists" } }, { status: 400 });
    }
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