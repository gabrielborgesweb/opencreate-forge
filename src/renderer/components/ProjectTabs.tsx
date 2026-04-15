import React from "react";
import { useProjectStore } from "@store/projectStore";
import { useUIStore } from "@store/uiStore";
import { Home, X } from "lucide-react";

const ProjectTabs: React.FC = () => {
  const { projects, removeProject, setActiveProject } = useProjectStore();
  const { activeTab, setActiveTab } = useUIStore();

  const handleTabClick = (id: "home" | string) => {
    setActiveTab(id);
    if (id !== "home") {
      setActiveProject(id);
    }
  };

  const handleCloseTab = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const project = projects.find((p) => p.id === id);
    if (!project) return;

    if (project.isDirty) {
      // @ts-expect-error - Electron API
      const result = await window.electronAPI.confirmClose(project.name);
      if (result === 2) return; // Cancel
      if (result === 0) {
        // TODO: Implement Save before closing
        console.log("Saving project before close...");
      }
    }

    removeProject(id);
    if (activeTab === id) {
      setActiveTab("home");
    }
  };

  return (
    <div className="flex bg-[#111] h-[35px] border-b border-bg-tertiary px-[5px] items-end overflow-x-auto">
      <button
        onClick={() => handleTabClick("home")}
        className={`flex items-center px-[15px] h-[30px] border-none rounded-t-[4px] cursor-pointer text-[0.8rem] gap-2 flex-shrink-0 transition-colors ${
          activeTab === "home"
            ? "bg-[#222] text-[#eee]"
            : "bg-transparent text-[#666] hover:bg-white/5"
        }`}
      >
        <Home size={14} />
      </button>

      {projects.map((project) => (
        <div
          key={project.id}
          onClick={() => handleTabClick(project.id)}
          className={`flex items-center px-3 h-[30px] rounded-t-[4px] cursor-pointer text-[0.8rem] gap-2 border-r border-[#222] min-w-[150px] justify-between flex-shrink-0 transition-colors ${
            activeTab === project.id
              ? "bg-bg-primary text-[#eee]"
              : "bg-transparent text-[#666] hover:bg-white/5"
          }`}
        >
          <span className="overflow-hidden text-ellipsis whitespace-nowrap">
            {project.name}
            {project.isDirty ? "*" : ""}.ocfd
          </span>
          <button
            onClick={(e) => handleCloseTab(e, project.id)}
            className="bg-none border-none text-inherit flex p-[2px] rounded-[2px] cursor-pointer hover:bg-white/10 transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default ProjectTabs;
