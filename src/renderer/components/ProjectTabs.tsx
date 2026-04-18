import React from "react";
import { useProjectStore } from "@store/projectStore";
import { useUIStore } from "@store/uiStore";
import { Home, X } from "lucide-react";

const ProjectTabs: React.FC = () => {
  const { projects, removeProject, setActiveProject } = useProjectStore();
  const { activeTab, setActiveTab, tabHistory, removeFromHistory } = useUIStore();

  const handleTabClick = (id: "home" | string) => {
    setActiveTab(id);
    if (id !== "home") {
      setActiveProject(id);
    }
  };

  const handleCloseTab = React.useCallback(
    async (e: React.MouseEvent | null, id: string) => {
      e?.stopPropagation();
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

      removeFromHistory(id);
      removeProject(id);

      if (activeTab === id) {
        // Get the next best tab from history
        const newHistory = tabHistory.filter((tid) => tid !== id);
        const lastTab = newHistory[newHistory.length - 1] || "home";
        setActiveTab(lastTab);
        if (lastTab !== "home") {
          setActiveProject(lastTab);
        }
      }
    },
    [
      projects,
      removeFromHistory,
      removeProject,
      activeTab,
      tabHistory,
      setActiveTab,
      setActiveProject,
    ],
  );

  React.useEffect(() => {
    const handleCloseActive = () => {
      if (activeTab !== "home") {
        handleCloseTab(null, activeTab);
      }
    };
    window.addEventListener("forge:close-project", handleCloseActive);
    return () => window.removeEventListener("forge:close-project", handleCloseActive);
  }, [activeTab, handleCloseTab]);

  return (
    <div className="flex bg-[#111] h-[35px] border-b border-bg-tertiary px-[5px] items-end overflow-x-auto gap-1">
      <button
        onClick={() => handleTabClick("home")}
        tabIndex={-1}
        className={`flex items-center px-2 h-[30px] border-none rounded-t-[4px] cursor-pointer text-[0.8rem] flex-shrink-0 transition-colors ${
          activeTab === "home"
            ? "bg-[#222] text-accent"
            : "bg-transparent text-[#666] hover:bg-white/5"
        }`}
      >
        <Home size={14} />
      </button>

      {projects.map((project) => (
        <button
          key={project.id}
          className={`flex items-center px-3 h-[30px] rounded-t-[4px] cursor-pointer text-[0.8rem] gap-2 min-w-[150px] justify-between flex-shrink-0 transition-all border-b ${
            activeTab === project.id
              ? "bg-bg-primary text-text border-accent"
              : "bg-transparent text-[#666] hover:bg-white/5 border-transparent"
          }`}
          onClick={() => handleTabClick(project.id)}
        >
          <span className="overflow-hidden text-ellipsis whitespace-nowrap">
            {project.name}
            {project.isDirty ? "*" : ""}.ocfd
          </span>
          <div
            tabIndex={-1}
            className="bg-none border-none text-inherit flex p-[2px] rounded-[2px] cursor-pointer hover:bg-white/10 transition-colors"
            onClick={(e) => handleCloseTab(e, project.id)}
          >
            <X size={12} />
          </div>
        </button>
      ))}
    </div>
  );
};

export default ProjectTabs;
