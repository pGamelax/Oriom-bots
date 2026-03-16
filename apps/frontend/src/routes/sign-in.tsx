import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Bot } from "lucide-react";
import { signIn } from "@/lib/auth-client";
import { toast } from "sonner";

export const Route = createFileRoute("/sign-in")({
  component: SignInPage,
});

function SignInPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn.email({
        email,
        password,
        fetchOptions: {
          onSuccess: () => navigate({ to: "/dashboard" }),
          onError: (ctx) => { toast.error(ctx.error.message ?? "Erro ao entrar"); },
        },
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-lilac-light via-surface to-muted flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center mb-3 shadow-lg shadow-primary/30">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Bem-vindo de volta</h1>
          <p className="text-sm text-muted-foreground mt-1">Entre na sua conta Oriom Bots</p>
        </div>

        {/* Card */}
        <div className="bg-surface rounded-2xl border border-border p-6 shadow-xl shadow-primary/8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-medium">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="h-10 px-3 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-text-placeholder"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-medium">Senha</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-10 px-3 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-text-placeholder"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="h-10 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed transition-colors mt-1"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-5">
          Não tem uma conta?{" "}
          <Link to="/sign-up" className="font-medium text-primary hover:underline">
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  );
}
