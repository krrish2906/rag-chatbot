import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { Toaster } from "react-hot-toast";

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <Toaster
      position="top-center"
      toastOptions={{
        style: {
          background: "#18181b",
          color: "#fafafa",
          border: "1px solid #3f3f46",
          textAlign: "center",
        },
      }}
    />
  </StrictMode>,
)
