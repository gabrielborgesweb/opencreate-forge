import React, { useEffect, useState, useRef } from "react";
import { X, LucideIcon } from "lucide-react";

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: LucideIcon;
  width?: string;
  height?: string;
  children: React.ReactNode;
  trapFocusSelector?: string;
}

const BaseModal: React.FC<BaseModalProps> = ({
  isOpen,
  onClose,
  title,
  icon: Icon,
  width = "900px",
  height = "600px",
  children,
  trapFocusSelector,
}) => {
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // --- Sincronização de Estado durante o Render ---

  // 1. Se abriu via prop, garante que o componente seja montado no DOM
  if (isOpen && !isRendered) {
    setIsRendered(true);
  }

  // 2. Se fechou via prop, dispara a animação de saída (fadeOut/slideDown)
  // Mantemos isRendered como true para que o elemento continue existindo durante a transição
  if (!isOpen && isVisible) {
    setIsVisible(false);
  }

  useEffect(() => {
    if (isOpen) {
      // Dispara a animação de entrada logo após a montagem
      const timer = setTimeout(() => setIsVisible(true), 10);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Esta função é a chave para o FadeOut: ela remove o modal do DOM
  // SOMENTE após as transições de CSS terminarem.
  const handleTransitionEnd = (e: React.TransitionEvent) => {
    // Garantimos que a transição que terminou foi no container principal (ex: opacity)
    if (e.target === e.currentTarget && !isOpen && !isVisible) {
      setIsRendered(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }

      if (e.key === "Tab" && modalRef.current) {
        const container = trapFocusSelector
          ? modalRef.current.querySelector(trapFocusSelector) || modalRef.current
          : modalRef.current;

        const focusableElements = container.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, trapFocusSelector]);

  if (!isRendered) return null;

  return (
    <div
      className={`fixed inset-0 bg-black/30 flex items-center justify-center z-[1000] transition-opacity duration-300 ease-in-out ${
        isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      onTransitionEnd={handleTransitionEnd}
    >
      <div
        ref={modalRef}
        style={{ width, height }}
        className={`bg-[#252525] rounded-lg border border-border overflow-hidden flex flex-col shadow-2xl transition-all duration-300 transform ${
          isVisible
            ? "opacity-100 translate-y-0 ease-out"
            : "opacity-0 translate-y-8 ease-in pointer-events-none"
        }`}
      >
        {/* Header */}
        <div className="p-1 border-b border-bg-tertiary flex justify-between items-center">
          <h2 className="text-sm font-bold ml-1 flex items-center gap-2 text-text">
            {Icon && <Icon size={16} className="text-accent" />} {title}
          </h2>
          <button
            onClick={onClose}
            className="bg-none border-none text-inherit flex p-1 rounded cursor-pointer hover:bg-white/10 focus-visible:ring-1 focus-visible:ring-accent outline-none transition-colors items-center justify-center"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
};

export default BaseModal;
