import {
  MousePointer2,
  SquareDashed,
  Brush,
  Pencil,
  Eraser,
  Type,
  LucideIcon,
} from "lucide-react";
import { ToolId } from "@store/toolStore";

export interface ToolDefinition {
  id: ToolId;
  icon: LucideIcon;
  label: string;
  name: string;
}

export const TOOLS: ToolDefinition[] = [
  { id: "move", icon: MousePointer2, label: "Move (V)", name: "Move" },
  { id: "select", icon: SquareDashed, label: "Select (M)", name: "Select" },
  { id: "brush", icon: Brush, label: "Brush (B)", name: "Brush" },
  { id: "pencil", icon: Pencil, label: "Pencil (P)", name: "Pencil" },
  { id: "eraser", icon: Eraser, label: "Eraser (E)", name: "Eraser" },
  { id: "text", icon: Type, label: "Text (T)", name: "Text" },
];
