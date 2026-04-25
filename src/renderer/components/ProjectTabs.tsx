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
          // Salvar antes de fechar
          setActiveTab(id);
          setActiveProject(id);

          // Criar uma Promise que aguarda o evento de finalização do salvamento
          const savePromise = new Promise<boolean>((resolve) => {
            const listener = (e: any) => {
              window.removeEventListener("forge:save-project-finished", listener);
              resolve(e.detail.success);
            };
            window.addEventListener("forge:save-project-finished", listener);
            // Time-out de segurança caso o salvamento falhe bizarramente
            setTimeout(() => {
              window.removeEventListener("forge:save-project-finished", listener);
              resolve(false);
            }, 10000);
          });

          window.dispatchEvent(new CustomEvent("forge:save-project"));

          const saved = await savePromise;
          if (!saved) {
            // Se o salvamento falhou ou foi cancelado, talvez não devêssemos fechar
            // Para manter a segurança, vamos apenas parar por aqui
            return;
          }
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
          className={`flex items-center px-3 pe-[5px] h-[30px] rounded-t-[4px] cursor-pointer text-[0.8rem] gap-2 min-w-[150px] justify-between flex-shrink-0 transition-all border-b ${
            activeTab === project.id
              ? "bg-bg-primary text-text border-accent active:!translate-y-0 active:!filter-none"
              : "bg-transparent text-[#666] hover:bg-white/5 border-transparent"
          }`}
          onClick={() => handleTabClick(project.id)}
        >
          <span className="overflow-hidden text-ellipsis whitespace-nowrap">
            {project.name}.ocfd
          </span>
          <div
            tabIndex={-1}
            className="group relative bg-none border-none text-inherit flex p-[4px] rounded-[2px] cursor-pointer hover:bg-white/10 transition-colors w-[20px] h-[20px] items-center justify-center"
            onClick={(e) => handleCloseTab(e, project.id)}
          >
            {project.isDirty ? (
              <>
                <div className="w-[10px] h-[10px] bg-white rounded-full group-hover:opacity-0 transition-opacity" />
                <X
                  size={14}
                  className="absolute inset-0 m-auto opacity-0 group-hover:opacity-100 transition-opacity"
                />
              </>
            ) : (
              <X size={14} />
            )}
          </div>
        </button>
      ))}
    </div>
  );
};

export default ProjectTabs;
