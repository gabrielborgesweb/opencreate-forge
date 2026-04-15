import React, { useState } from "react";
import { Plus, FolderOpen } from "lucide-react";
import NewProjectModal from "./NewProjectModal";

const HomeScreen: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-bg-primary text-[#eee] gap-8">
      <div className="text-center">
        <h2 className="text-[2rem] mb-2 font-bold">
          OpenCreate <span className="text-accent">Forge</span>
        </h2>
        <p className="text-[#888]">
          Modern Image Editor powered by React & Electron
        </p>
      </div>

      <div className="flex gap-6">
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex flex-col items-center gap-4 p-8 bg-[#252525] border border-bg-tertiary rounded-lg cursor-pointer w-40 transition-all hover:border-accent hover:-translate-y-1"
        >
          <Plus size={32} className="text-accent" />
          <span className="text-[0.9rem] font-medium">New Project</span>
        </button>

        <button className="flex flex-col items-center gap-4 p-8 bg-[#252525] border border-bg-tertiary rounded-lg cursor-pointer w-40 transition-all hover:border-accent hover:-translate-y-1">
          <FolderOpen size={32} className="text-accent" />
          <span className="text-[0.9rem] font-medium">Open Project</span>
        </button>
      </div>

      <NewProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
};

export default HomeScreen;
