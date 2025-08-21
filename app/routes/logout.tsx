import type { ActionFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { destroyAuthCookie } from "~/utils/jwt.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  return redirect("/", {
    headers: {
      "Set-Cookie": destroyAuthCookie(),
    },
  });
};

export const loader = async () => {
  return redirect("/");
};