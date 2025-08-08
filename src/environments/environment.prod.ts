export const environment = {
    production: true,
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


