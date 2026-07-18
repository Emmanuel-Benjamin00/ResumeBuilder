import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from "react-toastify";
import "./styles/theme.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
    <ToastContainer position="bottom-right" autoClose={3000} theme="colored" />
  </StrictMode>
);
