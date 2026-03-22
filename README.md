# 🧩 Microservices Architecture – Auth + Todo Example

This project demonstrates a **frontend microservices architecture** using two independent applications:

* **Auth Service** → Runs on `http://localhost:3000`
* **Todo Service** → Runs on `http://localhost:3001`

Each service is **independently deployed, isolated, and communicates securely**.

---

# 📌 Architecture Overview

```
+-------------------+        postMessage        +-------------------+
|   Auth Service    | -----------------------> |   Todo Service    |
| (localhost:3000)  |                          | (localhost:3001)  |
+-------------------+                          +-------------------+
        |                                                |
        | Supabase Auth                                  | Supabase Edge Functions
        v                                                v
   Authentication                                CRUD Todos API
```

---

# 🧠 Key Microservices Concepts Demonstrated

## 1. Service Independence

* `Auth.tsx` handles **authentication only**
* `Todo.tsx` handles **business logic (todos) only**
* Both run on **different ports (3000 vs 3001)**

👉 No tight coupling between services

---

## 2. Decoupled Communication

Instead of direct imports or shared state, services communicate via:

### 🔁 `window.postMessage`

From Auth → Todo:

```ts
todoWindow?.postMessage(
  { type: "AUTH_TOKEN", token, userId },
  "http://localhost:3001"
);
```

From Todo → Auth (ACK):

```ts
event.source?.postMessage(
  { type: "AUTH_TOKEN_ACK" },
  { targetOrigin: "http://localhost:3000" }
);
```

👉 This mimics **inter-service communication in distributed systems**

---

## 3. Secure Token Transfer (Important 🔐)

### ❌ What we avoid:

* localStorage
* cookies
* URL params

### ✅ What we use:

* **In-memory token passing via postMessage**

From `Auth.tsx`:

* Extract token after login
* Send it to Todo service

From `Todo.tsx`:

```ts
authTokenRef.current = token;
userIdRef.current = userId;
```

👉 Token is:

* NOT persisted
* NOT exposed to XSS via storage
* Lives only in memory

---

## 4. Origin Validation (Critical Security Layer)

### In Todo Service:

```ts
if (event.origin !== "http://localhost:3000") return;
```

### In Auth Service:

```ts
if (event.origin === "http://localhost:3001")
```

👉 Prevents malicious cross-origin attacks

---

## 5. Retry + Acknowledgment Mechanism

Auth service ensures delivery using retry logic:

```ts
let attempts = 0;
const interval = setInterval(() => {
  attempts++;
  sendMessage();
  if (attempts >= 10) clearInterval(interval);
}, 500);
```

Stops when ACK is received:

```ts
if (event.data?.type === "AUTH_TOKEN_ACK")
```

👉 This simulates **reliable message delivery in distributed systems**

---

# 🔐 Authentication Flow

### Step-by-step:

1. User logs in via Auth service
2. Supabase returns:

   * `access_token`
   * `user.id`
3. Auth service:

   * Opens Todo app in new tab
   * Sends token via `postMessage`
4. Todo service:

   * Receives token
   * Stores it in memory (`useRef`)
   * Sends ACK back
5. Todo service uses token for API calls

---

# 📡 API Communication (Todo Service)

All requests use **Bearer token authentication**:

```ts
const auth = await getAuthHeader();

supabase.functions.invoke("get-todos", {
  headers: { Authorization: auth },
});
```

---

# ⚙️ Backend (Supabase)

Used for:

* Authentication (`supabase.auth`)
* Serverless functions:

  * `get-todos`
  * `manage-todos`

---

# 🧩 Todo Service Features

* Fetch todos
* Add todo
* Toggle completion (optimistic UI)
* Delete todo
* Logout

Example:

```ts
await supabase.functions.invoke("manage-todos", {
  headers: { Authorization: auth },
  body: { action: "create", title },
});
```

---

# ⚡ Performance Patterns Used

## 1. Optimistic UI Updates

```ts
setTodos((prev) =>
  prev.map((t) => (t.id === id ? { ...t, completed: !completed } : t))
);
```

👉 UI updates instantly before server confirms

---

## 2. In-Memory Auth Cache

```ts
const authTokenRef = useRef<string | null>(null);
```

👉 Avoids unnecessary re-fetching

---

## 3. Session Fallback

```ts
const { data } = await supabase.auth.getSession();
```

👉 Handles refresh scenarios gracefully

---

# 🚪 Logout Flow

```ts
await supabase.auth.signOut();
authTokenRef.current = null;
userIdRef.current = null;
```

👉 Clears:

* Supabase session
* In-memory credentials

---

# ⚠️ Failure Handling

* Retry mechanism for token delivery
* Optimistic UI rollback on API failure
* Graceful fallback if no auth token:

```ts
if (!auth) {
  navigate("/");
}
```

---

# 🧪 How to Run

### 1. Start Auth Service

```bash
cd auth
npm run dev
# Runs on http://localhost:3000
```

### 2. Start Todo Service

```bash
cd todo
npm run dev
# Runs on http://localhost:3001
```

---

# 🎯 Why This is a Microservices Architecture

Even though this is frontend:

| Principle            | Implementation              |
| -------------------- | --------------------------- |
| Independent services | Separate apps (3000 & 3001) |
| Loose coupling       | postMessage communication   |
| Independent scaling  | Can deploy separately       |
| Service boundaries   | Auth vs Todos               |
| Secure communication | Token + origin validation   |

---

# 🚀 Possible Improvements

* Use API Gateway instead of direct communication
* Replace `postMessage` with:

  * WebSockets
  * Event bus (Kafka, RabbitMQ)
* Add refresh token rotation
* Use iframe-based embedding instead of new tab
* Introduce service discovery

---

# 🧠 Key Takeaways

* Microservices ≠ only backend
* Frontend can also be distributed
* Security is critical when sharing auth across services
* Loose coupling improves scalability and maintainability

---

# 💬 TL;DR

* Auth service logs user in
* Sends token securely via `postMessage`
* Todo service consumes token and performs API calls
* No shared state, no localStorage, fully decoupled

