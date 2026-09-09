import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (await isAuthenticated()) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <div>
          <p className="mb-2 text-xs tracking-[0.2em] text-accent uppercase">Live desk</p>
          <h1 className="text-4xl font-semibold tracking-tight">Thumb Desk</h1>
          <p className="mt-3 text-muted">Enter the editor password to generate tonight’s thumbnail.</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
