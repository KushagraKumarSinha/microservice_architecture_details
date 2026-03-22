import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ShieldCheck, Terminal, AlertCircle, Loader2 } from "lucide-react";

interface AuthResponse {
  data: unknown;
  error: { message: string } | null;
  timestamp: string;
}

export default function Auth() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [lastResponse, setLastResponse] = useState<AuthResponse | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLastResponse(null);

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        const resp: AuthResponse = {
          data,
          error: error ? { message: error.message } : null,
          timestamp: new Date().toLocaleTimeString(),
        };
        setLastResponse(resp);
        if (!error) {
          await supabase.auth.signOut();
          setMode("signin");
          setPassword("");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        const resp: AuthResponse = {
          data,
          error: error ? { message: error.message } : null,
          timestamp: new Date().toLocaleTimeString(),
        };
        setLastResponse(resp);

        if (!error && data.user) {
          const token = data.session.access_token;
          const userId = data.user.id;

          // Open the Todo app and send credentials via postMessage (no localStorage)
          const todoWindow = window.open("http://localhost:3001", "_blank");

          const sendMessage = () => {
            todoWindow?.postMessage(
              { type: "AUTH_TOKEN", token, userId },
              "http://localhost:3001" // always specify exact targetOrigin with auth tokens
            );
          };

          // Retry sending until the window acknowledges or we time out
          let attempts = 0;
          const interval = setInterval(() => {
            attempts++;
            sendMessage();
            if (attempts >= 10) clearInterval(interval); // give up after ~5s
          }, 500);

          // Stop retrying once the Todo app confirms it received the token
          const handleAck = (event: MessageEvent) => {
            if (
              event.origin === "http://localhost:3001" &&
              event.data?.type === "AUTH_TOKEN_ACK"
            ) {
              clearInterval(interval);
              window.removeEventListener("message", handleAck);
            }
          };
          window.addEventListener("message", handleAck);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setLastResponse({ data: null, error: { message }, timestamp: new Date().toLocaleTimeString() });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-svh bg-background text-foreground flex flex-col items-center justify-center p-6 antialiased">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="w-full max-w-[400px] space-y-8"
      >
        <div className="space-y-2">
          <div className="h-10 w-10 bg-primary rounded-xl flex items-center justify-center mb-6 shadow-lg">
            <ShieldCheck className="text-primary-foreground w-6 h-6" />
          </div>
          <h1 className="text-2xl font-medium tracking-[-0.02em]">
            {mode === "signin" ? "Welcome back" : "Create an account"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === "signin"
              ? "Enter your credentials to access your todos."
              : "Sign up to start managing your tasks."}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground ml-1">
              Email Address
            </label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-11 px-4 rounded-lg border border-border bg-popover focus:ring-2 focus:ring-ring/10 focus:ring-offset-2 focus:border-foreground transition-all outline-none text-sm"
              placeholder="name@company.com"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground ml-1">
              Password
            </label>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-11 px-4 rounded-lg border border-border bg-popover focus:ring-2 focus:ring-ring/10 focus:ring-offset-2 focus:border-foreground transition-all outline-none text-sm"
              placeholder="••••••••"
              minLength={6}
            />
          </div>

          <button
            disabled={loading}
            className="w-full h-11 bg-primary text-primary-foreground rounded-lg font-medium text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                {mode === "signin" ? "Sign In" : "Create Account"}
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setLastResponse(null);
            }}
            className="text-foreground font-medium hover:underline underline-offset-4"
          >
            {mode === "signin" ? "Sign up" : "Sign in"}
          </button>
        </p>

        <AnimatePresence>
          {lastResponse && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="pt-4"
            >
              <div className="rounded-xl border border-border bg-card overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
                <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/50">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Response
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {lastResponse.timestamp}
                  </span>
                </div>
                <div className="p-4 overflow-x-auto">
                  <pre className="text-[12px] leading-relaxed font-mono text-foreground/80">
                    {JSON.stringify(lastResponse, null, 2)}
                  </pre>
                </div>
                {lastResponse.error && (
                  <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20 flex items-center gap-2 text-destructive">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-medium">
                      {lastResponse.error.message || "Authentication failed"}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
