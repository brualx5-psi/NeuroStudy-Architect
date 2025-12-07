
import React, { useState } from 'react';
import { Folder, StudySession } from '../types';
import { FolderIcon, Plus, FileText, ChevronRight, ChevronDown, Trash, BookOpen, X, Edit, CornerDownRight, GraduationCap } from './Icons';

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
  onFolderExam
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({'default': true, 'quick-studies': true});
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  
  const [creatingSubfolderIn, setCreatingSubfolderIn] = useState<string | null>(null);
  const [newSubfolderName, setNewSubfolderName] = useState('');

  const [creatingStudyInFolder, setCreatingStudyInFolder] = useState<string | null>(null);
  const [newStudyTitle, setNewStudyTitle] = useState('');

  const [isCreatingRootFolder, setIsCreatingRootFolder] = useState(false);
  const [newRootFolderName, setNewRootFolderName] = useState('');

  // Drag and Drop State
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [dragOverHeader, setDragOverHeader] = useState(false);

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

  const handleCreateSubfolder = (parentId: string) => {
    if (newSubfolderName.trim()) {
      onCreateFolder(newSubfolderName, parentId);
      setNewSubfolderName('');
      setCreatingSubfolderIn(null);
      setExpandedFolders(prev => ({ ...prev, [parentId]: true }));
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
    else setDragOverHeader(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    setDragOverFolderId(null);
    setDragOverHeader(false);
  };

  const handleDrop = (e: React.DragEvent, targetFolderId?: string) => {
    e.preventDefault();
    setDragOverFolderId(null);
    setDragOverHeader(false);

    const type = e.dataTransfer.getData('type');
    const id = e.dataTransfer.getData('id');

    if (!type || !id) return;

    if (type === 'FOLDER') {
        // Move folder
        onMoveFolder(id, targetFolderId); // undefined targetFolderId means root
    } else if (type === 'STUDY') {
        // Move study
        const finalTarget = targetFolderId || 'default';
        onMoveStudy(id, finalTarget);
    }
  };


  // Recursive component for rendering folder tree
  const renderFolderTree = (parentId: string | undefined, depth: number = 0) => {
    const currentLevelFolders = folders.filter(f => f.parentId === parentId);
    
    // Always render if root to allow drop, but if checking emptiness for recursive call:
    if (currentLevelFolders.length === 0 && parentId !== undefined && studies.filter(s => s.folderId === parentId).length === 0 && creatingSubfolderIn !== parentId && creatingStudyInFolder !== parentId) {
        return null;
    }

    return currentLevelFolders.map(folder => {
      const folderStudies = studies.filter(s => s.folderId === folder.id);
      const isOpen = expandedFolders[folder.id];
      // 'default' can be renamed now, but not deleted. 'quick-studies' is fully locked.
      const isDeletable = folder.id !== 'default' && folder.id !== 'quick-studies';
      const isRenamable = folder.id !== 'quick-studies';

      const isDragOver = dragOverFolderId === folder.id;

      return (
        <div key={folder.id} className="select-none transition-all duration-200">
          {/* Folder Header */}
          <div 
            draggable={isRenamable} // System folders like quick-studies maybe shouldn't be dragged? Let's allow dragging 'default'
            onDragStart={(e) => handleDragStart(e, 'FOLDER', folder.id)}
            onDragOver={(e) => handleDragOver(e, folder.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, folder.id)}
            className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${editingFolderId === folder.id ? 'bg-white ring-2 ring-indigo-200' : isDragOver ? 'bg-indigo-100 ring-2 ring-indigo-300' : 'hover:bg-gray-200'}`}
            style={{ marginLeft: `${depth * 12}px` }}
            onClick={() => toggleFolder(folder.id)}
          >
             {editingFolderId === folder.id ? (
                <div className="flex items-center gap-1 w-full" onClick={e => e.stopPropagation()}>
                    <input 
                        autoFocus
                        className="w-full text-sm p-1 border border-indigo-300 rounded"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && saveEdit()}
                        onBlur={saveEdit}
                    />
                </div>
             ) : (
                <>
                    <div className="flex items-center gap-2 text-gray-700 font-medium overflow-hidden">
                    {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0"/> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0"/>}
                    <FolderIcon className={`w-4 h-4 shrink-0 ${folder.id === 'quick-studies' ? 'text-amber-500 fill-amber-500' : 'text-yellow-500 fill-yellow-500'}`} />
                    <span className="truncate max-w-[120px] text-sm">{folder.name}</span>
                    <span className="text-xs text-gray-400">({folderStudies.length})</span>
                    </div>
                    
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Folder Exam Button */}
                        {folderStudies.length > 0 && (
                             <button 
                                onClick={(e) => { e.stopPropagation(); onFolderExam(folder.id); }}
                                className="p-1 text-purple-600 hover:bg-purple-100 rounded"
                                title="Gerar Provão da Pasta"
                            >
                                <GraduationCap className="w-3 h-3"/>
                            </button>
                        )}

                        {isRenamable && (
                             <button 
                                onClick={(e) => { e.stopPropagation(); startEditing(folder); }}
                                className="p-1 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                                title="Renomear"
                            >
                                <Edit className="w-3 h-3"/>
                            </button>
                        )}
                        {/* Always allow creating subfolders/studies unless restricted */}
                        <button 
                            onClick={(e) => { e.stopPropagation(); setCreatingSubfolderIn(folder.id); setExpandedFolders(p => ({...p, [folder.id]: true})); }}
                            className="p-1 hover:text-green-600 hover:bg-green-50 rounded"
                            title="Nova Subpasta"
                        >
                            <Plus className="w-3 h-3"/>
                        </button>
                        {isDeletable && (
                             <button 
                                onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id); }}
                                className="p-1 hover:text-red-500 hover:bg-red-50 rounded"
                                title="Excluir"
                            >
                                <Trash className="w-3 h-3"/>
                            </button>
                        )}
                    </div>
                </>
             )}
          </div>

          {/* Folder Content (Subfolders + Studies) */}
          {isOpen && (
            <div className="space-y-0.5">
               {/* New Subfolder Input */}
               {creatingSubfolderIn === folder.id && (
                  <div className="flex items-center gap-2 p-1 bg-white rounded border border-gray-200 ml-6 my-1">
                     <CornerDownRight className="w-3 h-3 text-gray-400"/>
                     <input
                        autoFocus
                        placeholder="Nome da subpasta..."
                        className="text-sm p-1 border-none outline-none w-full bg-transparent"
                        value={newSubfolderName}
                        onChange={e => setNewSubfolderName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleCreateSubfolder(folder.id)}
                     />
                     <button onClick={() => setCreatingSubfolderIn(null)}><X className="w-3 h-3 text-gray-400"/></button>
                  </div>
               )}

               {/* Render Subfolders */}
               {renderFolderTree(folder.id, depth + 1)}

               {/* Create Study Action */}
               <div style={{ marginLeft: `${(depth + 1) * 12 + 8}px` }}>
                    {creatingStudyInFolder === folder.id ? (
                        <div className="flex flex-col gap-2 p-2 bg-white rounded border border-indigo-200 shadow-sm my-1">
                            <input
                            autoFocus
                            type="text"
                            value={newStudyTitle}
                            onChange={e => setNewStudyTitle(e.target.value)}
                            placeholder="Nome do estudo..."
                            className="text-sm p-1 border border-gray-200 rounded w-full"
                            onKeyDown={e => e.key === 'Enter' && handleCreateStudy(folder.id)}
                            />
                            <div className="flex justify-end gap-1">
                            <button onClick={() => setCreatingStudyInFolder(null)} className="text-xs text-gray-500 hover:bg-gray-100 px-2 py-1 rounded">Cancelar</button>
                            <button onClick={() => handleCreateStudy(folder.id)} className="text-xs bg-indigo-600 text-white px-2 py-1 rounded">Criar</button>
                            </div>
                        </div>
                    ) : (
                        <button 
                            onClick={() => setCreatingStudyInFolder(folder.id)}
                            className="w-full text-left flex items-center gap-2 px-2 py-1.5 text-xs text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded dashed-border"
                        >
                            <Plus className="w-3 h-3"/> Novo Estudo aqui
                        </button>
                    )}
               </div>

               {/* Render Studies in this Folder */}
               {folderStudies.map(study => (
                 <div 
                    key={study.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, 'STUDY', study.id)}
                    style={{ marginLeft: `${(depth + 1) * 12}px` }}
                    onClick={() => onSelectStudy(study.id)}
                    className={`group flex items-center justify-between px-2 py-1.5 rounded text-sm cursor-pointer border-l-2 ${activeStudyId === study.id ? 'bg-white text-indigo-700 font-semibold shadow-sm border-indigo-500' : 'border-transparent text-gray-600 hover:bg-gray-100 hover:border-gray-300'}`}
                 >
                   <div className="flex items-center gap-2 truncate">
                      <FileText className="w-3 h-3"/>
                      <span className="truncate">{study.title}</span>
                   </div>
                   <button 
                     onClick={(e) => { e.stopPropagation(); onDeleteStudy(study.id); }}
                     className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500"
                   >
                     <Trash className="w-3 h-3"/>
                   </button>
                 </div>
               ))}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="w-64 bg-gray-50 border-r border-gray-200 h-screen flex flex-col flex-shrink-0">
      <div 
        className={`p-4 border-b border-gray-200 transition-colors ${dragOverHeader ? 'bg-indigo-50 ring-inset ring-2 ring-indigo-300' : ''}`}
        onDragOver={(e) => handleDragOver(e)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e)} // Drop on header = Move to Root (for folders) or Default (for studies)
      >
        <h1 className="text-xl font-bold text-indigo-900 flex items-center gap-2">
           <BookOpen className="w-6 h-6 text-indigo-600"/> NeuroStudy
        </h1>
        {dragOverHeader && <p className="text-xs text-indigo-500 mt-1">Soltar para mover para Raiz</p>}
      </div>

      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        {renderFolderTree(undefined)}
      </div>

      <div className="p-4 border-t border-gray-200 bg-gray-50 space-y-3">
         {/* Create Root Folder */}
         {isCreatingRootFolder ? (
           <div className="flex gap-2 animate-in slide-in-from-bottom-2">
             <input
                autoFocus
                type="text"
                value={newRootFolderName}
                onChange={e => setNewRootFolderName(e.target.value)}
                placeholder="Nome da pasta raiz"
                className="flex-1 text-sm p-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                onKeyDown={e => {
                    if (e.key === 'Enter' && newRootFolderName.trim()) {
                        onCreateFolder(newRootFolderName);
                        setNewRootFolderName('');
                        setIsCreatingRootFolder(false);
                    }
                }}
             />
             <button onClick={() => setIsCreatingRootFolder(false)} className="bg-gray-200 text-gray-600 p-1.5 rounded hover:bg-gray-300"><X className="w-4 h-4"/></button>
           </div>
         ) : (
           <button 
             onClick={() => setIsCreatingRootFolder(true)}
             className="w-full flex items-center justify-center gap-2 bg-white border border-gray-200 hover:border-indigo-300 hover:text-indigo-600 text-gray-600 font-medium py-2 rounded-lg transition-colors text-sm shadow-sm"
           >
             <Plus className="w-4 h-4" /> Nova Pasta Raiz
           </button>
         )}

         {/* Methodology Button - Placed below Root Folder action */}
         <button 
            onClick={onOpenMethodology}
            className="w-full flex items-center justify-center gap-2 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 font-medium py-2 rounded-lg transition-colors text-sm shadow-sm"
         >
            <GraduationCap className="w-4 h-4" /> Método e Instruções
         </button>
      </div>
    </div>
  );
};
