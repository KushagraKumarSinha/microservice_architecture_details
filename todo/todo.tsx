import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, LogOut, Loader2, CheckCircle2, Circle, ListTodo } from "lucide-react";

interface Todo {
  id: string;
  title: string;
  completed: boolean;
  created_at: string;
  user_id: string;
}

export default function TodoPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Store credentials in refs — in-memory only, never touches localStorage
  const authTokenRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);

  const navigate = useNavigate();

  const getAuthHeader = useCallback(async (): Promise<string | null> => {
    // Prefer the in-memory token received via postMessage
    if (authTokenRef.current) return `Bearer ${authTokenRef.current}`;

    // Fallback: try Supabase session (e.g. on refresh within the same tab)
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ? `Bearer ${data.session.access_token}` : null;
  }, []);

  const fetchTodos = useCallback(async () => {
    setLoading(true);
    try {
      const auth = await getAuthHeader();
      if (!auth) {
        navigate("/");
        return;
      }
      const { data, error } = await supabase.functions.invoke("get-todos", {
        headers: { Authorization: auth },
      });
      if (error) throw error;
      setTodos(data?.data ?? []);
    } catch (err) {
      console.error("Failed to fetch todos:", err);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader, navigate]);

  // Listen for AUTH_TOKEN message from Auth app (localhost:3000)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Always verify origin before trusting the payload
      if (event.origin !== "http://localhost:3000") return;

      if (event.data?.type === "AUTH_TOKEN") {
        const { token, userId } = event.data;

        // Store in memory only
        authTokenRef.current = token;
        userIdRef.current = userId;
        setIsAuthenticated(true);

        // Acknowledge receipt so Auth.tsx stops retrying
        event.source?.postMessage(
          { type: "AUTH_TOKEN_ACK" },
          { targetOrigin: "http://localhost:3000" }
        );

        fetchTodos();
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [fetchTodos]);

  // On mount, also check if there's already a live Supabase session
  // (covers the case where user refreshes the Todo tab)
  useEffect(() => {
    const checkExistingSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        authTokenRef.current = data.session.access_token;
        userIdRef.current = data.session.user.id;
        setIsAuthenticated(true);
        fetchTodos();
      } else {
        setLoading(false);
      }
    };
    checkExistingSession();
  }, [fetchTodos]);

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setAdding(true);
    try {
      const auth = await getAuthHeader();
      if (!auth) return;
      const { data, error } = await supabase.functions.invoke("manage-todos", {
        headers: { Authorization: auth },
        body: { action: "create", title: newTitle.trim() },
      });
      if (error) throw error;
      setTodos((prev) => [data.data, ...prev]);
      setNewTitle("");
    } catch (err) {
      console.error("Failed to add todo:", err);
    } finally {
      setAdding(false);
    }
  };

  const toggleTodo = async (id: string, completed: boolean) => {
    // Optimistic update
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !completed } : t))
    );
    try {
      const auth = await getAuthHeader();
      if (!auth) return;
      await supabase.functions.invoke("manage-todos", {
        headers: { Authorization: auth },
        body: { action: "toggle", id, completed: !completed },
      });
    } catch (err) {
      // Revert on error
      setTodos((prev) =>
        prev.map((t) => (t.id === id ? { ...t, completed } : t))
      );
      console.error("Failed to toggle todo:", err);
    }
  };

  const deleteTodo = async (id: string) => {
    const prev = todos;
    setTodos((t) => t.filter((todo) => todo.id !== id));
    try {
      const auth = await getAuthHeader();
      if (!auth) return;
      await supabase.functions.invoke("manage-todos", {
        headers: { Authorization: auth },
        body: { action: "delete", id },
      });
    } catch (err) {
      setTodos(prev);
      console.error("Failed to delete todo:", err);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // Clear in-memory credentials
    authTokenRef.current = null;
    userIdRef.current = null;
    setIsAuthenticated(false);
    navigate("/");
  };

  const completedCount = todos.filter((t) => t.completed).length;

  // Show a waiting state if no token has arrived yet
  if (!isAuthenticated && !loading) {
    return (
      <div className="min-h-svh bg-background text-foreground flex flex-col items-center justify-center p-6 antialiased">
        <div className="text-center space-y-3">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">Waiting for authentication…</p>
          <p className="text-xs text-muted-foreground">Please sign in from the Auth app.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-background text-foreground flex flex-col items-center p-6 antialiased">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="w-full max-w-[520px] space-y-6 mt-12"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-primary rounded-xl flex items-center justify-center shadow-lg">
              <ListTodo className="text-primary-foreground w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-medium tracking-[-0.02em]">My Todos</h1>
              <p className="text-xs text-muted-foreground">
                {completedCount}/{todos.length} completed
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="h-9 px-3 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-all flex items-center gap-2"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>

        {/* Add todo */}
        <form onSubmit={addTodo} className="flex gap-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="What needs to be done?"
            className="flex-1 h-11 px-4 rounded-lg border border-border bg-popover focus:ring-2 focus:ring-ring/10 focus:ring-offset-2 focus:border-foreground transition-all outline-none text-sm"
          />
          <button
            type="submit"
            disabled={adding || !newTitle.trim()}
            className="h-11 w-11 bg-primary text-primary-foreground rounded-lg flex items-center justify-center hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
          >
            {adding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-5 h-5" />
            )}
          </button>
        </form>

        {/* Todo list */}
        <div className="rounded-xl border border-border bg-card overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : todos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ListTodo className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">No todos yet. Add one above!</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {todos.map((todo) => (
                <motion.div
                  key={todo.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="border-b border-border last:border-b-0"
                >
                  <div className="flex items-center gap-3 px-4 py-3 group">
                    <button
                      onClick={() => toggleTodo(todo.id, todo.completed)}
                      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {todo.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-primary" />
                      ) : (
                        <Circle className="w-5 h-5" />
                      )}
                    </button>
                    <span
                      className={`flex-1 text-sm transition-all ${
                        todo.completed
                          ? "line-through text-muted-foreground"
                          : "text-foreground"
                      }`}
                    >
                      {todo.title}
                    </span>
                    <button
                      onClick={() => deleteTodo(todo.id)}
                      className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </motion.div>
    </div>
  );
}
