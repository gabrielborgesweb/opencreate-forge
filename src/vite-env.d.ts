/**
 * Purpose: Vite environment type definitions and module declarations for assets like CSS.
 */
/// <reference types="vite/client" />

declare module "*.css" {
  const content: { [className: string]: string };
  export default content;
}
