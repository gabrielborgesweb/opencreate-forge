/**
 * Purpose: Shared UI utility components for displaying keyboard shortcuts and key spans throughout the application.
 */
import React from "react";

export const KeySpan: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="inline-flex items-center justify-center border border-b-2 border-[#555] p-0.75 px-1 min-w-[1.2rem] text-[.75rem] text-[#777] font-bold rounded leading-none">
    {children}
  </span>
);

// <ShortcutSpan shortcut="Ctrl+N" macos={true} />
export const ShortcutSpan: React.FC<{ shortcut: string; macos?: boolean }> = ({
  shortcut,
  macos,
}) => {
  const parts = shortcut.split("+").map((part) => part.trim());

  return (
    <span className="inline-flex items-center gap-1">
      {parts.map((part, index) => {
        const displayPart = macos
          ? part
              .replace("Ctrl", "⌘")
              .replace("Alt", "⌥")
              .replace("Shift", "⇧")
              .replace("Enter", "⏎")
          : part;
        return (
          <React.Fragment key={index}>
            <KeySpan>{displayPart}</KeySpan>
            {index < parts.length - 1 && <span className="text-[#777]">+</span>}
          </React.Fragment>
        );
      })}
    </span>
  );
};
