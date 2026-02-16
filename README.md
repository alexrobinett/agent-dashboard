# Agent Dashboard

[![CI](https://github.com/alexrobinett/agent-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/alexrobinett/agent-dashboard/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A modern, real-time task management dashboard for AI agents built with cutting-edge web technologies.

## 🚀 Tech Stack

- **[TanStack Start](https://tanstack.com/start)** - Full-stack React framework with server functions and streaming
- **[Convex](https://convex.dev)** - Real-time database with type-safe queries and mutations
- **[Better Auth](https://better-auth.com)** - Modern authentication with GitHub OAuth
- **[Tailwind CSS](https://tailwindcss.com)** - Utility-first CSS framework
- **[shadcn/ui](https://ui.shadcn.com)** - High-quality, accessible React components
- **[TypeScript](https://www.typescriptlang.org)** - Type-safe JavaScript

## ✨ Features

- 🔐 **Secure Authentication** - GitHub OAuth integration with Better Auth
- ⚡ **Real-time Updates** - Live task synchronization powered by Convex
- 🎨 **Modern UI** - Beautiful, responsive interface with Tailwind CSS and shadcn/ui
- 📊 **Task Management** - Create, assign, and track tasks across multiple agents
- 🔄 **Server Functions** - Type-safe API endpoints with TanStack Start
- 🌊 **Streaming Support** - Progressive data loading for optimal UX

## 📋 Prerequisites

- Node.js 20+ and pnpm
- A [Convex](https://convex.dev) account
- A [GitHub OAuth App](https://github.com/settings/developers) for authentication

## 🛠️ Setup

1. **Clone the repository**

```bash
git clone https://github.com/alexrobinett/agent-dashboard.git
cd agent-dashboard
```

2. **Install dependencies**

```bash
pnpm install
```

3. **Set up environment variables**

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:

```env
# Convex
CONVEX_URL=https://your-project.convex.cloud

# CORS Configuration (optional)
# Comma-separated list of allowed origins for API requests
# Leave empty or set to '*' for development (allows all origins)
# Set to specific domains in production for security
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# Better Auth
AUTH_SECRET=your-secret-key
GITHUB_CLIENT_ID=your-github-oauth-client-id
GITHUB_CLIENT_SECRET=your-github-oauth-client-secret

# App URL
PUBLIC_APP_URL=http://localhost:3000
```

**CORS Security:**

The API uses environment-based CORS configuration for security:

- **Development:** Set `ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173` or leave empty to allow all origins
- **Production:** Set `ALLOWED_ORIGINS=https://yourdomain.com` to restrict API access to your dashboard domain
- Multiple origins supported: `ALLOWED_ORIGINS=https://app.example.com,https://dashboard.example.com`

4. **Run the development server**

```bash
# Start Convex dev server
pnpm convex:dev

# In another terminal, start the app
pnpm dev
```

5. **Open your browser**

Navigate to [http://localhost:3000](http://localhost:3000)

## 🔄 Development Workflow

### Hot Reload & Live Updates

This project uses **concurrent development servers** for optimal DX:

1. **Convex Dev Server** (`pnpm convex:dev`)
   - Runs on port 3210 (default)
   - Hot reloads backend code automatically
   - Pushes schema changes to Convex cloud
   - Generates TypeScript types on save

2. **Vite Dev Server** (`pnpm dev`)
   - Runs on port 3000
   - Hot Module Replacement (HMR) for instant updates
   - Fast refresh for React components
   - Connects to Convex via WebSocket

### Recommended Workflow

**Terminal Setup:**
```bash
# Terminal 1: Convex dev server (leave running)
pnpm convex:dev

# Terminal 2: Vite dev server (leave running)
pnpm dev

# Terminal 3: Run tests in watch mode (optional)
pnpm test:watch
```

### What Happens When You Edit Files

| File Type | Hot Reload Behavior | Need Refresh? |
|-----------|-------------------|--------------|
| `src/**/*.tsx` | ⚡ Instant HMR | No |
| `src/**/*.ts` | ⚡ Instant HMR | No |
| `convex/**/*.ts` | 🔄 Auto-regenerates types | No* |
| `*.config.ts` | 🔄 Requires restart | Yes |
| `.env` | 🔄 Requires restart | Yes |

*Convex changes regenerate types automatically, but your IDE may need a moment to pick them up.

### Verifying Hot Reload Works

**Test Frontend HMR:**
```bash
# 1. Open http://localhost:3000/dashboard
# 2. Edit src/routes/dashboard.tsx (change some text)
# 3. Save the file
# ✅ Browser should update instantly without full reload
```

**Test Convex Hot Reload:**
```bash
# 1. Edit convex/tasks.ts (add a console.log)
# 2. Save the file
# 3. Check Convex terminal
# ✅ You should see "Convex functions updated"
# ✅ TypeScript types regenerate automatically
```

### Concurrent Dev Servers

Both servers run independently and don't conflict:

- **Convex** listens on port 3210 (configurable)
- **Vite** listens on port 3000 (configurable)
- **WebSocket** connection established automatically

You should see in the browser console:
```
[Convex] Connected to Convex cloud
[Vite] connected
```

### Troubleshooting

**WebSocket connection errors:**
```bash
# Check Convex is running
pnpm convex:dev

# Verify VITE_CONVEX_URL in .env matches your deployment
```

**Types not updating after Convex changes:**
```bash
# Restart TypeScript server in your IDE
# VS Code: Cmd+Shift+P → "TypeScript: Restart TS Server"

# Or restart Convex dev server
# Ctrl+C and run: pnpm convex:dev
```

**Port already in use:**
```bash
# Change Vite port
pnpm dev -- --port 3001

# Or kill existing process
lsof -ti:3000 | xargs kill -9
```

**HMR not working:**
```bash
# Clear Vite cache
rm -rf node_modules/.vite

# Restart dev server
pnpm dev
```

## 📁 Project Structure

```
agent-dashboard/
├── src/
│   ├── routes/              # TanStack Router file-based routes
│   │   ├── __root.tsx       # Root layout
│   │   ├── index.tsx        # Dashboard home
│   │   └── auth/            # Authentication routes
│   ├── components/          # React components
│   │   ├── ui/              # shadcn/ui components
│   │   ├── tasks/           # Task-related components
│   │   └── layout/          # Layout components
│   ├── lib/                 # Utilities and helpers
│   │   ├── auth.ts          # Better Auth configuration
│   │   └── utils.ts         # Helper functions
│   └── styles/              # Global styles
│       └── globals.css      # Tailwind base styles
├── convex/                  # Convex backend
│   ├── schema.ts            # Database schema
│   ├── tasks.ts             # Task queries and mutations
│   └── users.ts             # User queries and mutations
├── public/                  # Static assets
├── .env.example             # Environment variable template
├── .gitignore               # Git ignore rules
├── LICENSE                  # MIT License
├── package.json             # Dependencies and scripts
├── tsconfig.json            # TypeScript configuration
├── tailwind.config.ts       # Tailwind configuration
└── vite.config.ts           # Vite configuration
```

## 🧪 Testing & Quality

This project follows Test-Driven Development (TDD) practices. See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed TDD guidelines.

### Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm test` | Run tests once |
| `pnpm test:watch` | Run tests in watch mode (TDD mode) |
| `pnpm test:coverage` | Run tests with coverage report |
| `pnpm lint` | Check code quality with ESLint |
| `pnpm lint:fix` | Auto-fix linting issues |
| `pnpm typecheck` | Validate TypeScript types |
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm preview` | Preview production build |

### TDD Workflow

We follow the **Red-Green-Refactor** cycle:

1. **🔴 Red**: Write a failing test first
2. **🟢 Green**: Write minimal code to pass the test
3. **♻️ Refactor**: Improve code while keeping tests green

```bash
# Start TDD mode (tests re-run on file changes)
pnpm test:watch

# Check coverage thresholds (80% minimum)
pnpm test:coverage
```

### Quality Gates

All code must pass:

- ✅ All tests passing
- ✅ 80%+ code coverage
- ✅ No linting errors
- ✅ No TypeScript errors
- ✅ Build succeeds

These checks run automatically in CI on every pull request.

## 🚢 Deployment

The application can be deployed to any platform that supports Node.js applications:

- **Vercel** (recommended for TanStack Start)
- **Cloudflare Workers**
- **Netlify**
- **Railway**

Convex automatically deploys when you push to production.

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Contact

Alex Robinett - [@alexrobinett](https://github.com/alexrobinett)

Project Link: [https://github.com/alexrobinett/agent-dashboard](https://github.com/alexrobinett/agent-dashboard)
