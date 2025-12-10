
import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RefreshCw, X, Tomato, Settings } from './Icons';

export const PomodoroTimer = () => {
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('25');
  
  // Position state (defaulting to bottom-left area)
  const [position, setPosition] = useState({ x: 30, y: typeof window !== 'undefined' ? window.innerHeight - 120 : 600 });
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const hasMoved = useRef(false);

  useEffect(() => {
    // Correct initial position on mount to account for actual window size
    setPosition({ x: 30, y: window.innerHeight - 100 });
  }, []);

  useEffect(() => {
    let interval: any = null;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsRunning(false);
    }
    return () => clearInterval(interval);
  }, [isRunning, timeLeft]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSetTime = (minutes: number) => {
    setTimeLeft(minutes * 60);
    setCustomMinutes(minutes.toString());
    setIsRunning(false);
  };

  const handleCustomSubmit = () => {
      const mins = parseInt(customMinutes);
      if(!isNaN(mins) && mins > 0) {
          handleSetTime(mins);
      }
  };

  const toggleTimer = () => setIsRunning(!isRunning);
  
  const resetTimer = () => {
    setIsRunning(false);
    handleSetTime(parseInt(customMinutes) || 25);
  };

  // Drag Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only left click
    if (e.button !== 0) return;
    
    isDragging.current = true;
    hasMoved.current = false;
    
    // Calculate offset from the element's top-left corner
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    dragOffset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.current) return;
    hasMoved.current = true;
    
    // Calculate new position based on mouse - offset
    let newX = e.clientX - dragOffset.current.x;
    let newY = e.clientY - dragOffset.current.y;

    // Optional: Boundary checks (keep on screen - rough)
    const maxX = window.innerWidth - 50; 
    const maxY = window.innerHeight - 50;
    
    newX = Math.max(0, Math.min(newX, maxX));
    newY = Math.max(0, Math.min(newY, maxY));

    setPosition({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  const handleMinClick = () => {
      if (!hasMoved.current) {
          setIsOpen(true);
      }
  };

  // Styles for fixed position
  const fixedStyle: React.CSSProperties = {
      position: 'fixed',
      left: `${position.x}px`,
      top: `${position.y}px`,
      touchAction: 'none', 
  };

  // Minimized View
  if (!isOpen) {
    return (
      <div 
        onMouseDown={handleMouseDown}
        onClick={handleMinClick}
        style={fixedStyle}
        className={`z-50 shadow-lg transition-transform duration-75 flex items-center gap-2 border border-red-100 cursor-move select-none animate-in fade-in zoom-in ${isRunning ? 'bg-red-500 text-white pl-4 pr-6 py-3 rounded-full hover:bg-red-600 shadow-red-200' : 'bg-white text-red-500 p-3 rounded-full hover:bg-red-50 hover:scale-110'}`}
        title="Pomodoro Timer (Arraste para mover)"
      >
        <Tomato className={isRunning ? "w-6 h-6 animate-pulse" : "w-8 h-8"} />
        {isRunning && <span className="font-mono font-bold text-lg pointer-events-none">{formatTime(timeLeft)}</span>}
      </div>
    );
  }

  // Expanded View
  return (
     <div 
        style={fixedStyle}
        className="z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 w-80 animate-in fade-in zoom-in-95"
     >
        {/* Header (Drag Handle) */}
        <div 
            onMouseDown={handleMouseDown}
            className="flex justify-between items-center mb-6 cursor-move -mx-6 -mt-6 p-6 pb-2 rounded-t-2xl hover:bg-gray-50 transition-colors select-none"
        >
            <div className="flex items-center gap-2 text-red-600 font-bold pointer-events-none">
                <Tomato className="w-6 h-6" />
                <span>Pomodoro Focus</span>
            </div>
            <button 
                onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} 
                onMouseDown={(e) => e.stopPropagation()}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 cursor-pointer"
            >
                <X className="w-5 h-5"/>
            </button>
        </div>

        <div className="text-center mb-8 select-none">
            <div className="text-6xl font-mono font-bold text-gray-800 mb-2 tracking-tighter tabular-nums">{formatTime(timeLeft)}</div>
            <div className="flex justify-center gap-4">
                <button onClick={toggleTimer} className={`p-4 rounded-full shadow-lg transition-transform active:scale-95 flex items-center justify-center ${isRunning ? 'bg-yellow-500 text-white hover:bg-yellow-600' : 'bg-red-500 text-white hover:bg-red-600'}`}>
                    {isRunning ? <Pause className="w-6 h-6 fill-current"/> : <Play className="w-6 h-6 fill-current"/>}
                </button>
                <button onClick={resetTimer} className="p-4 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors shadow-sm">
                    <RefreshCw className="w-6 h-6"/>
                </button>
            </div>
        </div>

        <div className="space-y-4">
            <div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block select-none">Presets Rápidos</span>
                <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => handleSetTime(25)} className={`py-2 rounded-lg text-sm font-medium transition-colors ${timeLeft === 25*60 ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>25m Foco</button>
                    <button onClick={() => handleSetTime(5)} className={`py-2 rounded-lg text-sm font-medium transition-colors ${timeLeft === 5*60 ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>5m Pausa</button>
                    <button onClick={() => handleSetTime(15)} className={`py-2 rounded-lg text-sm font-medium transition-colors ${timeLeft === 15*60 ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>15m Longa</button>
                </div>
            </div>

            <div>
                 <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block select-none">Tempo Personalizado (min)</span>
                 <div className="flex gap-2">
                     <input 
                        type="number" 
                        value={customMinutes} 
                        onChange={(e) => setCustomMinutes(e.target.value)}
                        onMouseDown={(e) => e.stopPropagation()} // Allow text selection inside input
                        className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                        placeholder="Minutos"
                     />
                     <button onClick={handleCustomSubmit} className="px-4 py-2 bg-gray-800 text-white text-sm font-bold rounded-lg hover:bg-gray-900">Definir</button>
                 </div>
            </div>
        </div>
     </div>
  );
};
