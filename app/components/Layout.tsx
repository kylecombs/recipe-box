import { Outlet } from "@remix-run/react";

export default function Layout() {
  return (
    <div>
      {/* Add common layout elements here, like header, footer, nav */}
      <main>
        <Outlet />
      </main>
    </div>
  );
} 