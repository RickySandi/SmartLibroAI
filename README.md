# SmartLibro AI

An AI-powered web application for intelligent book summaries. Built with Angular 20, Firebase, TailwindCSS, and OpenAI integration.

## ✨ Features

- 🔐 **User Authentication**: Email/password login with Firebase Auth
- 📚 **ISBN Validation**: Support for ISBN-10 and ISBN-13 with real-time validation
- 🤖 **AI-Powered Summaries**: Generate intelligent book summaries using OpenAI GPT
- 📊 **Confidence Metrics**: AI-driven confidence scoring with detailed reasoning
- 📖 **User Library**: Save, search, sort, and manage your book summaries
- 🔍 **Source Attribution**: Track and display sources used for summary generation
- 📱 **Responsive Design**: Modern UI built with TailwindCSS
- ☁️ **Cloud Functions**: Secure server-side AI processing

## 🛠️ Tech Stack

- **Frontend**: Angular 20, TypeScript, TailwindCSS
- **Backend**: Firebase (Auth, Firestore, Hosting, Functions)
- **AI Integration**: OpenAI GPT-3.5/GPT-4
- **APIs**: Google Books API
- **Build Tools**: Angular CLI, Firebase CLI

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Angular CLI (`npm install -g @angular/cli`)
- Firebase CLI (`npm install -g firebase-tools`)
- OpenAI API Key

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/yourusername/smartlibroai.git
cd smartlibroai
```

2. **Install dependencies:**
```bash
npm install
cd functions && npm install && cd ..
```

3. **Environment Configuration:**
   
Copy the environment templates and update with your credentials:

```bash
cp src/environments/environment.template.ts src/environments/environment.ts
cp src/environments/environment.prod.template.ts src/environments/environment.prod.ts
```

Update `src/environments/environment.ts`:
```typescript
export const environment = {
    production: false,
    firebaseConfig: {
        apiKey: "YOUR_FIREBASE_API_KEY",
        authDomain: "your-project-id.firebaseapp.com",
        projectId: "your-project-id",
        storageBucket: "your-project-id.firebasestorage.app",
        messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
        appId: "YOUR_FIREBASE_APP_ID",
        measurementId: "YOUR_MEASUREMENT_ID"
    },
    openai: {
        apiKey: "YOUR_OPENAI_API_KEY"
    },
    firebase: {
        functionsBaseUrl: "https://your-cloud-function-url.run.app"
    },
    useCloudFunctions: true
};
```

4. **Start development server:**
```bash
ng serve
```

Navigate to `http://localhost:4200/`


To dive into the project, visit: `https://medium.com/@rickysandis/building-smartlibroai-how-advanced-confidence-metrics-transform-ai-book-summaries-99e8cd00b7dd`

Try it yourself: `https://smartlibroai.web.app/`

