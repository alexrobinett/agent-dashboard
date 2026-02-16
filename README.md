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

# Better Auth
AUTH_SECRET=your-secret-key
GITHUB_CLIENT_ID=your-github-oauth-client-id
GITHUB_CLIENT_SECRET=your-github-oauth-client-secret

# App URL
PUBLIC_APP_URL=http://localhost:3000
```

4. **Run the development server**

```bash
# Start Convex dev server
pnpm convex:dev

# In another terminal, start the app
pnpm dev
```

5. **Open your browser**

Navigate to [http://localhost:3000](http://localhost:3000)

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

## 🧪 Testing

```bash
# Run unit tests
pnpm test

# Run E2E tests
pnpm test:e2e
```

## 🏗️ Build

```bash
# Build for production
pnpm build

# Preview production build
pnpm preview
```

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
