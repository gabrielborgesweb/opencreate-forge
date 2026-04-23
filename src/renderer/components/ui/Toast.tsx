import React, { useEffect, useState, useRef } from "react";
import { useUIStore } from "../../store/uiStore";
import { TriangleAlert, Info, AlertCircle } from "lucide-react";

const Toast: React.FC = () => {
  const toast = useUIStore((state) => state.toast);
  const hideToast = useUIStore((state) => state.hideToast);
  const [isHovered, setIsHovered] = useState(false);

  const startTimeRef = useRef<number>(0);
  const animationRef = useRef<number | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Utility to reset the bar visually
    const resetBar = () => {
      if (progressBarRef.current) {
        progressBarRef.current.style.transform = "scaleX(0)";
      }
    };

    if (!toast || !toast.visible) {
      resetBar();
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    if (isHovered) {
      resetBar();
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    const duration = toast.duration || 3000;
    startTimeRef.current = Date.now();

    const updateProgress = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      if (progressBarRef.current) {
        progressBarRef.current.style.transform = `scaleX(${progress})`;
      }

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(updateProgress);
      } else {
        hideToast();
      }
    };

    animationRef.current = requestAnimationFrame(updateProgress);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [toast, hideToast, isHovered]);

  if (!toast) return null;

  return (
    <div
      className={`fixed top-24 left-1/2 z-[9999] p-3 rounded-lg flex flex-col gap-1 min-w-[200px] overflow-hidden ${
        toast.visible ? "animate-bounce-in" : "animate-fade-out"
      } ${
        toast.type === "warning"
          ? "bg-orange-600/95 text-white"
          : toast.type === "error"
            ? "bg-red-600/95 text-white"
            : "bg-blue-600/95 text-white"
      }`}
      style={{ pointerEvents: toast.visible ? "auto" : "none" }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center gap-2 pr-2">
        {toast.type === "warning" && <TriangleAlert size={18} className="text-orange-200" />}
        {toast.type === "error" && <AlertCircle size={18} className="text-red-200" />}
        {toast.type === "info" && <Info size={18} className="text-blue-200" />}
        <span
          className="text-sm whitespace-nowrap [&_b]:font-bold [&_a]:underline [&_a]:text-white/80 [&_a:hover]:text-white"
          dangerouslySetInnerHTML={{ __html: toast.message }}
        />
      </div>

      {/* Progress Bar Container */}
      <div className="absolute bottom-0 left-0 h-[3px] bg-black/20 w-full">
        <div
          ref={progressBarRef}
          className="h-full bg-white origin-left will-change-transform"
          style={{ transform: "scaleX(0)" }}
        />
      </div>
    </div>
  );
};

export default Toast;
