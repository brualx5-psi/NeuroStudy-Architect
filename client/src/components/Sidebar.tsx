// Force rebuild: ChevronRight import fix
import React, { useState } from 'react';
import { Folder, StudySession } from '../types';
import { FolderIcon, Plus, FileText, ChevronDown, Trash, X, Edit, CornerDownRight, GraduationCap, NeuroLogo, Search, Layers, BookOpen, Target } from './Icons';
import { ChevronRight } from './Icons';

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
  onGoToHome: () => void;
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
  onGoToHome
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  
  const [creatingSubfolderIn, setCreatingSubfolderIn] = useState<string | null>(null);
  const [newSubfolderName, setNewSubfolderName] = useState('');

  const [creatingStudyInFolder, setCreatingStudyInFolder] = useState<string | null>(null);
  const [newStudyTitle, setNewStudyTitle] = useState('');

  const [creatingRootFolderIn, setCreatingRootFolderIn] = useState<string | null>(null);
  const [newRootFolderName, setNewRootFolderName] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

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

  const handleCreateStudy = (folderId: string) => {
    if (newStudyTitle.trim()) {
      onCreateStudy(folderId, newStudyTitle);
      setNewStudyTitle('');
      setCreatingStudyInFolder(null);
      setExpandedFolders(prev => ({ ...prev, [folderId]: true }));
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

    if (filteredFolders.length === 0 && filteredStudies.length === 0 && creatingSubfolderIn !== parentId && creatingStudyInFolder !== parentId) {
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
                            {isOpen ? <ChevronDown className="w-3 h-3 text-gray-400 shrink-0"/> : <ChevronRight className="w-3 h-3 text-gray-400 shrink-0"/>}
                            <FolderIcon className={`w-4 h-4 shrink-0 ${themeColor}`} />
                            <span className="truncate max-w-[140px] text-sm">{folder.name}</span>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => { e.stopPropagation(); onFolderExam(folder.id); }} className="p-0.5 text-purple-600 hover:bg-purple-100 rounded" title="Provão"><GraduationCap className="w-3 h-3"/></button>
                            <button onClick={(e) => { e.stopPropagation(); startEditing(folder); }} className="p-0.5 text-gray-400 hover:text-indigo-600 rounded" title="Renomear"><Edit className="w-3 h-3"/></button>
                            
                            {/* BOTÃO CRIAR SUBPASTA (+): Fecha o modo de estudo se estiver aberto */}
                            <button onClick={(e) => { 
                                e.stopPropagation(); 
                                setCreatingStudyInFolder(null); // <--- FECHA O MODO ESTUDO PARA NÃO CONFLITAR
                                setCreatingSubfolderIn(folder.id); 
                                setExpandedFolders(p => ({...p, [folder.id]: true})); 
                            }} className="p-0.5 text-gray-400 hover:text-green-600 rounded" title="Nova Subpasta"><Plus className="w-3 h-3"/></button>
                            
                            <button onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id); }} className="p-0.5 text-gray-400 hover:text-red-500 rounded" title="Excluir"><Trash className="w-3 h-3"/></button>
                        </div>
                    </>
                 )}
              </div>

              {isOpen && (
                <div>
                   {/* INPUT PARA NOVA SUBPASTA */}
                   {creatingSubfolderIn === folder.id && (
                      <div className="flex items-center gap-2 p-1 ml-4 my-1 animate-in slide-in-from-left-2 duration-200">
                         <CornerDownRight className="w-3 h-3 text-gray-400"/>
                         <input autoFocus placeholder="Nome da subpasta..." className="text-xs p-1 border rounded w-full focus:ring-1 focus:ring-green-500 outline-none bg-green-50"
                            value={newSubfolderName} onChange={e => setNewSubfolderName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCreateFolder(folder.id)}
                         />
                         <button onClick={() => setCreatingSubfolderIn(null)}><X className="w-3 h-3 text-gray-400"/></button>
                      </div>
                   )}
                   
                   {renderFolderTree(folder.id, depth + 1, themeColor)}
                   
                   {/* Studies in this folder */}
                   {filteredStudies.map(study => (
                     <div key={study.id} draggable onDragStart={(e) => handleDragStart(e, 'STUDY', study.id)} onClick={() => onSelectStudy(study.id)} className={`ml-4 flex items-center justify-between px-2 py-1.5 rounded text-sm cursor-pointer border-l-2 transition-all ${activeStudyId === study.id ? `bg-white ${themeColor.replace('text-', 'text-').replace('fill-', 'border-')} font-medium shadow-sm` : 'border-transparent text-gray-600 hover:bg-gray-50'}`}>
                       <div className="flex items-center gap-2 truncate"><FileText className="w-3 h-3"/> <span className="truncate">{study.title}</span></div>
                       <button onClick={(e) => { e.stopPropagation(); onDeleteStudy(study.id); }} className="text-gray-300 hover:text-red-500"><Trash className="w-3 h-3"/></button>
                     </div>
                   ))}

                   {/* INPUT / BOTÃO PARA NOVO ESTUDO (SEMPRE NO FINAL DA LISTA) */}
                   <div className="ml-4 mt-1">
                        {creatingStudyInFolder === folder.id ? (
                            <div className="flex items-center gap-1 p-1 border rounded bg-white animate-in slide-in-from-top-2 duration-200 shadow-sm">
                                <FileText className="w-3 h-3 text-indigo-500" />
                                <input autoFocus className="text-xs w-full outline-none" placeholder="Nome do estudo..." value={newStudyTitle} onChange={e => setNewStudyTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateStudy(folder.id)} />
                                <button onClick={() => setCreatingStudyInFolder(null)}><X className="w-3 h-3 text-gray-400"/></button>
                            </div>
                        ) : (
                            <button onClick={(e) => {
                                e.stopPropagation(); 
                                setCreatingSubfolderIn(null); // <--- FECHA O MODO SUBPASTA PARA NÃO CONFLITAR
                                setCreatingStudyInFolder(folder.id);
                            }} className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-indigo-600 px-1 py-1 w-full text-left transition-colors hover:bg-indigo-50 rounded">
                                <Plus className="w-3 h-3"/> Novo Estudo
                            </button>
                        )}
                   </div>
                </div>
              )}
            </div>
          );
        })}
        
        {/* Studies at the root of this section (without folder) */}
        {filteredStudies.map(study => (
             <div key={study.id} draggable onDragStart={(e) => handleDragStart(e, 'STUDY', study.id)} onClick={() => onSelectStudy(study.id)} className={`mt-1 flex items-center justify-between px-2 py-1.5 rounded text-sm cursor-pointer border-l-2 transition-all ${activeStudyId === study.id ? `bg-white ${themeColor.replace('text-', 'text-').replace('fill-', 'border-')} font-medium shadow-sm` : 'border-transparent text-gray-600 hover:bg-gray-50'}`}>
               <div className="flex items-center gap-2 truncate"><FileText className="w-3 h-3"/> <span className="truncate">{study.title}</span></div>
               <button onClick={(e) => { e.stopPropagation(); onDeleteStudy(study.id); }} className="text-gray-300 hover:text-red-500"><Trash className="w-3 h-3"/></button>
             </div>
        ))}
      </div>
    );
  };

  const SectionHeader = ({ id, title, icon: Icon, colorClass, rootId }: any) => (
      <div className="mb-2">
          <div className={`flex items-center justify-between px-3 py-2 ${colorClass} bg-opacity-10 rounded-lg`}>
              <div className="flex items-center gap-2 font-bold text-sm">
                  <Icon className={`w-4 h-4 ${colorClass.replace('bg-', 'text-')}`}/>
                  <span className={colorClass.replace('bg-', 'text-').replace('-50', '-700')}>{title}</span>
              </div>
              <button 
                onClick={() => setCreatingRootFolderIn(rootId)}
                className={`p-1 rounded hover:bg-white ${colorClass.replace('bg-', 'text-').replace('-50', '-600')}`} 
                title="Nova Pasta"
              >
                  <Plus className="w-4 h-4"/>
              </button>
          </div>
          
          {creatingRootFolderIn === rootId && (
              <div className="flex items-center gap-2 p-2 mx-2 bg-white border rounded shadow-sm my-2 animate-fade-in">
                  <input autoFocus placeholder="Nome da pasta..." className="text-xs p-1 w-full outline-none"
                    value={newRootFolderName} onChange={e => setNewRootFolderName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreateFolder(rootId)}
                  />
                  <button onClick={() => setCreatingRootFolderIn(null)}><X className="w-3 h-3 text-gray-400"/></button>
              </div>
          )}

          {renderFolderTree(rootId, 0, colorClass.replace('bg-', 'text-').replace('-50', '-500'))}
          
          {/* Empty State Hint */}
          {folders.filter(f => f.parentId === rootId).length === 0 && studies.filter(s => s.folderId === rootId).length === 0 && !creatingRootFolderIn && (
              <div className="px-4 py-3 text-[10px] text-gray-400 italic text-center border-2 border-dashed border-gray-100 rounded-lg mx-2 mt-1">
                  Vazio
              </div>
          )}
      </div>
  );

  return (
    <div className="w-64 bg-gray-50 border-r border-gray-200 h-screen flex flex-col flex-shrink-0">
      <div 
        className="p-4 border-b border-gray-200"
        onDragOver={(e) => handleDragOver(e)} onDrop={(e) => handleDrop(e)}
      >
        <button onClick={onGoToHome} className="w-full text-left flex items-center gap-2 px-2" title="Início">
           <NeuroLogo size={35} className="text-indigo-600 shrink-0" /> 
           <span className="font-bold text-indigo-900 text-lg">NeuroStudy</span>
        </button>
      </div>

      <div className="px-4 pt-4 pb-2">
        <div className="relative">
            <Search className="w-3 h-3 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"/>
            <input type="text" placeholder="Buscar..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-8 pr-2 py-1.5 text-xs bg-white border border-gray-200 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin space-y-6">
        <SectionHeader id="neuro" title="NeuroStudy" icon={Layers} colorClass="bg-indigo-50" rootId="root-neuro" />
        <SectionHeader id="books" title="Biblioteca" icon={BookOpen} colorClass="bg-orange-50" rootId="root-books" />
        <SectionHeader id="pareto" title="Pareto 80/20" icon={Target} colorClass="bg-red-50" rootId="root-pareto" />
      </div>

      <div className="p-4 border-t border-gray-200 bg-gray-50 text-center">
         <button onClick={onOpenMethodology} className="w-full flex items-center justify-center gap-2 bg-white border border-gray-200 hover:border-indigo-300 text-gray-600 font-medium py-2 rounded-lg text-xs shadow-sm">
            <GraduationCap className="w-3 h-3" /> Método e Instruções
         </button>
         <p className="text-[10px] text-gray-400 mt-2 font-medium">Versão Beta</p>
      </div>
    </div>
  );
};
