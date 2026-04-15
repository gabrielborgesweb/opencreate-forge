import React, { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

interface ToolSettingInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  displayMultiplier?: number; // Ex: 100 para porcentagem (valor interno 1.0 -> 100 na UI)
}

const ToolSettingInput: React.FC<ToolSettingInputProps> = ({
  label,
  value,
  onChange,
  min = 0,
  max = 500,
  step = 1,
  unit = "",
  displayMultiplier = 1,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startValue = useRef(0);

  // Valor convertido para exibição (ex: 0.5 * 100 = 50)
  const displayValue = Math.round(value * displayMultiplier);

  const clampAndSave = (newValue: number) => {
    const clamped = Math.min(max, Math.max(min, newValue));
    onChange(clamped);
  };

  // Lógica de Scrubbing (arrastar no label)
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    startX.current = e.clientX;
    startValue.current = value;
    document.body.style.cursor = "col-resize";

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = moveEvent.clientX - startX.current;
      // Sensibilidade: 1px de movimento = 1 unidade da UI (ajustado pelo multiplicador)
      const sensitivity = 1 / displayMultiplier;
      const newValue = startValue.current + delta * sensitivity;
      clampAndSave(newValue);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "default";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Lógica de Scroll
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const direction = e.deltaY > 0 ? -1 : 1;
    const delta = (direction * step) / displayMultiplier;
    clampAndSave(value + delta);
  };

  // Fechar o slider ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div
      className="relative flex items-center gap-2"
      ref={containerRef}
      onWheel={handleWheel}
    >
      <label
        className="text-[0.75rem] text-[#999] cursor-col-resize select-none font-medium hover:text-white transition-colors"
        onMouseDown={handleMouseDown}
      >
        {label}
      </label>

      <div
        className="flex items-center gap-1 bg-[#1a1a1a] border border-[#333] hover:border-accent/50 px-1.5 py-0.5 rounded transition-all cursor-pointer group"
        onClick={() => setIsOpen(!isOpen)}
      >
        <input
          type="number"
          value={displayValue}
          onChange={(e) => {
            const val = parseInt(e.target.value) || 0;
            onChange(val / displayMultiplier);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") setIsOpen(false);
          }}
          onClick={(e) => e.stopPropagation()}
          className="bg-transparent border-none text-[0.75rem] w-8 text-center outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-white font-medium"
        />
        <span className="text-[0.65rem] text-[#666] select-none font-bold">
          {unit}
        </span>
        <ChevronDown
          size={12}
          className={`text-[#666] group-hover:text-accent transition-transform duration-200 ${isOpen ? "rotate-180 text-accent" : ""}`}
        />
      </div>

      {isOpen && (
        <div
          className="absolute top-[calc(100%+8px)] left-[-20px] z-50 bg-[#1a1a1a] border border-[#333] p-3 rounded shadow-2xl min-w-[160px] animate-in fade-in slide-in-from-top-2 duration-200"
          onWheel={(e) => e.stopPropagation()} // Permite que o wheel do container pai funcione ou capture aqui
        >
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-[0.65rem] text-[#666] uppercase font-bold px-0.5">
              <span>
                {Math.round(min * displayMultiplier)}
                {unit}
              </span>
              <span>
                {Math.round(max * displayMultiplier)}
                {unit}
              </span>
            </div>
            <input
              type="range"
              min={min * displayMultiplier}
              max={max * displayMultiplier}
              step={step}
              value={displayValue}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                onChange(val / displayMultiplier);
              }}
              className="w-full h-1.5 bg-[#333] rounded-lg appearance-none cursor-pointer accent-accent"
            />
          </div>
          {/* Seta do triângulo para o popup */}
          <div className="absolute top-[-5px] left-[40px] w-2 h-2 bg-[#1a1a1a] border-t border-l border-[#333] rotate-45" />
        </div>
      )}
    </div>
  );
};

export default ToolSettingInput;
