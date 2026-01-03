import React, { useState } from 'react';
import { Folder, StudySession } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { FolderIcon, Plus, FileText, ChevronDown, Trash, X, Edit, CornerDownRight, GraduationCap, NeuroLogo, Search, Layers, BookOpen, Target, LogOut, User } from './Icons';
// ChevronRight agora é inline (SVG direto no JSX) para evitar problema de bundling

interface SidebarProps {
  folders: Folder[];
  studies: StudySession[];
  activeStudyId: string | null;
  onSelectStudy: (id: string) => void;
  onCreateFolder: (name: string, parentId?: string) => void;
  onRenameFolder: (id: string, newName: string) => void;
  onCreateStudy: (folderId: string, title: string) => void;
  onDeleteStudy: (id: string) => void;
  onDeleteFolder: (id: string) => void;
  onMoveFolder: (folderId: string, targetParentId: string | undefined) => void;
  onMoveStudy: (studyId: string, targetFolderId: string) => void;
  onOpenMethodology: () => void;
  onFolderExam: (folderId: string) => void;
  onRequestNewStudy: (folderId: string) => void;
  onGoToHome: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  folders,
  studies,
  activeStudyId,
  onSelectStudy,
  onCreateFolder,
  onRenameFolder,
  onCreateStudy,
  onDeleteStudy,
  onDeleteFolder,
  onMoveFolder,
  onMoveStudy,
  onOpenMethodology,
  onFolderExam,
  onRequestNewStudy,
  onGoToHome,
  isOpen = false,
  onClose
}) => {
  const { profile, signOut, isPro } = useAuth();
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const [creatingSubfolderIn, setCreatingSubfolderIn] = useState<string | null>(null);
  const [newSubfolderName, setNewSubfolderName] = useState('');

  const [creatingRootFolderIn, setCreatingRootFolderIn] = useState<string | null>(null);
  const [newRootFolderName, setNewRootFolderName] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Estado para seções recolhíveis (NeuroStudy, Biblioteca, Pareto)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'root-neuro': true,
    'root-books': true,
    'root-pareto': true
  });

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  // --- LÓGICA DE RECOLHER/EXPANDIR (CORRIGIDA) ---
  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  const startEditing = (folder: Folder) => {
    setEditingFolderId(folder.id);
    setEditName(folder.name);
  };

  const saveEdit = () => {
    if (editingFolderId && editName.trim()) {
      onRenameFolder(editingFolderId, editName);
    }
    setEditingFolderId(null);
  };

  const handleCreateFolder = (parentId: string) => {
    const name = parentId.startsWith('root-') ? newRootFolderName : newSubfolderName;
    if (name.trim()) {
      onCreateFolder(name, parentId);
      setNewSubfolderName('');
      setNewRootFolderName('');
      setCreatingSubfolderIn(null);
      setCreatingRootFolderIn(null);
      if (!parentId.startsWith('root-')) setExpandedFolders(prev => ({ ...prev, [parentId]: true }));
    }
  };



  // --- Drag Handlers ---
  const handleDragStart = (e: React.DragEvent, type: 'FOLDER' | 'STUDY', id: string) => {
    e.dataTransfer.setData('type', type);
    e.dataTransfer.setData('id', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, folderId?: string) => {
    e.preventDefault();
    if (folderId) setDragOverFolderId(folderId);
  };

  const handleDrop = (e: React.DragEvent, targetFolderId?: string) => {
    e.preventDefault();
    setDragOverFolderId(null);
    const type = e.dataTransfer.getData('type');
    const id = e.dataTransfer.getData('id');
    if (!type || !id) return;

    if (type === 'FOLDER') onMoveFolder(id, targetFolderId);
    else if (type === 'STUDY' && targetFolderId) onMoveStudy(id, targetFolderId);
  };

  // --- Render Tree ---
  const renderFolderTree = (parentId: string, depth: number = 0, themeColor: string) => {
    const currentLevelFolders = folders.filter(f => f.parentId === parentId);
    const currentLevelStudies = studies.filter(s => s.folderId === parentId);

    // Filtro de busca
    const filteredFolders = searchQuery ? currentLevelFolders.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase())) : currentLevelFolders;
    const filteredStudies = searchQuery ? currentLevelStudies.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase())) : currentLevelStudies;

    if (filteredFolders.length === 0 && filteredStudies.length === 0 && creatingSubfolderIn !== parentId) {
      return null;
    }

    return (
      <div className={`${depth === 0 ? 'mt-2 space-y-1' : 'ml-3 border-l border-gray-200 pl-1'}`}>
        {filteredFolders.map(folder => {
          const isOpen = expandedFolders[folder.id];
          const isDragOver = dragOverFolderId === folder.id;

          return (
            <div key={folder.id} className="select-none">
              <div
                draggable
                onDragStart={(e) => handleDragStart(e, 'FOLDER', folder.id)}
                onDragOver={(e) => handleDragOver(e, folder.id)}
                onDragLeave={() => setDragOverFolderId(null)}
                onDrop={(e) => handleDrop(e, folder.id)}
                className={`group flex items-center justify-between p-1.5 rounded-md cursor-pointer transition-colors ${editingFolderId === folder.id ? 'bg-white ring-2 ring-indigo-200' : isDragOver ? 'bg-indigo-100' : 'hover:bg-gray-100'}`}
                onClick={() => toggleFolder(folder.id)}
              >
                {editingFolderId === folder.id ? (
                  <input
                    autoFocus className="w-full text-xs p-1 border rounded"
                    value={editName} onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveEdit()} onBlur={saveEdit} onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-gray-700 overflow-hidden">
                      {isOpen ? <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" /> : <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 text-gray-400 shrink-0"><path d="m9 18 6-6-6-6" /></svg>}
                      <FolderIcon className={`w-4 h-4 shrink-0 ${themeColor}`} />
                      <span className="truncate max-w-[140px] text-sm">{folder.name}</span>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={(e) => { e.stopPropagation(); onFolderExam(folder.id); }} className="p-0.5 text-purple-600 hover:bg-purple-100 rounded" title="Provão: Gerar Simulado da Pasta"><GraduationCap className="w-3 h-3" /></button>
                      <button onClick={(e) => { e.stopPropagation(); startEditing(folder); }} className="p-0.5 text-gray-400 hover:text-indigo-600 rounded" title="Renomear"><Edit className="w-3 h-3" /></button>

                      {/* BOTÃO CRIAR SUBPASTA (+): Fecha o modo de estudo se estiver aberto */}
                      <button onClick={(e) => {
                        e.stopPropagation();
                        setCreatingSubfolderIn(folder.id);
                        setExpandedFolders(p => ({ ...p, [folder.id]: true }));
                      }} className="p-0.5 text-gray-400 hover:text-green-600 rounded" title="Nova Subpasta"><Plus className="w-3 h-3" /></button>

                      <button onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id); }} className="p-0.5 text-gray-400 hover:text-red-500 rounded" title="Excluir"><Trash className="w-3 h-3" /></button>
                    </div>
                  </>
                )}
              </div>

              {isOpen && (
                <div>
                  {/* INPUT PARA NOVA SUBPASTA */}
                  {creatingSubfolderIn === folder.id && (
                    <div className="flex items-center gap-2 p-1 ml-4 my-1 animate-in slide-in-from-left-2 duration-200">
                      <CornerDownRight className="w-3 h-3 text-gray-400" />
                      <input autoFocus placeholder="Nome da subpasta..." className="text-xs p-1 border rounded w-full focus:ring-1 focus:ring-green-500 outline-none bg-green-50"
                        value={newSubfolderName} onChange={e => setNewSubfolderName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleCreateFolder(folder.id)}
                      />
                      <button onClick={() => setCreatingSubfolderIn(null)}><X className="w-3 h-3 text-gray-400" /></button>
                    </div>
                  )}

                  {renderFolderTree(folder.id, depth + 1, themeColor)}

                  {/* Studies in this folder */}
                  {filteredStudies.map(study => (
                    <div key={study.id} draggable onDragStart={(e) => handleDragStart(e, 'STUDY', study.id)} onClick={() => onSelectStudy(study.id)} className={`ml-4 flex items-center justify-between px-2 py-1.5 rounded text-sm cursor-pointer border-l-2 transition-all ${activeStudyId === study.id ? `bg-white ${themeColor.replace('text-', 'text-').replace('fill-', 'border-')} font-medium shadow-sm` : 'border-transparent text-gray-600 hover:bg-gray-50'}`}>
                      <div className="flex items-center gap-2 truncate"><FileText className="w-3 h-3" /> <span className="truncate">{study.title}</span></div>
                      <button onClick={(e) => { e.stopPropagation(); onDeleteStudy(study.id); }} className="text-gray-300 hover:text-red-500"><Trash className="w-3 h-3" /></button>
                    </div>
                  ))}

                  {/* BOTÃO NOVO ESTUDO (Redireciona para Dashboard) */}
                  <div className="ml-4 mt-1">
                    <button onClick={(e) => {
                      e.stopPropagation();
                      onRequestNewStudy(folder.id);
                      onClose?.();
                    }} className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-indigo-600 px-1 py-1 w-full text-left transition-colors hover:bg-indigo-50 rounded">
                      <Plus className="w-3 h-3" /> Novo Estudo
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Studies at the root of this section (without folder) */}
        {filteredStudies.map(study => (
          <div key={study.id} draggable onDragStart={(e) => handleDragStart(e, 'STUDY', study.id)} onClick={() => onSelectStudy(study.id)} className={`mt-1 flex items-center justify-between px-2 py-1.5 rounded text-sm cursor-pointer border-l-2 transition-all ${activeStudyId === study.id ? `bg-white ${themeColor.replace('text-', 'text-').replace('fill-', 'border-')} font-medium shadow-sm` : 'border-transparent text-gray-600 hover:bg-gray-50'}`}>
            <div className="flex items-center gap-2 truncate"><FileText className="w-3 h-3" /> <span className="truncate">{study.title}</span></div>
            <button onClick={(e) => { e.stopPropagation(); onDeleteStudy(study.id); }} className="text-gray-300 hover:text-red-500"><Trash className="w-3 h-3" /></button>
          </div>
        ))}
      </div>
    );
  };

  const SectionHeader = ({ id, title, icon: Icon, colorClass, rootId }: any) => {
    const isExpanded = expandedSections[rootId] ?? true;
    const isCollapsed = !isOpen && !isHovered;

    return (
      <div className="mb-2">
        <div
          className={`flex items-center px-3 py-2 ${colorClass} bg-opacity-10 rounded-lg cursor-pointer hover:bg-opacity-20 transition-all ${isCollapsed ? 'md:justify-center md:px-2' : 'justify-between'}`}
          onClick={() => toggleSection(rootId)}
        >
          <div className={`flex items-center gap-2 font-bold text-sm ${isCollapsed ? 'md:gap-0' : ''}`}>
            {/* Ícone de toggle ▶ / ▼ - hidden when collapsed */}
            <span className={`transition-opacity duration-200 ${isCollapsed ? 'md:hidden' : ''}`}>
              {isExpanded ? (
                <ChevronDown className={`w-4 h-4 ${colorClass.replace('bg-', 'text-').replace('-50', '-500')} transition-transform`} />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`w-4 h-4 ${colorClass.replace('bg-', 'text-').replace('-50', '-500')}`}>
                  <path d="m9 18 6-6-6-6" />
                </svg>
              )}
            </span>
            <Icon className={`w-5 h-5 ${colorClass.replace('bg-', 'text-').replace('-50', '-500')} ${isCollapsed ? 'md:w-6 md:h-6' : ''}`} />
            <span className={`transition-opacity duration-200 ${colorClass.replace('bg-', 'text-').replace('-50', '-700')} ${isCollapsed ? 'md:hidden' : ''}`}>{title}</span>
          </div>
          <div className={`flex gap-1 transition-opacity duration-200 ${isCollapsed ? 'md:hidden' : ''}`} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => { onRequestNewStudy(rootId); onClose?.(); }}
              className={`p-1 rounded hover:bg-white ${colorClass.replace('bg-', 'text-').replace('-50', '-600')}`}
              title="Novo Estudo Rápido"
            >
              <FileText className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCreatingRootFolderIn(rootId)}
              className={`p-1 rounded hover:bg-white ${colorClass.replace('bg-', 'text-').replace('-50', '-600')}`}
              title="Nova Pasta"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Conteúdo da seção - só mostra se expandido E não está collapsed */}
        {isExpanded && !isCollapsed && (
          <>
            {creatingRootFolderIn === rootId && (
              <div className="flex items-center gap-2 p-2 mx-2 bg-white border rounded shadow-sm my-2 animate-fade-in">
                <input autoFocus placeholder="Nome da pasta..." className="text-xs p-1 w-full outline-none"
                  value={newRootFolderName} onChange={e => setNewRootFolderName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateFolder(rootId)}
                />
                <button onClick={() => setCreatingRootFolderIn(null)}><X className="w-3 h-3 text-gray-400" /></button>
              </div>
            )}

            {renderFolderTree(rootId, 0, colorClass.replace('bg-', 'text-').replace('-50', '-500'))}

            {/* Empty State Hint */}
            {folders.filter(f => f.parentId === rootId).length === 0 && studies.filter(s => s.folderId === rootId).length === 0 && !creatingRootFolderIn && (
              <div className="px-4 py-3 text-[10px] text-gray-400 italic text-center border-2 border-dashed border-gray-100 rounded-lg mx-2 mt-1">
                Vazio
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm animate-in fade-in"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50 bg-gray-50 dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 h-screen flex flex-col flex-shrink-0
          transition-all duration-300 ease-in-out
          md:static
          ${isOpen ? 'translate-x-0 shadow-2xl w-64' : '-translate-x-full md:translate-x-0'}
          ${!isOpen && !isHovered ? 'md:w-16' : 'md:w-64'}
        `}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div
          className="p-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between"
          onDragOver={(e) => handleDragOver(e)} onDrop={(e) => handleDrop(e)}
        >
          <button onClick={onGoToHome} className="text-left flex items-center gap-2 px-2" title="Início">
            <img src="/logo.png" alt="NeuroStudy" className="w-8 h-8 shrink-0" />
            <span className={`font-bold text-indigo-900 dark:text-indigo-200 text-lg whitespace-nowrap transition-opacity duration-200 ${!isOpen && !isHovered ? 'md:opacity-0 md:w-0 md:overflow-hidden' : 'opacity-100'}`}>NeuroStudy</span>
          </button>
          {/* Close Button Mobile */}
          <button onClick={onClose} className="md:hidden p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search - hidden when collapsed */}
        <div className={`px-4 pt-4 pb-2 transition-opacity duration-200 ${!isOpen && !isHovered ? 'md:hidden' : ''}`}>
          <div className="relative">
            <Search className="w-3 h-3 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Buscar..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-8 pr-2 py-1.5 text-xs bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 dark:text-slate-100 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none dark:placeholder-slate-400" />
          </div>
        </div>

        <div className={`flex-1 overflow-hidden p-2 ${!isOpen && !isHovered ? 'md:flex md:flex-col md:justify-around' : 'space-y-6'}`}>
          <SectionHeader id="neuro" title="NeuroStudy" icon={Layers} colorClass="bg-indigo-50" rootId="root-neuro" />
          <SectionHeader id="books" title="Biblioteca" icon={BookOpen} colorClass="bg-orange-50" rootId="root-books" />
          <SectionHeader id="pareto" title="Pareto 80/20" icon={Target} colorClass="bg-red-50" rootId="root-pareto" />
        </div>

        <div className="p-3 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 space-y-2">
          {/* Perfil do Usuário */}
          {profile && (
            <div className={`flex items-center gap-2 p-1.5 bg-white dark:bg-slate-700 rounded-lg border border-gray-100 dark:border-slate-600 shadow-sm relative group ${!isOpen && !isHovered ? 'md:justify-center' : ''}`}>
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="w-6 h-6 rounded-full border border-gray-200 shrink-0" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                  <User className="w-3 h-3" />
                </div>
              )}
              <div className={`flex-1 min-w-0 transition-opacity duration-200 ${!isOpen && !isHovered ? 'md:hidden' : ''}`}>
                <div className="flex items-center gap-1">
                  <p className="text-[10px] font-bold text-gray-900 dark:text-slate-100 truncate">{profile.full_name || 'Estudante'}</p>
                  {isPro && (
                    <span className="bg-indigo-600 text-white text-[7px] font-black px-1 rounded uppercase tracking-tighter">Pro</span>
                  )}
                </div>
                <p className="text-[9px] text-gray-400 dark:text-slate-400 truncate leading-tight">{profile.email}</p>
              </div>
            </div>
          )}

          {/* Methodology button - icon only when collapsed */}
          <button
            onClick={() => { onOpenMethodology(); onClose?.(); }}
            className={`w-full flex items-center gap-1.5 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 hover:border-indigo-300 text-gray-600 dark:text-slate-200 font-medium py-1.5 rounded text-[10px] shadow-sm shadow-indigo-50/50 ${!isOpen && !isHovered ? 'md:justify-center' : 'justify-center'}`}
            title="Método e Instruções"
          >
            <GraduationCap className="w-3 h-3 shrink-0" />
            <span className={`transition-opacity duration-200 ${!isOpen && !isHovered ? 'md:hidden' : ''}`}>Método e Instruções</span>
          </button>

          {/* Sair button - icon only when collapsed */}
          <button
            onClick={() => {
              if (confirm('Deseja sair da sua conta?')) {
                signOut();
              }
            }}
            className={`w-full flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 py-1.5 rounded text-[10px] transition-colors ${!isOpen && !isHovered ? 'md:justify-center' : 'justify-center'}`}
            title="Sair"
          >
            <LogOut className="w-3 h-3 shrink-0" />
            <span className={`transition-opacity duration-200 ${!isOpen && !isHovered ? 'md:hidden' : ''}`}>Sair</span>
          </button>

          <p className={`text-[9px] text-gray-300 text-center font-medium transition-opacity duration-200 ${!isOpen && !isHovered ? 'md:hidden' : ''}`}>Versão Beta 0.9</p>
        </div>
      </div>
    </>
  );
};
