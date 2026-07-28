import "./styles.css";
import { App } from "./app/App";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("WildSpell could not find its application root.");
new App(root).mount();
