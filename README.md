<p align="center">
  <img src="client/public/images/hero-dashboard.jpg" alt="OneStudios Banner" width="100%" />
</p>

<h1 align="center">🎬 OneStudios</h1>

<p align="center">
  <strong>A full-stack, production-grade video conferencing platform built from scratch.</strong><br/>
  Real-time 1:1 & group calls · AI meeting intelligence · end-to-end encryption · collaborative whiteboard & more.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white" alt="Vite 6" />
  <img src="https://img.shields.io/badge/React_Router-7-CA4245?logo=reactrouter&logoColor=white" alt="React Router" />
  <img src="https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/WebRTC-P2P%20%26%20SFU-FF6600?logo=webrtc&logoColor=white" alt="WebRTC" />
  <img src="https://img.shields.io/badge/mediasoup-SFU-6C3483?logoColor=white" alt="mediasoup" />
  <img src="https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Gemini_AI-2.0_Flash-4285F4?logo=google&logoColor=white" alt="Gemini AI" />
</p>

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Tech Stack](#️-tech-stack)
- [Architecture](#️-architecture)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [API Reference](#-api-reference)
- [WebSocket Protocol](#-websocket-protocol)
- [Database Schema](#️-database-schema)
- [Roadmap](#-roadmap--upcoming-features)
- [License](#-license)

---

## 🌟 Overview

**OneStudios** is a full-featured, real-time video conferencing platform designed and built entirely from the ground up—no third-party Video SDKs like Twilio or Agora. It leverages **native WebRTC** for peer-to-peer 1:1 calls and **mediasoup SFU** for scalable group calls, orchestrated through a custom Node.js Express & WebSocket signaling server.

The frontend is a lightweight, ultra-fast **React 19 Single Page Application (SPA)** powered by **Vite 6** and **React Router 7**.

Key Capabilities:

- 🔒 **True end-to-end encryption** via Web Crypto API (ECDH + AES-GCM)
- 🤖 **AI-powered meeting intelligence** using Google Gemini 2.0 Flash
- 🎨 **Virtual backgrounds** with real-time ML segmentation (MediaPipe)
- 📹 **Canvas-composite recording** capturing all participants in a single video locally
- ✏️ **Collaborative Whiteboard** & real-time WebSocket canvas synchronization

---

## ✨ Key Features

### 📞 Video Calling
| Feature | Description |
|---------|-------------|
| **1:1 Peer-to-Peer Calls** | Direct WebRTC connections with STUN/TURN relay fallback for NAT traversal |
| **Group Calls (SFU)** | Scalable N-peer calls via mediasoup Selective Forwarding Unit — up to 10+ participants |
| **Screen Sharing** | Share your entire screen or specific windows with real-time stream switching |
| **Adaptive Bitrate** | ICE candidate pool optimization and automatic quality adjustment |

### 🎥 Local Recording & P2P Transfer

> **⭐ Headline Feature** — Recording runs 100% locally in the browser. No media ever touches the server.

| Feature | Description |
|---------|-------------|
| **Canvas-Composite Recording** | All participant video streams are drawn onto a single `<canvas>` in a computed grid layout, combined with mixed audio via `AudioContext`, and captured as a single high-quality WebM file |
| **P2P Recording Transfer** | Finished recordings are sent directly to other participants over `RTCDataChannel` — chunked into 128 KB pieces with backpressure handling |
| **Zero-Server Architecture** | `MediaRecorder` + `CanvasCaptureStream` + `RTCDataChannel` — the entire pipeline runs client-side |

### 🤖 AI Meeting Intelligence (Gemini 2.0 Flash)
| Feature | Description |
|---------|-------------|
| **Smart Reply Suggestions** | AI analyzes the live transcript and suggests 3 contextual response options in real time |
| **Meeting Summary Generation** | One-click post-meeting summary with key points, action items, and decisions extracted |

### 🔐 Security & Encryption
| Feature | Description |
|---------|-------------|
| **End-to-End Encryption (E2EE)** | ECDH key exchange → AES-256-GCM encryption; messages are encrypted before leaving the device |
| **JWT Authentication** | Access + Refresh token rotation with httpOnly cookies |
| **OAuth 2.0** | One-click login with **Google** and **Discord** via Passport.js strategies |
| **Bcrypt Password Hashing** | Salted bcrypt hashing for email/password accounts |

### 💬 Real-Time Collaboration
| Feature | Description |
|---------|-------------|
| **In-Call Chat** | Full-featured chat panel with emoji picker, image sharing, and AI suggestions |
| **Collaborative Whiteboard** | Real-time drawing canvas synced across all peers via WebSocket |
| **Floating Emoji Reactions** | Animated emoji reactions (👏 🎉 ❤️ 😂 🔥 👍) floating across participants' screens |

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 19** | Modern UI library for fast, component-driven interfaces |
| **Vite 6** | Ultra-fast build tool with instantaneous HMR development server |
| **React Router 7** | Client-side routing for Single Page Application |
| **TypeScript 5** | Type safety across the entire client codebase |
| **Tailwind CSS 4** | Utility-first design system |
| **Radix UI** | Accessible primitives (Dialog, Dropdown, Tabs, etc.) |
| **mediasoup-client** | Client-side SFU integration for group video calls |
| **MediaPipe** | Client-side ML model for real-time selfie segmentation & virtual background |
| **Web Speech API** | Browser-native speech-to-text for live captions |
| **Web Crypto API** | ECDH + AES-GCM for end-to-end encryption |
| **Recharts** | Dashboard meeting analytics charts |

### Backend
| Technology | Purpose |
|------------|---------|
| **Express 5** | HTTP REST server for auth, rooms, and AI routes |
| **TypeScript + tsx** | Hot-reload development with `tsx watch` |
| **WebSocket (ws)** | Custom real-time signaling server for WebRTC & collaboration |
| **mediasoup 3** | C++ SFU for scalable multi-party video streams |
| **Prisma 7** | Type-safe ORM with PostgreSQL adapter |
| **Neon PostgreSQL** | Serverless cloud PostgreSQL database |
| **Passport.js** | Google & Discord OAuth strategies |
| **Google Gemini AI** | AI smart replies and structured meeting summaries |

---

## 🏛️ Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                          CLIENTS                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │ Browser 1│  │ Browser 2│  │ Browser 3│  │ Browser N│         │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘         │
│       └──────────────┼──────────────┼──────────────┘              │
└──────────────────────┼──────────────┼──────────────────────────────┘
                       │              │
            ┌──────────▼──────────────▼──────────┐
            │        REACT 19 + VITE SPA         │
            │          (Port :3000)              │
            │                                     │
            │  • React Router SPA Routing         │
            │  • WebRTC hooks (P2P + SFU)         │
            │  • Virtual Backgrounds (MediaPipe)  │
            │  • E2E Encryption (Web Crypto)      │
            │  • Live Transcription (Speech API)  │
            └──────────────┬──────────────────────┘
                           │
              REST API ────┤──── WebSocket
                           │
            ┌──────────────▼──────────────────────┐
            │        EXPRESS BACKEND              │
            │          (Port :5000)               │
            │                                     │
            │  • Auth Layer (JWT + OAuth 2.0)     │
            │  • Room CRUD & Analytics            │
            │  • WebSocket Signaling Server       │
            │  • mediasoup SFU Worker & Router    │
            │  • Google Gemini AI Integration     │
            └──────────────┬──────────────────────┘
                           │
            ┌──────────────▼──────────────────────┐
            │     NEON POSTGRESQL (Cloud)          │
            └─────────────────────────────────────┘
```

---

## 📁 Project Structure

```
OneStudios/
├── client/                          # React 19 + Vite Frontend (SPA)
│   ├── src/
│   │   ├── pages/                   # Page Components
│   │   │   ├── HomePage.tsx         # Landing page & feature overview
│   │   │   ├── DashboardPage.tsx    # Analytics & meeting history
│   │   │   ├── CallPage.tsx         # 1:1 WebRTC call page
│   │   │   ├── GroupCallPage.tsx    # Group SFU call page (mediasoup)
│   │   │   ├── JoinByInvitePage.tsx # Invite link handler
│   │   │   └── auth/                # Login, Register, Callback pages
│   │   ├── components/              # UI Components (VideoPlayer, Chat, Whiteboard, etc.)
│   │   ├── hooks/                   # Custom Hooks (useWebRTC, useGroupWebRTC, useVirtualBackground, etc.)
│   │   ├── lib/                     # API helper client
│   │   ├── App.tsx                  # React Router Root & ThemeProvider
│   │   ├── main.tsx                 # Vite SPA Entry Point
│   │   └── globals.css              # Global Tailwind CSS tokens
│   ├── index.html                   # SPA HTML Root
│   ├── vite.config.ts               # Vite configuration
│   └── package.json
│
├── backend/                         # Express 5 Backend
│   ├── src/
│   │   ├── index.ts                 # Server bootstrap + WebSocket server
│   │   ├── app.ts                   # Express app (middleware, routes, rate limiting)
│   │   ├── controllers/             # Auth, Room, and AI controllers
│   │   ├── realtime/                # WebSocket router, WebRTC & mediasoup SFU handlers
│   │   ├── middleware/              # JWT auth verification middleware
│   │   └── lib/                     # Prisma client, Passport OAuth, JWT helpers
│   ├── prisma/                      # Database schema & migrations
│   └── package.json
│
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 20 (LTS recommended)
- **npm** ≥ 10
- **PostgreSQL** — or use [Neon](https://neon.tech) (free tier, no local DB needed)

### 1. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env

# Generate Prisma client and run migrations
npx prisma generate
npx prisma migrate deploy

# Start Express development server
npm run dev
```
*Backend runs on `http://localhost:5000`.*

### 2. Frontend Setup

```bash
cd client

# Install dependencies
npm install

# Start Vite development server
npm run dev
```
*Frontend runs on `http://localhost:3000`.*

---

## 🔑 Environment Variables

Create a `.env` file in the `backend/` directory:

```env
# Database (Neon PostgreSQL)
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"

# JWT Secrets
JWT_SECRET="your-jwt-secret"
ACCESS_TOKEN_SECRET="your-access-token-secret"
REFRESH_TOKEN_SECRET="your-refresh-token-secret"

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:5000/auth/google/callback

# Google Gemini AI (Optional - get free key at https://aistudio.google.com/apikey)
GEMINI_API_KEY=your-gemini-api-key

# Server Config
PORT=5000
CLIENT_URL=http://localhost:3000
```

---

## 📄 License

This project is open source and available under the [ISC License](LICENSE).

<p align="center">
  Built with ❤️ by <strong>Arbab Rizvi</strong>
</p>
