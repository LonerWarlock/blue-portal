declare module "blue-desktop-renderer" {
  const App: import("react").ComponentType;
  export default App;
}
declare module "blue-desktop-styles";
// This standalone demo uses Desktop's installed ReactDOM renderer at build time.
declare module "react-dom/client" {
  export function createRoot(container: Element): { render(node: import("react").ReactNode): void };
}
