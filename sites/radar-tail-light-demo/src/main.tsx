import { createRoot } from "react-dom/client";
import { radarTailLightPack } from "../categories/radar-tail-light";
import "./globals.css";
import HomePage from "./page";

const container = document.getElementById("root");
if (!container) {
  throw new Error("缺少 #root 挂载节点");
}

createRoot(container).render(<HomePage pack={radarTailLightPack} />);
