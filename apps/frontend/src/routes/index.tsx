import { createFileRoute, Link } from "@tanstack/react-router";
import { Bot, Zap, Shield, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-linear-to-br from-lilac-light via-surface to-muted">
      {/* Navbar */}
      <nav className="border-b border-border bg-surface/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg text-foreground">Oriom Bots</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/sign-in"
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              Entrar
            </Link>
            <Link
              to="/sign-up"
              className="text-sm font-medium px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors"
            >
              Começar grátis
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-lilac-light text-primary text-sm font-medium mb-6">
          <Zap className="w-3.5 h-3.5" />
          Gerencie seus bots do Telegram
        </div>
        <h1 className="text-5xl font-bold text-foreground mb-6 leading-tight">
          Seus bots do Telegram,<br />
          <span className="text-primary">um lugar só.</span>
        </h1>
        <p className="text-lg text-text-label max-w-xl mx-auto mb-10">
          Crie, configure e monitore todos os seus bots do Telegram de forma simples e intuitiva.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            to="/sign-up"
            className="px-6 py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary-hover transition-colors shadow-lg shadow-primary/25"
          >
            Criar conta grátis
          </Link>
          <Link
            to="/sign-in"
            className="px-6 py-3 rounded-xl border border-border text-text-medium font-medium hover:border-border-medium hover:text-primary transition-colors"
          >
            Já tenho conta
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: Bot,
              title: "Múltiplos bots",
              desc: "Gerencie quantos bots precisar em um único painel.",
            },
            {
              icon: Shield,
              title: "Seguro",
              desc: "Seus tokens ficam protegidos com autenticação robusta.",
            },
            {
              icon: BarChart3,
              title: "Dashboard",
              desc: "Visualize o desempenho dos seus bots em tempo real.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="p-6 rounded-2xl bg-surface border border-border hover:border-lilac hover:shadow-lg hover:shadow-primary/8 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-lilac-light flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
